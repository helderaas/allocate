"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function CallbackContent() {
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {
    async function handleCallback() {
      const hash = window.location.hash.substring(1);
      const query = window.location.search.substring(1);
      const hashParams = new URLSearchParams(hash);
      const queryParams = new URLSearchParams(query);

      const error = queryParams.get("error") || hashParams.get("error");
      if (error) {
        setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 1000);
        return;
      }

      // Implicit flow — tokens in URL hash
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type") ?? queryParams.get("type");

      if (accessToken && refreshToken) {
        setStatus("Setting session...");
        const res = await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
          credentials: "include",
        });
        if (res.ok) {
          window.location.href = type === "recovery" ? "/reset-password" : "/dashboard";
        } else {
          window.location.href = "/login?error=session_error";
        }
        return;
      }

      // token_hash flow
      const tokenHash = queryParams.get("token_hash");
      if (tokenHash) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type ?? "recovery") as "recovery" | "email",
        });
        if (!verifyError && data.session) {
          const res = await fetch("/api/auth/set-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
            credentials: "include",
          });
          if (res.ok) { window.location.href = "/reset-password"; return; }
        }
      }

      // PKCE code flow
      const code = queryParams.get("code");
      if (code) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchError && data.session) {
          const res = await fetch("/api/auth/set-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
            credentials: "include",
          });
          if (res.ok) { window.location.href = "/reset-password"; return; }
        }
      }

      window.location.href = "/forgot-password?error=expired";
    }

    handleCallback();
  }, []);

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
