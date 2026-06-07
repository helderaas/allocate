"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle, XCircle, Calendar,
  Loader2, ChevronRight, History,
} from "lucide-react";

interface AllocationDraftRow {
  id: string;
  period: string;
  status: string;
  created_at: string;
  total_debits: number;
  total_credits: number;
  description: string;
  qbo_journal_entry_id?: string;
  voided_at?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [allEntries, setAllEntries] = useState<AllocationDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Filter state
  const [filterYear, setFilterYear] = useState<string>("all");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/allocations/history?all=true", { cache: "no-store" });
      if (res.ok) {
        const { drafts } = await res.json();
        // History page only shows posted and voided
        setAllEntries((drafts ?? []).filter((d: AllocationDraftRow) =>
          d.status === "posted" || d.status === "voided"
        ));
      }
    } catch { /* non-blocking */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const voidAllocation = async (draftId: string) => {
    setVoidingId(draftId);
    setError("");
    try {
      const res = await fetch("/api/allocations/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to void allocation");
      } else {
        loadHistory();
      }
    } catch {
      setError("Failed to void allocation");
    }
    setVoidingId(null);
    setShowVoidConfirm(null);
  };

  const periodLabel = (period: string) =>
    new Date(period + "-02").toLocaleString("default", { month: "long", year: "numeric" });

  // Get unique years for filter
  const years = Array.from(new Set(allEntries.map(e => e.period.slice(0, 4)))).sort().reverse();

  const filtered = filterYear === "all"
    ? allEntries
    : allEntries.filter(e => e.period.startsWith(filterYear));

  // Group by year
  const grouped = filtered.reduce<Record<string, AllocationDraftRow[]>>((acc, entry) => {
    const year = entry.period.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {});

  const sortedYears = Object.keys(grouped).sort().reverse();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <History size={22} className="text-indigo-500" /> Allocation History
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">All posted and voided journal entries</p>
          </div>

          {/* Year filter */}
          {years.length > 1 && (
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600"
            >
              <option value="all">All years</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
            <Loader2 size={18} className="animate-spin" /> Loading history...
          </div>
        ) : allEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={22} className="text-indigo-400" />
            </div>
            <p className="text-gray-500 text-sm">No posted allocations yet.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-indigo-600 text-sm font-medium hover:text-indigo-700"
            >
              Run your first allocation →
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedYears.map(year => (
              <div key={year}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{year}</p>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {grouped[year].map(a => (
                    <div key={a.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        a.status === "posted" ? "bg-green-50" : "bg-gray-100"
                      }`}>
                        <Calendar size={16} className={a.status === "posted" ? "text-green-500" : "text-gray-400"} />
                      </div>

                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => a.status === "posted" && window.open("/review?period=" + a.period + "&t=" + Date.now(), "_blank")}
                      >
                        <p className={`text-sm font-medium ${a.status === "voided" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                          {periodLabel(a.period)}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {a.description || "Division allocation"}
                          {a.qbo_journal_entry_id && (
                            <span className="ml-2 text-gray-300">· JE #{a.qbo_journal_entry_id}</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          ${(a.total_debits ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${
                        a.status === "posted" ? "text-green-600" : "text-gray-400"
                      }`}>
                        {a.status === "posted" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        <span>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                      </div>

                      {a.status === "posted" && (
                        showVoidConfirm === a.id ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-gray-500">Void?</span>
                            <button
                              onClick={() => voidAllocation(a.id)}
                              disabled={voidingId === a.id}
                              className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-60"
                            >
                              {voidingId === a.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                            </button>
                            <button
                              onClick={() => setShowVoidConfirm(null)}
                              className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowVoidConfirm(a.id)}
                            className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-400 hover:bg-red-50 rounded-lg"
                          >
                            <XCircle size={11} /> Void
                          </button>
                        )
                      )}

                      {a.status === "posted" && (
                        <ChevronRight
                          size={14}
                          className="text-gray-300 shrink-0 cursor-pointer"
                          onClick={() => window.open("/review?period=" + a.period + "&t=" + Date.now(), "_blank")}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// v2

