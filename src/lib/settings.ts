import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/types/database";

const DEFAULTS: AppSettings = {
  coaching_name: "My Coaching Institute",
  logo_url: null,
  contact_email: "",
  contact_phone: "",
  academic_session: "",
  currency: "INR",
  fee_overdue_days: 30,
};

/**
 * Reads the app_settings key/value table into a typed object. Safe to
 * call from the (public) login page as well as authenticated pages —
 * see the app_settings_select RLS policy.
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error || !data) return DEFAULTS;

    const map = Object.fromEntries(data.map((row) => [row.key, row.value]));
    return {
      coaching_name: map.coaching_name ?? DEFAULTS.coaching_name,
      logo_url: map.logo_url ?? DEFAULTS.logo_url,
      contact_email: map.contact_email ?? DEFAULTS.contact_email,
      contact_phone: map.contact_phone ?? DEFAULTS.contact_phone,
      academic_session: map.academic_session ?? DEFAULTS.academic_session,
      currency: map.currency ?? DEFAULTS.currency,
      fee_overdue_days: map.fee_overdue_days ?? DEFAULTS.fee_overdue_days,
    };
  } catch {
    // Supabase env vars not configured yet (e.g. first local run before
    // .env.local is filled in) — fall back quietly instead of crashing
    // every page.
    return DEFAULTS;
  }
}
