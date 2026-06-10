"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, Building2, Users } from "lucide-react";

function ConnectTypeContent() {
  const params = useSearchParams();
  const tenantId = params.get("tenantId");
  const [loading, setLoading] = useState<"firm" | "client" | null>(null);
  const [error, setError] = useState("");

  const handleSelect = async (isFirmCompany: boolean) => {
    if (!tenantId) { setError("Missing connection info. Please try again."); return; }
    setLoading(isFirmCompany ? "firm" : "client");
    setError("");

    const res = await fetch("/api/companies/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, isFirmCompany }),
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(null);
      return;
    }

    if (isFirmCompany) {
      // Firm connection — no Stripe, go straight to dashboard
      window.location.href = "/dashboard";
    } else {
      // Client connection — start Stripe trial
      const stripeRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
      });
      const stripeData = await stripeRes.json();
      if (stripeData.url) {
        window.location.href = stripeData.url;
      } else {
        // Already subscribed — just go to dashboard
        window.location.href = "/dashboard";
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/allocate-logo-primary.svg" alt="Allocate" width={160} height={36} className="mx-auto mb-4" priority />
          <h1 className="text-xl font-semibold text-gray-900">What did you just connect?</h1>
          <p className="text-sm text-gray-500 mt-2">This helps us set up your billing correctly.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleSelect(true)}
            disabled={!!loading}
            className="w-full bg-white border border-gray-200 hover:border-brand-400 hover:bg-brand-50 rounded-2xl p-5 text-left transition-colors disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
                {loading === "firm"
                  ? <Loader2 size={20} className="text-brand-600 animate-spin" />
                  : <Building2 size={20} className="text-brand-600" />
                }
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">My firm's own QuickBooks</p>
                <p className="text-sm text-gray-500">This is your accounting firm's internal books. Free with any active client subscription.</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelect(false)}
            disabled={!!loading}
            className="w-full bg-white border border-gray-200 hover:border-brand-400 hover:bg-brand-50 rounded-2xl p-5 text-left transition-colors disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
                {loading === "client"
                  ? <Loader2 size={20} className="text-brand-600 animate-spin" />
                  : <Users size={20} className="text-brand-600" />
                }
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">A client's QuickBooks</p>
                <p className="text-sm text-gray-500">This is a client company you manage. $17/month per connection after a 14-day free trial.</p>
              </div>
            </div>
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.
        </p>
      </div>
    </div>
  );
}

export default function ConnectTypePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    }>
      <ConnectTypeContent />
    </Suspense>
  );
}
