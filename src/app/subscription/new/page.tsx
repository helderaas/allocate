"use client";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function NewSubscriptionPage() {
  useEffect(() => {
    // Immediately trigger Stripe checkout for new client connection
    fetch("/api/stripe/checkout", {
      method: "POST",
      credentials: "include",
    })
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          // Already subscribed — just go to dashboard
          window.location.href = "/dashboard";
        }
      })
      .catch(() => {
        window.location.href = "/dashboard";
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      <span>Setting up your subscription...</span>
    </div>
  );
}
