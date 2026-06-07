"use client";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConnectQBO() {
  const qboAuthUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  qboAuthUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
  qboAuthUrl.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
  qboAuthUrl.searchParams.set("response_type", "code");
  qboAuthUrl.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
  qboAuthUrl.searchParams.set("state", "allocate_connect");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-semibold text-gray-900 mb-3">Allocate</h1>
        <p className="text-gray-500 text-lg mb-8">
          Connect your QuickBooks company to get started.
        </p>
        <a
          href={qboAuthUrl.toString()}
          className="inline-flex items-center justify-center gap-3 w-full py-3 px-6 bg-[#2CA01C] hover:bg-[#238a16] text-white font-medium rounded-xl transition-colors text-base mb-4"
        >
          Connect to QuickBooks
        </a>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
