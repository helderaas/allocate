"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AllocationDraft, AllocationLine } from "@/types";
import { CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";

function ReviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const period = params.get("period");
  const [draft, setDraft] = useState<AllocationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!period) return;
      const res = await fetch(`/api/allocations/draft?period=${period}`);
      const data = await res.json();
      setDraft(data.draft);
      setLoading(false);
    }
    load();
  }, [period]);

  const approve = async () => {
    if (!draft) return;
    setPosting(true);
    const res = await fetch("/api/allocations/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.id }),
    });
    if (res.ok) {
      setPosted(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
    }
    setPosting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} /> Loading draft…
    </div>
  );

  if (posted) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Journal entry posted!</h2>
        <p className="text-gray-500 text-sm mb-6">The allocation has been posted to QuickBooks.</p>
        <button onClick={() => router.push("/dashboard")}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700">
          Back to dashboard
        </button>
      </div>
    </div>
  );

  if (!draft) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Draft not found.
    </div>
  );

  const lines: AllocationLine[] = typeof draft.lines === "string"
    ? JSON.parse(draft.lines)
    : draft.lines;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-10 px-4">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Review allocation</h1>
            <p className="text-gray-500 text-sm mt-0.5">Period: {period}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              <XCircle size={16} /> Reject
            </button>
            <button onClick={approve} disabled={posting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm">
              {posting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {posting ? "Posting…" : "Approve & post to QBO"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total lines</p>
            <p className="text-2xl font-semibold text-gray-900">{lines.length * 2}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total debits</p>
            <p className="text-2xl font-semibold text-green-600">${Number(draft.total_debits).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total credits</p>
            <p className="text-2xl font-semibold text-red-500">${Number(draft.total_credits).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <span>Account</span>
            <span>Location</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
          </div>
          {lines.map((line, i) => (
            <div key={i}>
              <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="text-sm text-blue-600">Division A</span>
                <span className="text-sm text-right"></span>
                <span className="text-sm text-right text-red-500">${line.division_a_amount.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="text-sm text-teal-600">Division B</span>
                <span className="text-sm text-right text-green-600">${line.division_b_amount.toLocaleString()}</span>
                <span className="text-sm text-right"></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>}>
      <ReviewContent />
    </Suspense>
  );
}