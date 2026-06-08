"use client";
import { XCircle } from "lucide-react";

export default function SubscriptionCancelPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle size={32} className="text-gray-400" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Checkout cancelled</h1>
        <p className="text-gray-500 text-sm mb-6">
          No worries — you can subscribe anytime from your dashboard.
        </p>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
