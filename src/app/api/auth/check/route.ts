import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  // Try to manually reassemble chunked auth token
  const chunks: string[] = [];
  let i = 0;
  while (true) {
    const chunk = allCookies.find(c => c.name === `sb-khtysusiywkhgyzhjwar-auth-token.${i}`);
    if (!chunk) break;
    chunks.push(chunk.value);
    i++;
  }
  
  // Also check for non-chunked token
  const singleToken = allCookies.find(c => c.name === "sb-khtysusiywkhgyzhjwar-auth-token");

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
    singleTokenLength: singleToken?.value.length ?? 0,
    chunkCount: chunks.length,
    hasSession: !!session,
    hasUser: !!user,
    userEmail: user?.email ?? null,
    sessionExpiry: session?.expires_at ?? null,
  });
}
