"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [params, setParams] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((v, k) => { allParams[k] = v; });
    setParams(allParams);
    // Don't auto-redirect — show params so we can debug
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Auth Callback Debug</h2>
        <p className="text-xs text-gray-500 mb-2">Parameters received:</p>
        <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto mb-4">
          {JSON.stringify(params, null, 2)}
        </pre>
        <p className="text-xs text-gray-400">Screenshot this and share it.</p>
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
