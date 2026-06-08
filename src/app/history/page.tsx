"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle, XCircle, Calendar,
  Loader2, ChevronRight, History, Lock, Unlock,
  AlertCircle, X, Shield,
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
  locked_at?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  je_id_before?: string;
  je_id_after?: string;
  note?: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [allEntries, setAllEntries] = useState<AllocationDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState<string | null>(null);
  const [voidNote, setVoidNote] = useState("");
  const [voidError, setVoidError] = useState("");
  const [qboReconnectRequired, setQboReconnectRequired] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("all");

  // Audit trail modal
  const [auditDraftId, setAuditDraftId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPeriod, setAuditPeriod] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/allocations/history?all=true", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setAllEntries((data.drafts ?? []).filter((d: AllocationDraftRow) =>
          d.status === "posted" || d.status === "voided"
        ));
      } else {
        console.error("History API error:", data);
        setVoidError("Failed to load history: " + (data.error ?? res.status));
      }
    } catch (e) { console.error("History fetch error:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const voidAllocation = async (draftId: string) => {
    setVoidingId(draftId);
    setVoidError("");
    setQboReconnectRequired(false);
    try {
      const res = await fetch("/api/allocations/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, note: voidNote }),
      });
      let data: { error?: string; qbo_reconnect_required?: boolean } = {};
      try { data = await res.json(); } catch { /* empty body */ }
      if (!res.ok) {
        if (data.qbo_reconnect_required) {
          setQboReconnectRequired(true);
          setVoidError("Your QuickBooks connection has expired. Please reconnect QuickBooks.");
        } else {
          setVoidError(data.error || `Void failed (status ${res.status}). Check your QBO connection.`);
        }
        setVoidingId(null);
        return; // keep modal open so user sees the error
      }
      loadHistory();
      setVoidNote("");
      setShowVoidConfirm(null);
    } catch (e) {
      console.error("Void error:", e);
      setVoidError("Network error — could not reach the server. Please try again.");
    }
    setVoidingId(null);
  };

  const toggleLock = async (draftId: string, currentlyLocked: boolean) => {
    setLockingId(draftId);
    setVoidError("");
    try {
      const res = await fetch("/api/allocations/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, lock: !currentlyLocked }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoidError(data.error ?? "Failed to update lock");
      } else {
        loadHistory();
      }
    } catch {
      setVoidError("Failed to update lock");
    }
    setLockingId(null);
  };

  const openAuditTrail = async (draftId: string, period: string) => {
    setAuditDraftId(draftId);
    setAuditPeriod(period);
    setAuditLoading(true);
    setAuditLogs([]);
    try {
      const res = await fetch(`/api/allocations/audit?draftId=${draftId}`, { cache: "no-store" });
      if (res.ok) {
        const { logs } = await res.json();
        setAuditLogs(logs ?? []);
      }
    } catch { /* non-blocking */ }
    setAuditLoading(false);
  };

  const actionLabel: Record<string, { label: string; color: string }> = {
    posted:   { label: "Posted",   color: "text-green-600" },
    amended:  { label: "Amended",  color: "text-blue-600" },
    voided:   { label: "Voided",   color: "text-red-500" },
    locked:   { label: "Locked",   color: "text-amber-600" },
    unlocked: { label: "Unlocked", color: "text-gray-500" },
  };

  const periodLabel = (period: string) =>
    new Date(period + "-02").toLocaleString("default", { month: "long", year: "numeric" });

  const years = Array.from(new Set(allEntries.map(e => e.period.slice(0, 4)))).sort().reverse();
  const filtered = filterYear === "all" ? allEntries : allEntries.filter(e => e.period.startsWith(filterYear));
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
          {years.length > 1 && (
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600"
            >
              <option value="all">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        {voidError && !showVoidConfirm && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {voidError}
          </div>
        )}

        {/* Audit trail modal */}
        {auditDraftId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Shield size={16} className="text-indigo-500" />
                  Audit Trail — {periodLabel(auditPeriod)}
                </h2>
                <button onClick={() => setAuditDraftId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Loading...
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No audit entries found.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          log.action === "posted" ? "bg-green-500" :
                          log.action === "amended" ? "bg-blue-500" :
                          log.action === "voided" ? "bg-red-500" :
                          log.action === "locked" ? "bg-amber-500" : "bg-gray-300"
                        }`} />
                        {i < auditLogs.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="pb-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${actionLabel[log.action]?.color ?? "text-gray-600"}`}>
                            {actionLabel[log.action]?.label ?? log.action}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {(log.je_id_before || log.je_id_after) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {log.je_id_before && `JE #${log.je_id_before}`}
                            {log.je_id_before && log.je_id_after && " → "}
                            {log.je_id_after && `JE #${log.je_id_after}`}
                          </p>
                        )}
                        {log.note && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{log.note}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Void confirmation modal */}
        {showVoidConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Void this allocation?</h2>
                <button onClick={() => { setShowVoidConfirm(null); setVoidNote(""); setVoidError(""); setQboReconnectRequired(false); }} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                This will mark the allocation as voided in Allocate. You will need to <strong>manually void the journal entry in QuickBooks</strong> as well.
              </p>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={voidNote}
                  onChange={e => setVoidNote(e.target.value)}
                  placeholder="e.g. Incorrect split percentage"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
                  autoFocus
                />
              </div>
              {voidError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">
                  {voidError}
                  {qboReconnectRequired && (() => {
                    const url = new URL("https://appcenter.intuit.com/connect/oauth2");
                    url.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
                    url.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
                    url.searchParams.set("response_type", "code");
                    url.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
                    url.searchParams.set("state", "allocate_connect");
                    return (
                      <a href={url.toString()}
                        className="block mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium text-center">
                        Reconnect QuickBooks
                      </a>
                    );
                  })()}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowVoidConfirm(null); setVoidNote(""); setVoidError(""); setQboReconnectRequired(false); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => voidAllocation(showVoidConfirm)}
                  disabled={!!voidingId}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                >
                  {voidingId ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  {voidingId ? "Voiding..." : "Void entry"}
                </button>
              </div>
            </div>
          </div>
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
                    <div key={a.id} className={`flex items-center gap-3 p-4 border-b border-gray-100 last:border-0 ${
                      a.status === "voided" ? "opacity-60" : ""
                    }`}>
                      {/* Lock indicator */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        a.locked_at ? "bg-amber-50" : a.status === "posted" ? "bg-green-50" : "bg-gray-100"
                      }`}>
                        {a.locked_at
                          ? <Lock size={15} className="text-amber-500" />
                          : <Calendar size={15} className={a.status === "posted" ? "text-green-500" : "text-gray-400"} />
                        }
                      </div>

                      {/* Period + description */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => a.status === "posted" && window.open("/review?period=" + a.period + "&t=" + Date.now(), "_blank")}
                      >
                        <p className={`text-sm font-medium ${a.status === "voided" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                          {periodLabel(a.period)}
                          {a.locked_at && <span className="ml-2 text-xs text-amber-500 font-normal">Locked</span>}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {a.description || "Division allocation"}
                          {a.qbo_journal_entry_id && (
                            <span className="ml-2 text-gray-300">· JE #{a.qbo_journal_entry_id}</span>
                          )}
                        </p>
                      </div>

                      {/* Amount + date */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          ${(a.total_debits ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</p>
                      </div>

                      {/* Status */}
                      <div className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${
                        a.status === "posted" ? "text-green-600" : "text-gray-400"
                      }`}>
                        {a.status === "posted" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        <span>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                      </div>

                      {/* Audit trail button */}
                      <button
                        onClick={() => openAuditTrail(a.id, a.period)}
                        className="p-1.5 text-gray-300 hover:text-indigo-500 transition-colors"
                        title="View audit trail"
                      >
                        <Shield size={14} />
                      </button>

                      {/* Lock/unlock button */}
                      {a.status === "posted" && (
                        <button
                          onClick={() => toggleLock(a.id, !!a.locked_at)}
                          disabled={lockingId === a.id}
                          className={`p-1.5 transition-colors ${
                            a.locked_at
                              ? "text-amber-400 hover:text-gray-400"
                              : "text-gray-300 hover:text-amber-400"
                          }`}
                          title={a.locked_at ? "Unlock entry" : "Lock entry"}
                        >
                          {lockingId === a.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : a.locked_at ? <Unlock size={14} /> : <Lock size={14} />
                          }
                        </button>
                      )}

                      {/* Void button */}
                      {a.status === "posted" && (
                        <button
                          onClick={() => setShowVoidConfirm(a.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-400 hover:bg-red-50 rounded-lg shrink-0"
                        >
                          <XCircle size={11} /> Void
                        </button>
                      )}

                      {/* Chevron to open JE */}
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
// v3
