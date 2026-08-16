// Supabase Edge Function: מנקה/מארגנת קלט חופשי שמישהו הקליד (הזמנה, כרטיסים, ואן וכו')
// באמצעות Claude, ואז שומרת את הגרסה המסודרת בטבלה. זו הדרך היחידה לכתוב לטבלה —
// אין policy של insert עבור אנשים אנונימיים ב-RLS, כדי שמפתח ה-API לא יהיה חשוף בדפדפן.
//
// פריסה: supabase functions deploy add-item
// סוד: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY זמינים אוטומטית לכל Edge Function)

import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  "אתם מסדרים פריט אחד שמישהו הוסיף לתוכנייה משותפת של טיול משפחתי בקוסטה בראווה וברצלונה, 26.8-2.9.2026.\n" +
  "קיבלתם קלט חופשי וקצת מבולגן (לפעמים מועתק מהזמנה אמיתית). המשימה שלכם: לנקות ולסדר אותו כדי שיתאים בול לסגנון של שאר האתר — תמציתי, ברור, בעברית.\n\n" +
  "ימי הטיול (לבחירת day):\n" +
  DAYS.map((d) => `${d.id}: ${d.label}${d.date ? " (" + d.date + ")" : ""}`).join("\n") +
  "\n\nכללים:\n" +
  "- title: כותרת קצרה ונקייה. שמות מקומות/מלונות/מותגים (Petit Palace Museum וכו') נשארים כפי שהם, לא מתרגמים. מתקנים שגיאות כתיב ברורות.\n" +
  "- day: אם יש בטקסט תאריך או רמז לתאריך, בחרו את היום המתאים ביותר מהרשימה למעלה גם אם זה סותר את הבחירה המקורית של מי שמילא את הטופס. אם אין רמז ברור, השאירו את היום שנבחר במקור.\n" +
  "- dayEnd: אם זו הזמנת לינה/מלון עם תאריך צ'ק-אין וצ'ק-אאוט: day = היום התואם לצ'ק-אין, dayEnd = היום התואם ללילה האחרון (יום אחד לפני הצ'ק-אאוט). לדוגמה: צ'ק-אין 26.8, צ'ק-אאוט 28.8 → day=d1, dayEnd=d2. לפריט שרלוונטי ליום בודד (כרטיסים, פעילות, הערה), dayEnd זהה ל-day. אם day הוא general, dayEnd גם general.\n" +
  "- type: הסוג המתאים ביותר מתוך hotel/transport/tickets/activity/note.\n" +
  "- details: משפט אחד קצר ותכליתי (תאריכים, שעות, כמות, מיקום) — לא לחזור על הכותרת.\n" +
  "- price: פורמט נקי כמו €240 אם יש מספר ומטבע ברור; אחרת השאירו כפי שהוא או ריק.\n" +
  "אל תמציאו מידע שלא הופיע בקלט המקורי.";

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

function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

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

  const rawTitle = clip(body.title, 120);
  if (!rawTitle) {
    return new Response(JSON.stringify({ error: "title is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
  const addedBy = clip(body.addedBy, 40);
  if (!addedBy) {
    return new Response(JSON.stringify({ error: "addedBy is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
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
    console.error("[add-item] Claude formatting failed, using raw input", err);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("items")
    .insert({
      type: cleaned.type,
      title: cleaned.title,
      day: cleaned.day,
      day_end: cleaned.dayEnd,
      details: cleaned.details,
      price: cleaned.price,
      link: link || null,
      added_by: addedBy || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[add-item] insert failed", error);
    return new Response(JSON.stringify({ error: "save failed" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ item: data }), {
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
});
