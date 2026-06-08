"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function CallbackContent() {
  const [status, setStatus] = useState("Processing...");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    async function handleCallback() {
      // Read from URL hash (implicit flow) AND query params
      const hash = window.location.hash.substring(1);
      const query = window.location.search.substring(1);
      
      const hashParams = new URLSearchParams(hash);
      const queryParams = new URLSearchParams(query);
      
      const debug = {
        hash: hash.substring(0, 100),
        query,
        hashKeys: Array.from(hashParams.keys()),
        queryKeys: Array.from(queryParams.keys()),
      };
      setDebugInfo(JSON.stringify(debug, null, 2));

      // Check for error in either location
      const error = queryParams.get("error") || hashParams.get("error");
      if (error) {
        setStatus("Error: " + error);
        setTimeout(() => { window.location.href = "/forgot-password?error=expired"; }, 3000);
        return;
      }

      // Get tokens from hash (implicit flow)
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type") ?? queryParams.get("type");

      if (accessToken && refreshToken) {
        setStatus("Found tokens in hash, setting session...");
        const res = await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
          credentials: "include",
        });
        if (res.ok) {
          window.location.href = type === "recovery" ? "/reset-password" : "/dashboard";
        } else {
          setStatus("Session error");
          setTimeout(() => { window.location.href = "/login?error=session_error"; }, 2000);
        }
        return;
      }

      // Try token_hash from query params
      const tokenHash = queryParams.get("token_hash");
      if (tokenHash) {
        setStatus("Verifying token_hash...");
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
          if (res.ok) {
            window.location.href = "/reset-password";
            return;
          }
        }
      }

      // Try code from query params (PKCE)
      const code = queryParams.get("code");
      if (code) {
        setStatus("Exchanging code...");
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
          if (res.ok) {
            window.location.href = "/reset-password";
            return;
          }
        }
      }

      setStatus("No valid tokens found");
      setDebugInfo(JSON.stringify(debug, null, 2));
      // Don't auto-redirect so we can see debug info
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg w-full">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="animate-spin text-indigo-500" size={18} />
          <h2 className="text-base font-semibold text-gray-900">{status}</h2>
        </div>
        {debugInfo && (
          <>
            <p className="text-xs text-gray-500 mb-2">Debug info:</p>
            <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto">
              {debugInfo}
            </pre>
          </>
        )}
      </div>
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
