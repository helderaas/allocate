import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  const supabaseCookies = allCookies.filter(c => 
    c.name.includes('supabase') || c.name.includes('sb-')
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  return NextResponse.json({
    allCookieNames: allCookies.map(c => c.name),
    supabaseCookies: supabaseCookies.map(c => ({ name: c.name, length: c.value.length })),
    hasSession: !!session,
    hasUser: !!user,
    userEmail: user?.email ?? null,
  });
}
