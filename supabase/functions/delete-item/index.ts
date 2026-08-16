// Supabase Edge Function: מוחקת פריט בודד לפי id בלבד. זו הדרך היחידה למחוק —
// אין policy למחיקה ישירה על הטבלה (ראו supabase/schema.sql), כדי שאי אפשר יהיה
// לשלוח בקשת DELETE אחת עם תנאי גורף ולמחוק את כל התוכנייה בבת אחת.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, getCallerUserId } from "../_shared/guard.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_RE.test(id)) {
    return jsonResponse({ error: "invalid id" }, 400);
  }

  const userId = await getCallerUserId(req);
  if (!userId) {
    return jsonResponse({ error: "authentication required" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    console.error("[delete-item] delete failed", error);
    return jsonResponse({ error: "delete failed" }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
