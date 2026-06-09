"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SubscriptionSuccessPage() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          window.location.href = "/dashboard";
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-brand-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-brand-sage" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">You're subscribed!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Welcome to Allocate. Your subscription is now active.
        </p>
        <p className="text-xs text-gray-400">
          Redirecting to dashboard in {countdown} seconds...
        </p>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="mt-4 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm"
        >
          Go to dashboard now
        </button>
      </div>
    </div>
  );
}
