"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {
    async function handleCallback() {
      // Log ALL params to see what Supabase sends after processing the link
      const allParams: Record<string, string> = {};
      searchParams.forEach((v, k) => { allParams[k] = v; });
      console.log("Callback params:", JSON.stringify(allParams));
      setStatus("Params: " + JSON.stringify(allParams));

      const error = searchParams.get("error");
      if (error) {
        const desc = searchParams.get("error_description") ?? error;
        setStatus("Error: " + desc);
        setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 3000);
        return;
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Try token_hash first
      const tokenHash = searchParams.get("token_hash");
      const type = (searchParams.get("type") ?? "recovery") as "recovery" | "email";

      if (tokenHash) {
        setStatus("Verifying token_hash...");
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        console.log("token_hash result:", verifyError?.message ?? "ok", !!data.session);
        if (!verifyError && data.session) {
          await setSession(data.session.access_token, data.session.refresh_token);
          return;
        }
      }

      // Try code exchange
      const code = searchParams.get("code");
      if (code) {
        setStatus("Exchanging code...");
        const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code);
        console.log("code exchange result:", exchError?.message ?? "ok", !!data.session);
        if (!exchError && data.session) {
          await setSession(data.session.access_token, data.session.refresh_token);
          return;
        }
      }

      // Nothing worked
      setStatus("Failed — check console for params");
      setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 3000);
    }

    async function setSession(accessToken: string, refreshToken: string) {
      setStatus("Setting session...");
      const res = await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        credentials: "include",
      });
      if (res.ok) {
        window.location.href = "/reset-password";
      } else {
        window.location.href = "/login?error=session_error";
      }
    }

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500 flex-col">
      <Loader2 className="animate-spin" size={20} />
      <span className="text-xs max-w-md text-center">{status}</span>
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
