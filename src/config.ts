// Public values: the publishable key is meant to ship in the browser.
// Your data is protected by Supabase row-level security (see supabase/schema.sql).
export const SUPABASE_URL = 'https://vxclxgffaosjacrptvhb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_T6Q9DAPivxY2ee1BNNfpTw_z9fTKUSq';

// `npm run demo` → sample data kept in this browser only, no login.
export const DEMO = import.meta.env.VITE_DEMO === '1';
