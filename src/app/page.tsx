import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase";
import ConnectQBO from "./ConnectQBO";

export default async function Home() {
  const cookieStore = await cookies();
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

  // Logged in but no QBO connection yet — show Connect QBO page
  return <ConnectQBO />;
}
