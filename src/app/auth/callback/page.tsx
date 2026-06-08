"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function EmailCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Verifying your link...");

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const errorDesc = searchParams.get("error_description");
      const error = searchParams.get("error");

      // Handle error from Supabase
      if (error) {
        setStatus("Link expired or invalid. Redirecting...");
        setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 2000);
        return;
      }

      if (!code) {
        window.location.href = "/login";
        return;
      }

      // Use implicit flow client (no PKCE)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            flowType: "implicit",
          }
        }
      );

      setStatus("Exchanging code...");
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError || !data.session) {
        console.error("Exchange error:", exchangeError?.message);
        setStatus("Link expired. Redirecting...");
        setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 2000);
        return;
      }

      setStatus("Setting session...");
      // Set httpOnly cookies via API
      const res = await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
        credentials: "include",
      });

      if (res.ok) {
        setStatus("Redirecting to reset password...");
        window.location.href = "/reset-password";
      } else {
        window.location.href = "/login?error=session_error";
      }
    }

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      <span>{status}</span>
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
