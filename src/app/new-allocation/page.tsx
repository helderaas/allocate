"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QBOAccount, QBOLocation } from "@/types";
import {
  CheckSquare, Square, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, ArrowRight, Calendar,
} from "lucide-react";

type Step = "locations" | "accounts" | "splits" | "dates";
type DatePreset = "last_month" | "this_month" | "custom";

interface SelectedAccount {
  account: QBOAccount;
  ruleType: "revenue_pct" | "fixed_split";
  fixedPctA: number;
}

function NewAllocationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const templateId = params.get("templateId");

  const [step, setStep] = useState<Step>("locations");
  const [locations, setLocations] = useState<QBOLocation[]>([]);
  const [accounts, setAccounts] = useState<QBOAccount[]>([]);
  const [divisionA, setDivisionA] = useState<QBOLocation | null>(null);
  const [divisionB, setDivisionB] = useState<QBOLocation | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dates step state
  const [datePreset, setDatePreset] = useState<DatePreset>("last_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jeDate, setJeDate] = useState("");
  const [description, setDescription] = useState("");
  const [journalNumber, setJournalNumber] = useState("");
  const [showDateOptions, setShowDateOptions] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  // Load QBO data (and optionally a template)
  useEffect(() => {
    async function load() {
      setLoading(true);
      const fetches: Promise<Response>[] = [
        fetch("/api/qbo/locations", { cache: "no-store" }),
        fetch("/api/qbo/accounts", { cache: "no-store" }),
      ];
      if (templateId) {
        fetches.push(fetch("/api/allocations/templates", { cache: "no-store" }));
      }

      const results = await Promise.all(fetches);
      const { locations: locs } = await results[0].json();
      const { accounts: accts } = await results[1].json();

      const locList: QBOLocation[] = locs ?? [];
      const acctList: QBOAccount[] = accts ?? [];
      setLocations(locList);
      setAccounts(acctList);

      if (templateId && results[2]) {
        const { templates } = await results[2].json();
        const tmpl = (templates ?? []).find((t: { id: string }) => t.id === templateId);
        if (tmpl) {
          // Pre-fill accounts from template
          const preSelected: SelectedAccount[] = (tmpl.rules ?? [])
            .map((r: { qbo_account_id: string; rule_type: "revenue_pct" | "fixed_split"; fixed_pct_division_a: number | null }) => {
              const acct = acctList.find(a => a.Id === r.qbo_account_id);
              if (!acct) return null;
              return { account: acct, ruleType: r.rule_type, fixedPctA: r.fixed_pct_division_a ?? 50 };
            })
            .filter(Boolean) as SelectedAccount[];
          setSelectedAccounts(preSelected);
        }
      }

      // Also pre-fill divisions from saved config (convenience)
      const configRes = await fetch("/api/onboarding/config", { cache: "no-store" });
      const { tenant } = await configRes.json();
      if (tenant?.division_a_location_id) {
        const a = locList.find(l => l.Id === tenant.division_a_location_id);
        if (a) setDivisionA(a);
      }
      if (tenant?.division_b_location_id) {
        const b = locList.find(l => l.Id === tenant.division_b_location_id);
        if (b) setDivisionB(b);
      }

      setLoading(false);
    }
    load();
  }, [templateId]);

  // Apply date preset
  useEffect(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    if (datePreset === "last_month") {
      setStartDate(fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
      setEndDate(fmt(new Date(today.getFullYear(), today.getMonth(), 0)));
    } else if (datePreset === "this_month") {
      setStartDate(fmt(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEndDate(fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [datePreset]);

  const saveConfigAndRun = async () => {
    if (!startDate || !endDate) { setRunError("Please select a period."); return; }
    setRunning(true);
    setRunError("");

    // 1. Save the configuration as the active tenant config
    await fetch("/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        divisionAId: divisionA?.Id,
        divisionAName: divisionA?.Name,
        divisionBId: divisionB?.Id,
        divisionBName: divisionB?.Name,
        rules: selectedAccounts.map(s => ({
          qbo_account_id: s.account.Id,
          qbo_account_name: s.account.FullyQualifiedName,
          rule_type: s.ruleType,
          fixed_pct_division_a: s.fixedPctA,
        })),
      }),
    });

    // 2. Run the allocation
    const period = startDate.slice(0, 7);
    const periodLabel = new Date(startDate + "T12:00:00").toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    const res = await fetch("/api/allocations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period,
        startDate,
        endDate,
        jeDate: jeDate || endDate,
        description: description || `Division allocation - ${periodLabel}`,
        journalNumber,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRunError(data.error ?? "Something went wrong");
      setRunning(false);
      return;
    }
    router.push("/review?period=" + period + "&t=" + Date.now());
  };

  const toggleAccount = (acct: QBOAccount) => {
    setSelectedAccounts(prev => {
      const exists = prev.find(s => s.account.Id === acct.Id);
      if (exists) return prev.filter(s => s.account.Id !== acct.Id);
      return [...prev, { account: acct, ruleType: "revenue_pct", fixedPctA: 50 }];
    });
  };

  const filteredAccounts = accounts.filter(a =>
    a.FullyQualifiedName.toLowerCase().includes(search.toLowerCase())
  );

  const period = startDate ? startDate.slice(0, 7) : "";
  const periodLabel = startDate
    ? new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })
    : "Select a period";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      {templateId ? "Loading template..." : "Loading QBO data..."}
    </div>
  );

  const stepLabels: Record<Step, string> = {
    locations: "Divisions",
    accounts: "Accounts",
    splits: "Rules",
    dates: "Dates",
  };
  const stepOrder: Step[] = ["locations", "accounts", "splits", "dates"];
  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {stepOrder.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                i < currentStepIndex
                  ? "bg-green-100 text-green-700"
                  : i === currentStepIndex
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {i < currentStepIndex && <CheckCircle2 size={12} />}
                {stepLabels[s]}
              </div>
              {i < stepOrder.length - 1 && (
                <ChevronRight size={14} className="text-gray-300" />
              )}
            </div>
          ))}
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          {templateId ? "New Allocation (from template)" : "New Allocation"}
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          {step === "locations" && "Choose which QBO locations represent each division."}
          {step === "accounts" && "Choose accounts whose expenses are split between divisions."}
          {step === "splits" && "Set an allocation rule for each account."}
          {step === "dates" && "Choose the period to allocate."}
        </p>

        {/* Step 1 — Divisions */}
        {step === "locations" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-4">Select your two divisions</h2>
            <div className="space-y-2 mb-6">
              {locations.map(loc => (
                <div key={loc.Id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <p className="flex-1 font-medium text-sm text-gray-900">{loc.Name}</p>
                  <button
                    onClick={() => setDivisionA(loc)}
                    className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-colors " +
                      (divisionA?.Id === loc.Id
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                  >
                    {divisionA?.Id === loc.Id ? "✓ " : ""}Division A
                  </button>
                  <button
                    onClick={() => setDivisionB(loc)}
                    className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-colors " +
                      (divisionB?.Id === loc.Id
                        ? "bg-teal-100 text-teal-700 ring-1 ring-teal-300"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                  >
                    {divisionB?.Id === loc.Id ? "✓ " : ""}Division B
                  </button>
                </div>
              ))}
            </div>
            {divisionA && divisionB && (
              <div className="flex gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-4">
                <span className="text-blue-600 font-medium">Div A: {divisionA.Name}</span>
                <span className="text-gray-300">·</span>
                <span className="text-teal-600 font-medium">Div B: {divisionB.Name}</span>
              </div>
            )}
            <button
              disabled={!divisionA || !divisionB || divisionA.Id === divisionB.Id}
              onClick={() => setStep("accounts")}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
            >
              Next: pick accounts <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2 — Accounts */}
        {step === "accounts" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-1">Select shared expense accounts</h2>
            {selectedAccounts.length > 0 && (
              <p className="text-xs text-indigo-600 font-medium mb-3">
                {selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""} selected
              </p>
            )}
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 text-sm border border-gray-200 rounded-xl"
            />
            <div className="space-y-0.5 max-h-96 overflow-y-auto mb-6 border border-gray-100 rounded-xl divide-y divide-gray-50">
              {filteredAccounts.map(acct => {
                const selected = selectedAccounts.some(s => s.account.Id === acct.Id);
                return (
                  <button
                    key={acct.Id}
                    onClick={() => toggleAccount(acct)}
                    className={"w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors " +
                      (selected ? "bg-indigo-50" : "hover:bg-gray-50")}
                  >
                    {selected
                      ? <CheckSquare size={18} className="text-indigo-600 shrink-0" />
                      : <Square size={18} className="text-gray-300 shrink-0" />}
                    <div className="min-w-0">
                      <p className={"text-sm font-medium truncate " + (acct.SubAccount ? "pl-3 text-gray-600" : "text-gray-900")}>
                        {acct.SubAccount ? "↳ " : ""}{acct.FullyQualifiedName}
                      </p>
                      <p className="text-xs text-gray-400">{acct.AccountType}</p>
                    </div>
                    {selected && <CheckCircle2 size={14} className="text-indigo-400 shrink-0 ml-auto" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("locations")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                disabled={selectedAccounts.length === 0}
                onClick={() => setStep("splits")}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                {selectedAccounts.length} selected — set rules <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Splits */}
        {step === "splits" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-4">Set allocation rules</h2>
            <div className="space-y-2 mb-6 max-h-[500px] overflow-y-auto pr-1">
              {selectedAccounts.map(s => (
                <div key={s.account.Id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <p className="flex-1 text-sm font-medium text-gray-900 truncate min-w-0">
                    {s.account.FullyQualifiedName}
                  </p>
                  <select
                    value={s.ruleType}
                    onChange={e => setSelectedAccounts(prev => prev.map(a =>
                      a.account.Id === s.account.Id
                        ? { ...a, ruleType: e.target.value as "revenue_pct" | "fixed_split" }
                        : a
                    ))}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shrink-0"
                  >
                    <option value="revenue_pct">Revenue %</option>
                    <option value="fixed_split">Fixed split</option>
                  </select>
                  {s.ruleType === "fixed_split" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number" min={0} max={100} value={s.fixedPctA}
                        onChange={e => setSelectedAccounts(prev => prev.map(a =>
                          a.account.Id === s.account.Id
                            ? { ...a, fixedPctA: Number(e.target.value) }
                            : a
                        ))}
                        className="w-14 text-xs text-center border border-gray-200 rounded-lg px-1 py-1.5"
                      />
                      <span className="text-xs text-gray-400">/ {100 - s.fixedPctA}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("accounts")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep("dates")}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                Next: choose dates <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Dates */}
        {step === "dates" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-indigo-500" /> Choose period
            </h2>

            {/* Presets */}
            <div className="flex gap-2 mb-4">
              {(["last_month", "this_month", "custom"] as DatePreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => setDatePreset(p)}
                  className={"px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors " +
                    (datePreset === p
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300")}
                >
                  {p === "last_month" ? "Last Month" : p === "this_month" ? "This Month" : "Custom"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period start</label>
                <input
                  type="date" value={startDate}
                  onChange={e => { setStartDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period end</label>
                <input
                  type="date" value={endDate}
                  onChange={e => { setEndDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={() => setShowDateOptions(!showDateOptions)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mb-3 block"
            >
              {showDateOptions ? "Hide options" : "Show options (JE date, memo, journal number)"}
            </button>

            {showDateOptions && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Journal entry date</label>
                  <input
                    type="date" value={jeDate}
                    onChange={e => setJeDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-400 mt-1">Defaults to period end if blank.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Journal number (optional)</label>
                  <input
                    type="text" value={journalNumber}
                    onChange={e => setJournalNumber(e.target.value)}
                    placeholder="e.g. JE-2026-05"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Description / memo</label>
                  <input
                    type="text" value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={startDate ? `Division allocation - ${periodLabel}` : "e.g. May 2026 Division Allocation"}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            )}

            {runError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">{runError}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("splits")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={saveConfigAndRun}
                disabled={running || !startDate || !endDate}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                {running
                  ? <><Loader2 size={16} className="animate-spin" /> Calculating...</>
                  : <><ArrowRight size={16} /> Run {periodLabel}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewAllocationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    }>
      <NewAllocationContent />
    </Suspense>
  );
}
// v1
