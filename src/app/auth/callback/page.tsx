"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Verifying your link...");

  useEffect(() => {
    async function handleCallback() {
      const error = searchParams.get("error");
      const errorDesc = searchParams.get("error_description");

      if (error) {
        setStatus("Link expired. Redirecting...");
        setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 2000);
        return;
      }

      // Handle token_hash (from admin generateLink - no PKCE needed)
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? "recovery";

      if (tokenHash) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        setStatus("Verifying token...");
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "recovery" | "email",
        });

        if (verifyError || !data.session) {
          console.error("Token verify error:", verifyError?.message);
          setStatus("Link invalid. Redirecting...");
          setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 2000);
          return;
        }

        setStatus("Setting session...");
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
          window.location.href = "/reset-password";
        } else {
          window.location.href = "/login?error=session_error";
        }
        return;
      }

      // Handle code (PKCE flow - fallback)
      const code = searchParams.get("code");
      if (code) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        setStatus("Exchanging code...");
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError || !data.session) {
          setStatus("Link expired. Redirecting...");
          setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 2000);
          return;
        }

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
          window.location.href = "/reset-password";
        } else {
          window.location.href = "/login?error=session_error";
        }
        return;
      }

      window.location.href = "/login";
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

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
