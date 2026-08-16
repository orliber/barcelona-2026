// משותף לכל ה-Edge Functions: מזהה מי בפועל קורא לפונקציה (מתוך ה-JWT של ההתחברות
// האנונימית שהדפדפן שולח), ובודק מגבלת קצב לפי אותו מזהה — כדי שאף אחד לא יוכל
// להריץ לולאה על הפונקציות שקוראות ל-Claude ולנפח את חשבון ה-API.

import { createClient } from "npm:@supabase/supabase-js@2";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "content-type": "application/json" },
  });
}

/** מזהה את המשתמש שקורא לפונקציה מתוך ה-Authorization header. null אם אין session תקין.
 *  משתמשים במפתח service_role (תמיד זמין) כדי לאמת את ה-JWT — לא ב-anon key, שהזמינות
 *  שלו כ-env var לא ודאית עם מערכת המפתחות החדשה של Supabase. */
export async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * מגבילה N קריאות לשעה לכל (userId, functionName). true אם מותר להמשיך, false אם נחסם.
 * "נכשל פתוח": אם הטבלה עצמה לא זמינה מסיבה כלשהי, לא חוסמים משתמשים אמיתיים בגלל זה.
 */
export async function checkRateLimit(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  userId: string,
  fnName: string,
  maxPerHour: number,
): Promise<boolean> {
  const hourBucket = new Date();
  hourBucket.setUTCMinutes(0, 0, 0);
  const bucketKey = `${fnName}:${userId}:${hourBucket.toISOString()}`;

  const { data, error } = await serviceClient
    .from("rate_limits")
    .select("count")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  if (error) {
    console.error("[guard] rate_limits read failed, failing open", error);
    return true;
  }
  const current = data?.count ?? 0;
  if (current >= maxPerHour) return false;

  const { error: upsertError } = await serviceClient
    .from("rate_limits")
    .upsert({ bucket_key: bucketKey, count: current + 1, updated_at: new Date().toISOString() });
  if (upsertError) console.error("[guard] rate_limits upsert failed", upsertError);

  return true;
}
