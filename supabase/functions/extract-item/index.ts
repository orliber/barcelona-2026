// Supabase Edge Function: מקבלת תמונה (צילום מסך של הזמנה) או PDF, ומחזירה שדות מובנים
// (סוג, כותרת, יום, פרטים, מחיר) בעזרת ה-vision/document של Claude. לא כותבת למסד הנתונים —
// זה רק "חילוץ"; ההוספה בפועל עוברת דרך add-item הרגיל אחרי שהמשתמש מאשר את הטופס.

import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

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
  "מצורפת תמונה או מסמך של הזמנה אמיתית (מלון, כרטיסים, ואן, ביטוח וכו') לטיול משפחתי בקוסטה בראווה וברצלונה, 26.8-2.9.2026.\n" +
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const mediaType = String(body.mediaType || "");
  const data = String(body.data || "");
  if (!ALLOWED_MEDIA.includes(mediaType)) {
    return new Response(JSON.stringify({ error: "unsupported file type" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
  if (!data || data.length > MAX_BYTES * 1.4) {
    return new Response(JSON.stringify({ error: "file too large" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  const isPdf = mediaType === "application/pdf";
  const contentBlock = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: mediaType, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } };

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
          // deno-lint-ignore no-explicit-any
          content: [contentBlock as any, { type: "text", text: "חלצו את פרטי ההזמנה." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return new Response(JSON.stringify({ error: "extraction refused" }), {
        status: 422,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || !("text" in textBlock)) {
      return new Response(JSON.stringify({ error: "no output" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
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

    return new Response(JSON.stringify({ item: result }), {
      status: 200,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-item] Claude extraction failed", err);
    return new Response(JSON.stringify({ error: "extraction failed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
