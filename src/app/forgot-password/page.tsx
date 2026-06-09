"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Suspense } from "react";

function ForgotPasswordContent() {
  const params = useSearchParams();
  const linkError = params.get("error");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    linkError === "expired" ? "Your reset link expired. Request a new one." : ""
  );
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Call server-side API that uses admin SDK (no PKCE)
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Always show success (don't reveal if email exists)
    setSent(true);
    setLoading(false);
  };

  if (sent) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-brand-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-brand-sage" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-6">
          If an account exists for <strong>{email}</strong>, we sent a reset link.
        </p>
        <a href="/login" className="text-brand-600 text-sm font-medium hover:text-brand-700">
          Back to sign in
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Allocate</h1>
          <p className="text-gray-500 text-sm mt-1">Reset your password</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-4">
            Enter your email and we'll send you a reset link.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400"
                  autoFocus />
              </div>
            </div>
            {error && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        </div>
        <a href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-4">
          <ArrowLeft size={14} /> Back to sign in
        </a>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
