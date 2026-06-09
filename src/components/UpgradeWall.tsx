"use client";
import { useState } from "react";
import { Loader2, Zap, CheckCircle } from "lucide-react";

export default function UpgradeWall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-14 h-14 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap size={28} className="text-brand-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Subscribe to Allocate</h1>
        <p className="text-gray-500 text-sm mb-6">
          Try Allocate free for 14 days — no charge until your trial ends.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
          {[
            "Automated QBO journal entries",
            "Unlimited allocations per month",
            "Saved templates",
            "Full audit trail",
            "Volume discounts for multiple companies",
          ].map(feature => (
            <div key={feature} className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle size={15} className="text-brand-sage shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        <div className="mb-6">
          <p className="text-3xl font-bold text-gray-900">$17<span className="text-base font-normal text-gray-500">/mo per company</span></p>
          <p className="text-xs text-gray-400 mt-1">After 14-day free trial · Volume discounts for 6+ companies</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">{error}</div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl font-medium"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
          {loading ? "Loading checkout..." : "Start free trial"}
        </button>

        <p className="text-xs text-gray-400 mt-3">14 days free • Cancel anytime • Secure payment via Stripe</p>
      </div>
    </div>
  );
}

