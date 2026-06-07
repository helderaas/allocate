import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase";
import { cookies } from "next/headers";
import ConnectQBO from "./ConnectQBO";

export default async function Home() {
  const user = await getAuthUser();

  // Not logged in — show landing/login page
  if (!user) {
    redirect("/login");
  }

  // Logged in — check if they have a QBO connection
  const cookieStore = await cookies();
  const tenantId = cookieStore.get("tenant_id")?.value;

  if (tenantId) {
    // Check tenant belongs to this user
    const db = getServiceSupabase();
    const { data: tenant } = await db
      .from("tenants")
      .select("id, division_a_location_id, division_b_location_id")
      .eq("id", tenantId)
      .eq("user_id", user.id)
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
