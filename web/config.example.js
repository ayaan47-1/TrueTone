// Shape of the generated web/config.js. Do not edit config.js by hand — it is written by
// `npm run waitlist:build` from EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
//
// The anon key is designed to be public: it grants exactly what Row Level Security and the
// grants in migration 0014 allow, which for the waitlist is "execute join_waitlist and
// leave_waitlist, and nothing else". It cannot read the list.
window.TRUETONE_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-KEY',
};
