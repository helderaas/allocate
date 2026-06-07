"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ArrowRight, CheckCircle, Clock, Settings, Loader2, AlertCircle, Plus, ChevronRight } from "lucide-react";

interface ConfigStats {
  totalAccounts: number;
  revenuePctRules: number;
  fixedSplitRules: number;
  divisionAName: string;
  divisionBName: string;
}

interface AllocationDraftRow {
  id: string;
  period: string;
  status: string;
  created_at: string;
  total_debits: number;
  total_credits: number;
  description: string;
}

type DatePreset = "last_month" | "this_month" | "custom";

export default function DashboardPage() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [showNewAllocation, setShowNewAllocation] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [config, setConfig] = useState<ConfigStats | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [history, setHistory] = useState<AllocationDraftRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [datePreset, setDatePreset] = useState<DatePreset>("last_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jeDate, setJeDate] = useState("");
  const [description, setDescription] = useState("");
  const [journalNumber, setJournalNumber] = useState("");

  // Apply date preset
  useEffect(() => {
    const today = new Date();
    if (datePreset === "last_month") {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      setStartDate(fmt(first));
      setEndDate(fmt(last));
    } else if (datePreset === "this_month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      setStartDate(fmt(first));
      setEndDate(fmt(last));
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [datePreset]);

  // Load config stats
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/onboarding/config", { cache: "no-store" });
        const { tenant, rules } = await res.json();
        setConfig({
          totalAccounts: rules?.length ?? 0,
          revenuePctRules: rules?.filter((r: { rule_type: string }) => r.rule_type === "revenue_pct").length ?? 0,
          fixedSplitRules: rules?.filter((r: { rule_type: string }) => r.rule_type === "fixed_split").length ?? 0,
          divisionAName: tenant?.division_a_location_name ?? "—",
          divisionBName: tenant?.division_b_location_name ?? "—",
        });
      } catch { /* non-blocking */ }
      setConfigLoading(false);
    }
    loadConfig();
  }, []);

  // Load allocation history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/allocations/history", { cache: "no-store" });
        if (res.ok) {
          const { drafts } = await res.json();
          setHistory(drafts ?? []);
        }
      } catch { /* non-blocking */ }
      setHistoryLoading(false);
    }
    loadHistory();
  }, []);

  const period = startDate ? startDate.slice(0, 7) : "";
  const periodLabel = startDate
    ? new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })
    : "Select a period";
  const defaultDescription = startDate ? "Division allocation - " + periodLabel : "";
  const canRun = !!startDate && !!endDate && (config?.totalAccounts ?? 0) > 0;

  const runAllocation = async () => {
    if (!startDate || !endDate) { setError("Please select a period."); return; }
    setRunning(true);
    setError("");
    const res = await fetch("/api/allocations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period, startDate, endDate,
        jeDate: jeDate || endDate,
        description: description || defaultDescription,
        journalNumber,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setRunning(false);
      return;
    }
    router.push("/review?period=" + period + "&t=" + Date.now());
    setRunning(false);
  };

  const statusColor = (status: string) => {
    if (status === "posted") return "text-green-600";
    if (status === "draft") return "text-amber-500";
    return "text-gray-400";
  };

  const statusIcon = (status: string) => {
    if (status === "posted") return <CheckCircle size={14} />;
    return <Clock size={14} />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <a href="/onboarding?returnTo=dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <Settings size={14} /> Settings
        </a>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            {!configLoading && config && (
              <p className="text-gray-500 text-sm mt-0.5">
                {config.divisionAName} · {config.divisionBName}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowNewAllocation(v => !v)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm"
          >
            <Plus size={16} /> New Allocation
          </button>
        </div>

        {/* No rules warning */}
        {!configLoading && (config?.totalAccounts ?? 0) === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3 text-amber-700 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>No accounts configured. <a href="/onboarding?returnTo=dashboard" className="underline font-medium">Go to Settings</a> to set up your allocation rules.</span>
          </div>
        )}

        {/* New Allocation panel */}
        {showNewAllocation && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">New allocation</h2>

            {/* Date preset buttons */}
            <div className="flex gap-2 mb-4">
              {([
                { value: "last_month", label: "Last Month" },
                { value: "this_month", label: "This Month" },
                { value: "custom", label: "Custom" },
              ] as { value: DatePreset; label: string }[]).map(p => (
                <button
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  className={"px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors " + (
                    datePreset === p.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date fields — shown for all presets so user can confirm/adjust */}
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Period start {datePreset === "custom" && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Period end {datePreset === "custom" && <span className="text-red-400">*</span>}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            {/* Advanced options */}
            <div className="mb-4">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showOptions ? "Hide options" : "Show options"}
              </button>
            </div>

            {showOptions && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Journal entry date</label>
                  <input type="date" value={jeDate} onChange={e => setJeDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                  <p className="text-xs text-gray-400 mt-1">Defaults to period end if blank.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Journal number (optional)</label>
                  <input type="text" value={journalNumber} onChange={e => setJournalNumber(e.target.value)}
                    placeholder="e.g. JE-2026-05"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description / memo</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={defaultDescription || "e.g. May 2026 Division Allocation"}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">{error}</div>
            )}

            <button
              onClick={runAllocation}
              disabled={running || !canRun}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm"
            >
              {running
                ? <><Loader2 size={16} className="animate-spin" /> Calculating...</>
                : <><ArrowRight size={16} /> Run {periodLabel}</>}
            </button>
          </div>
        )}

        {/* Config stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {configLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
                <div className="h-7 bg-gray-100 rounded w-10" />
              </div>
            ))
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Accounts configured</p>
                <p className="text-2xl font-semibold text-gray-900">{config?.totalAccounts ?? 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Revenue % rules</p>
                <p className="text-2xl font-semibold text-gray-900">{config?.revenuePctRules ?? 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Fixed split rules</p>
                <p className="text-2xl font-semibold text-gray-900">{config?.fixedSplitRules ?? 0}</p>
              </div>
            </>
          )}
        </div>

        {/* Allocation history */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Allocation History</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
          {historyLoading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No allocations yet. Click <span className="font-medium text-indigo-500">New Allocation</span> to run your first one.
            </div>
          ) : (
            history.map((a, i) => (
              <div
                key={a.id}
                onClick={() => router.push("/review?period=" + a.period + "&t=" + Date.now())}
                className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar size={16} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(a.period + "-02").toLocaleString("default", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{a.description || "Division allocation"}</p>
                </div>
                <div className={"flex items-center gap-1.5 text-xs font-medium " + statusColor(a.status)}>
                  {statusIcon(a.status)}
                  <span>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                </div>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            ))
          )}
        </div>

        {/* Saved templates — placeholder for upcoming feature */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Saved Templates</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 text-center text-sm text-gray-400">
            Templates coming soon — save a set of allocation rules to reuse across periods.
          </div>
        </div>

      </div>
    </div>
  );
}
