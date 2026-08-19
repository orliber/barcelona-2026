// Supabase Edge Function: מקבלת תמונה (צילום מסך של הזמנה), PDF, או קישור (Booking.com וכו'),
// ומחזירה שדות מובנים (סוג, כותרת, יום, פרטים, מחיר) בעזרת Claude. לא כותבת למסד הנתונים —
// זה רק "חילוץ"; ההוספה בפועל עוברת דרך add-item הרגיל אחרי שהמשתמש מאשר את הטופס.

import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getCallerUserId, checkRateLimit } from "../_shared/guard.ts";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_PER_HOUR = 15; // חילוץ מתמונה יקר יותר (vision) מהוספה רגילה — מגבלה נמוכה יותר
const ATTACHMENT_BUCKET = "item-attachments";
const EXT_BY_MEDIA: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

const TYPES = ["hotel", "transport", "tickets", "activity", "note"];
const DAYS = [
  { id: "d1", date: "2026-08-26", label: "יום 1 · 26 באוג׳ · נחיתה, ברצלונה" },
  { id: "d2", date: "2026-08-27", label: "יום 2 · 27 באוג׳ · גאודי והמשחק, ברצלונה" },
  { id: "d3", date: "2026-08-28", label: "יום 3 · 28 באוג׳ · נסיעה ליורט" },
  { id: "d4", date: "2026-08-29", label: "יום 4 · 29 באוג׳ · יום המים, יורט" },
  { id: "d5", date: "2026-08-30", label: "יום 5 · 30 באוג׳ · קיאקים, נסיעה לבגור" },
  { id: "d6", date: "2026-08-31", label: "יום 6 · 31 באוג׳ · סאפ וסה טונה, בגור" },
  { id: "d7", date: "2026-09-01", label: "יום 7 · 1 בספט׳ · אאוטלט וחזרה" },
  { id: "general", date: "", label: "כללי — לא קשור ליום ספציפי (למשל ביטוח, ואן לכל הטיול)" },
];

const SYSTEM_PROMPT =
  "מצורפים פרטי הזמנה אמיתית (מלון, כרטיסים, ואן, ביטוח וכו') לטיול משפחתי בקוסטה בראווה וברצלונה, 26.8-2.9.2026 — " +
  "כתמונה, כמסמך PDF, או כתוכן טקסטואלי של עמוד אינטרנט (למשל דף הזמנה מ-Booking.com).\n" +
  "חלצו ממנה את הפרטים הרלוונטיים לתוכנייה משותפת של הטיול, בעברית, בסגנון תמציתי.\n\n" +
  "ימי הטיול (לבחירת day):\n" +
  DAYS.map((d) => `${d.id}: ${d.label}${d.date ? " (" + d.date + ")" : ""}`).join("\n") +
  "\n\nכללים:\n" +
  "- title: שם בית העסק/השירות כפי שמופיע במסמך (למשל שם המלון). שמות מקומות/מותגים נשארים כפי שהם, לא מתרגמים.\n" +
  "- day: לפי תאריכים שמופיעים במסמך, בחרו את היום המתאים ביותר מהרשימה למעלה. אם אין תאריך ברור, 'general'.\n" +
  "- dayEnd: אם זו הזמנת לינה/מלון עם תאריך צ'ק-אין וצ'ק-אאוט: day = היום התואם לצ'ק-אין, dayEnd = היום התואם ללילה האחרון (יום אחד לפני הצ'ק-אאוט). לדוגמה: צ'ק-אין 26.8, צ'ק-אאוט 28.8 → day=d1, dayEnd=d2. לפריט שרלוונטי ליום בודד, dayEnd זהה ל-day. אם day הוא general, dayEnd גם general.\n" +
  "- type: hotel/transport/tickets/activity/note — הכי מתאים לתוכן המסמך.\n" +
  "- details: משפט אחד קצר ותכליתי (תאריכים, שעות, כמות, מיקום).\n" +
  "- price: הסכום ששולם/לתשלום, בפורמט נקי כמו €240, אם מופיע.\n" +
  "אל תמציאו מידע שלא מופיע במסמך בפועל. אם שדה לא ברור, השאירו אותו ריק.";

const DAY_IDS = DAYS.map((d) => d.id);

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: TYPES },
    title: { type: "string" },
    day: { type: "string", enum: DAY_IDS },
    dayEnd: { type: "string", enum: DAY_IDS },
    details: { type: "string" },
    price: { type: "string" },
  },
  required: ["type", "title", "day", "dayEnd", "details", "price"],
  additionalProperties: false,
};

function isSafeHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false; // IPv4 literal
  if (host.includes(":")) return false; // IPv6 literal
  return true;
}

function htmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|tr|li|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const sourceUrl = typeof body.url === "string" ? body.url.trim() : "";
  const mediaType = String(body.mediaType || "");
  const data = String(body.data || "");

  if (!sourceUrl) {
    if (!ALLOWED_MEDIA.includes(mediaType)) {
      return jsonResponse({ error: "unsupported file type" }, 400);
    }
    if (!data || data.length > MAX_BYTES * 1.4) {
      return jsonResponse({ error: "file too large" }, 400);
    }
  } else if (!isSafeHttpsUrl(sourceUrl)) {
    return jsonResponse({ error: "invalid url" }, 400);
  }

  const userId = await getCallerUserId(req);
  if (!userId) {
    return jsonResponse({ error: "authentication required" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const allowed = await checkRateLimit(supabase, userId, "extract-item", MAX_PER_HOUR);
  if (!allowed) {
    return jsonResponse({ error: "rate limit exceeded, try again later" }, 429);
  }

  // deno-lint-ignore no-explicit-any
  let contentBlock: any;
  if (sourceUrl) {
    let pageText: string;
    try {
      const pageRes = await fetch(sourceUrl, {
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "accept-language": "he,en;q=0.8",
        },
      });
      if (!pageRes.ok) {
        return jsonResponse({ error: "couldn't open the link (status " + pageRes.status + ")" }, 422);
      }
      const html = await pageRes.text();
      pageText = htmlToText(html).slice(0, 15000);
      if (pageText.length < 40) {
        return jsonResponse({ error: "the page didn't return readable content" }, 422);
      }
    } catch (err) {
      console.error("[extract-item] url fetch failed", err);
      return jsonResponse({ error: "couldn't open the link" }, 422);
    }
    contentBlock = { type: "text", text: "תוכן העמוד:\n\n" + pageText };
  } else {
    const isPdf = mediaType === "application/pdf";
    contentBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: mediaType, data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } };
  }

  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: sourceUrl ? "חלצו את פרטי ההזמנה מתוך תוכן העמוד." : "חלצו את פרטי ההזמנה." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return jsonResponse({ error: "extraction refused" }, 422);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || !("text" in textBlock)) {
      return jsonResponse({ error: "no output" }, 500);
    }
    const parsed = JSON.parse(textBlock.text);
    const day = DAY_IDS.includes(parsed.day) ? parsed.day : "general";
    const result = {
      type: TYPES.includes(parsed.type) ? parsed.type : "note",
      title: String(parsed.title || "").slice(0, 120),
      day: day,
      dayEnd: day === "general" ? "general" : (DAY_IDS.includes(parsed.dayEnd) ? parsed.dayEnd : day),
      details: String(parsed.details || "").slice(0, 240),
      price: String(parsed.price || "").slice(0, 40),
    };

    // שומרים גם את הקובץ המקורי (צילום/PDF ההזמנה) בstorage, כדי שתהיה אחר כך גישה
    // מהירה אליו מתוך הפריט עצמו — לא רק לשדות שה-AI חילץ ממנו. בזרימת קישור אין קובץ
    // להעלות — הקישור המקורי עצמו כבר ממולא בטופס כ"קישור".
    let attachmentUrl: string | null = null;
    if (!sourceUrl) {
      try {
        const ext = EXT_BY_MEDIA[mediaType] || "bin";
        const path = `items/${crypto.randomUUID()}.${ext}`;
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const { error: uploadError } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .upload(path, bytes, { contentType: mediaType, upsert: false });
        if (uploadError) {
          console.error("[extract-item] attachment upload failed", uploadError);
        } else {
          const { data: pub } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(path);
          attachmentUrl = pub.publicUrl;
        }
      } catch (err) {
        console.error("[extract-item] attachment upload threw", err);
      }
    }

    return jsonResponse({ item: result, attachmentUrl }, 200);
  } catch (err) {
    console.error("[extract-item] Claude extraction failed", err);
    return jsonResponse({ error: "extraction failed" }, 502);
  }
});
