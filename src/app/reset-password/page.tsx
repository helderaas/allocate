"use client";
import { useState } from "react";
import { Loader2, Lock, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to update password");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => { window.location.href = "/login"; }, 2000);
  };

  if (success) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Password updated!</h2>
        <p className="text-gray-500 text-sm">Redirecting you to sign in...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Allocate</h1>
          <p className="text-gray-500 text-sm mt-1">Set a new password</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Min. 8 characters"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400"
                  autoFocus />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm new password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">{error}</div>
            )}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
