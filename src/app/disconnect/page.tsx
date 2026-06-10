"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function DisconnectPage() {
  const [reconnectUrl, setReconnectUrl] = useState("");

  useEffect(() => {
    const url = new URL("https://appcenter.intuit.com/connect/oauth2");
    url.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
    url.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
    url.searchParams.set("state", "sso_L2Rhc2hib2FyZA=="); // /dashboard base64
    setReconnectUrl(url.toString());
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/allocate-logo-primary.svg" alt="Allocate" width={160} height={36} className="mx-auto mb-6" priority />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          <h1 className="text-lg font-semibold text-gray-900 mb-2">QuickBooks disconnected</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your QuickBooks Online company has been disconnected from Allocate. Your allocation history is preserved in read-only mode.
          </p>

          {reconnectUrl && (
            <a
              href={reconnectUrl}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm transition-colors mb-3"
            >
              Connect to QuickBooks
            </a>
          )}

          <Link
            href="/login"
            className="w-full flex items-center justify-center px-6 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm transition-colors"
          >
            Sign in to Allocate
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.
        </p>
      </div>
    </div>
  );
}
