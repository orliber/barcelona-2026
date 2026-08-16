/*
  איך למלא את הקובץ הזה (חד-פעמי, כ-10 דקות, בלי כרטיס אשראי):
  1. https://supabase.com → הרשמה → New project → תנו שם (למשל barcelona-2026), בחרו סיסמת DB (לא צריך לזכור), בחרו region → Create.
  2. בתפריט הצד: SQL Editor → New query → הדביקו את כל התוכן של supabase/schema.sql (בשורש הריפו) → Run.
  3. בתפריט הצד: Authentication → Providers → ודאו ש-Anonymous sign-ins מופעל (Enable anonymous sign-ins).
  4. בתפריט הצד: Project Settings → API → העתיקו את "Project URL" ואת "anon public" key לתוך האובייקט למטה.
  5. פריסת ה-Edge Function (דורש Supabase CLI: npm i -g supabase):
       supabase login
       supabase link --project-ref <project-ref-מתוך-ה-URL>
       supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
       supabase functions deploy add-item
  6. commit + push. זהו — כל מי שיש לו את הקישור רואה ומוסיף בזמן אמת, ו-AI מסדר כל תוספת.

  אין בעיה שה-url וה-anonKey האלה גלויים בקוד הציבורי — הם לא סוד.
  ההגנה האמיתית היא ב-supabase/schema.sql (Row Level Security) והמפתח הסודי של Claude
  נשאר אך ורק בתוך ה-Edge Function, לעולם לא בדפדפן.
*/
export const supabaseConfig = {
  url: "https://lyhrbojosqbtvvaihfol.supabase.co",
  anonKey: "sb_publishable_8yrPB4RmZrhS6Iz0TVYObw_FPeNgcY9",
};
