import { createClient } from "@supabase/supabase-js";

/** Same env names as ipl_app — reuse the same Supabase project URL and service role. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { persistSession: false },
});
