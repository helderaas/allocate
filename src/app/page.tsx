import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase";
import ConnectQBO from "./ConnectQBO";

export default async function Home() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  
  // Check if this is a password recovery redirect from Supabase
  // Supabase sends: /?token_hash=xxx&type=recovery
  // We need to forward to our email callback
  const url = headerStore.get("x-url") || "";
  
  const accessToken = cookieStore.get("sb_access_token")?.value;

  // Not logged in — redirect to login
  if (!accessToken) {
    redirect("/login");
  }

  // Logged in — check if they have a QBO connection via tenant_id cookie
  const tenantId = cookieStore.get("tenant_id")?.value;

  if (tenantId) {
    const db = getServiceSupabase();
    const { data: tenant } = await db
      .from("tenants")
      .select("id, division_a_location_id, division_b_location_id")
      .eq("id", tenantId)
      .single();

    if (tenant) {
      const { data: rules } = await db
        .from("allocation_rules")
        .select("id")
        .eq("tenant_id", tenant.id)
        .limit(1);

      if (tenant.division_a_location_id && tenant.division_b_location_id && rules?.length) {
        redirect("/dashboard");
      } else {
        redirect(`/onboarding?tenantId=${tenant.id}`);
      }
    }
  }

  // Logged in but no QBO connection yet
  return <ConnectQBO />;
}
