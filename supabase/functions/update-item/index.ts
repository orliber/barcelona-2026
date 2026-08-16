// Supabase Edge Function: כמו add-item, אבל מעדכנת שורה קיימת (לפי id) במקום ליצור חדשה.
// זו הדרך היחידה לערוך פריט — אין policy לעדכון ישיר על הטבלה.

import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getCallerUserId, checkRateLimit } from "../_shared/guard.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_HOUR = 40;

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
const DAY_IDS = DAYS.map((d) => d.id);

const SYSTEM_PROMPT =
  "מישהו בקבוצה עורך פריט קיים בתוכנייה משותפת של טיול משפחתי בקוסטה בראווה וברצלונה, 26.8-2.9.2026.\n" +
  "קיבלתם את הגרסה המעודכנת של השדות (אחרי שהמשתמש ערך אותם). נקו וסדרו אותם כדי שיתאימו בול לסגנון של שאר האתר — תמציתי, ברור, בעברית.\n\n" +
  "ימי הטיול (לבחירת day):\n" +
  DAYS.map((d) => `${d.id}: ${d.label}${d.date ? " (" + d.date + ")" : ""}`).join("\n") +
  "\n\nכללים:\n" +
  "- title: כותרת קצרה ונקייה. שמות מקומות/מלונות/מותגים נשארים כפי שהם, לא מתרגמים.\n" +
  "- day/dayEnd: אם זו הזמנת לינה עם צ'ק-אין וצ'ק-אאוט: day=יום הצ'ק-אין, dayEnd=יום הלילה האחרון (יום לפני הצ'ק-אאוט). לדוגמה 26.8-28.8 → day=d1, dayEnd=d2. לפריט של יום בודד, dayEnd זהה ל-day. אם day הוא general, dayEnd גם general.\n" +
  "- type: hotel/transport/tickets/activity/note — הכי מתאים.\n" +
  "- details: משפט אחד קצר ותכליתי — לא לחזור על הכותרת.\n" +
  "- price: פורמט נקי כמו €240 אם יש מספר ומטבע ברור.\n" +
  "אל תמציאו מידע שלא הופיע בקלט.";

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

function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const id = String(body.id || "");
  if (!UUID_RE.test(id)) return jsonResponse({ error: "invalid id" }, 400);

  const rawTitle = clip(body.title, 120);
  if (!rawTitle) return jsonResponse({ error: "title is required" }, 400);

  const addedBy = clip(body.addedBy, 40);
  if (!addedBy) return jsonResponse({ error: "addedBy is required" }, 400);

  const userId = await getCallerUserId(req);
  if (!userId) return jsonResponse({ error: "authentication required" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const allowed = await checkRateLimit(supabase, userId, "update-item", MAX_PER_HOUR);
  if (!allowed) return jsonResponse({ error: "rate limit exceeded, try again later" }, 429);

  const rawType = TYPES.includes(String(body.type)) ? String(body.type) : "note";
  const rawDay = DAY_IDS.includes(String(body.day)) ? String(body.day) : "general";
  const raw = {
    type: rawType,
    title: rawTitle,
    day: rawDay,
    dayEnd: rawDay,
    details: clip(body.details, 240),
    price: clip(body.price, 40),
  };
  const link = clip(body.link, 500);

  let cleaned = raw;
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
      messages: [{ role: "user", content: JSON.stringify(raw) }],
    });

    if (response.stop_reason !== "refusal") {
      const textBlock = response.content.find((b) => b.type === "text");
      if (textBlock && "text" in textBlock) {
        const parsed = JSON.parse(textBlock.text);
        const day = DAY_IDS.includes(parsed.day) ? parsed.day : raw.day;
        cleaned = {
          type: TYPES.includes(parsed.type) ? parsed.type : raw.type,
          title: clip(parsed.title, 120) || raw.title,
          day: day,
          dayEnd: day === "general" ? "general" : (DAY_IDS.includes(parsed.dayEnd) ? parsed.dayEnd : day),
          details: clip(parsed.details, 240),
          price: clip(parsed.price, 40),
        };
      }
    }
  } catch (err) {
    console.error("[update-item] Claude formatting failed, using raw input", err);
  }

  const { data, error } = await supabase
    .from("items")
    .update({
      type: cleaned.type,
      title: cleaned.title,
      day: cleaned.day,
      day_end: cleaned.dayEnd,
      details: cleaned.details,
      price: cleaned.price,
      link: link || null,
      added_by: addedBy,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[update-item] update failed", error);
    return jsonResponse({ error: "save failed" }, 500);
  }

  return jsonResponse({ item: data }, 200);
});
