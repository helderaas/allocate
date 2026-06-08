"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function EmailCallbackContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    
    if (!code) {
      window.location.href = "/login?error=invalid_link";
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Exchange code client-side (has access to PKCE verifier in localStorage)
    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        setError(error?.message ?? "Invalid or expired link");
        setTimeout(() => { window.location.href = "/login?error=invalid_link"; }, 2000);
        return;
      }

      // Now set our httpOnly cookies via API
      const res = await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          is_reset: true,
        }),
        credentials: "include",
      });

      if (res.ok) {
        window.location.href = "/reset-password";
      } else {
        window.location.href = "/login?error=session_error";
      }
    });
  }, [searchParams]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-500 text-sm">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      <span>Verifying your link...</span>
    </div>
  );
}

export default function EmailCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    }>
      <EmailCallbackContent />
    </Suspense>
  );
}
