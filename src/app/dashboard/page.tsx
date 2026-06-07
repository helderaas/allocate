"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ArrowRight, CheckCircle, Clock, Settings, Loader2, AlertCircle } from "lucide-react";

interface ConfigStats {
  totalAccounts: number;
  revenuePctRules: number;
  fixedSplitRules: number;
  divisionAName: string;
  divisionBName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [config, setConfig] = useState<ConfigStats | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Dates start empty — user must choose
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jeDate, setJeDate] = useState("");
  const [description, setDescription] = useState("");
  const [journalNumber, setJournalNumber] = useState("");

  // Load live config stats on mount
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
      } catch {
        // non-blocking — stats just won't show
      }
      setConfigLoading(false);
    }
    loadConfig();
  }, []);

  const period = startDate ? startDate.slice(0, 7) : "";
  const periodLabel = startDate
    ? new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })
    : "Select a period";

  const defaultDescription = startDate
    ? "Division allocation - " + periodLabel
    : "";

  const canRun = !!startDate && !!endDate && (config?.totalAccounts ?? 0) > 0;

  const runAllocation = async () => {
    if (!startDate || !endDate) {
      setError("Please select a period start and end date.");
      return;
    }
    setRunning(true);
    setError("");
    const res = await fetch("/api/allocations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period,
        startDate,
        endDate,
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <a href="/onboarding?returnTo=dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <Settings size={14} /> Settings
        </a>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            {config && (
              <p className="text-gray-500 text-sm mt-0.5">
                {config.divisionAName} · {config.divisionBName}
              </p>
            )}
          </div>
          <button
            onClick={runAllocation}
            disabled={running || !canRun}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm"
          >
            {running
              ? <><Loader2 size={16} className="animate-spin" /><span>Calculating...</span></>
              : <><span>{"Run " + periodLabel}</span><ArrowRight size={16} /></>}
          </button>
        </div>

        {/* Config stats — live from DB */}
        <div className="grid grid-cols-3 gap-4 mb-6">
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

        {/* No rules warning */}
        {!configLoading && (config?.totalAccounts ?? 0) === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3 text-amber-700 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>No accounts configured yet. <a href="/onboarding?returnTo=dashboard" className="underline font-medium">Go to Settings</a> to set up your allocation rules before running.</span>
          </div>
        )}

        {/* Allocation settings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Allocation period</h2>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showOptions ? "Hide options" : "Show options"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period start <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period end <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-2">Select the date range for this allocation run.</p>

          {showOptions && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 mt-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Journal entry date</label>
                <input
                  type="date"
                  value={jeDate}
                  onChange={e => setJeDate(e.target.value)}
                  placeholder="Defaults to period end"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to period end date if blank.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Journal number (optional)</label>
                <input
                  type="text"
                  value={journalNumber}
                  onChange={e => setJournalNumber(e.target.value)}
                  placeholder="e.g. JE-2026-05"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description / memo</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={defaultDescription || "e.g. May 2026 Division Allocation"}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>
        )}

        {/* Allocation history — placeholder until wired to real data */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Allocation history</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 text-center text-sm text-gray-400">
            Allocation history coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}
