"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QBOAccount, QBOLocation } from "@/types";
import {
  CheckSquare, Square, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, ArrowRight, Calendar, Plus, Trash2,
} from "lucide-react";

type Step = "divisions" | "accounts" | "splits" | "dates";
type DatePreset = "last_month" | "this_month" | "custom";
type TrackingType = "location" | "class";

interface QBOClass {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  Active: boolean;
}

interface SelectedDivision {
  id: string; // temp client ID
  name: string;
  qbo_location_id?: string;
  qbo_class_id?: string;
}

interface SelectedAccount {
  account: QBOAccount;
  ruleType: "revenue_pct" | "fixed_split";
  fixedPctMap: Record<string, number>; // divisionId -> %
}

function NewAllocationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const templateId = params.get("templateId");
  const stepParam = params.get("step");

  const [step, setStep] = useState<Step>("divisions");
  const [locations, setLocations] = useState<QBOLocation[]>([]);
  const [classes, setClasses] = useState<QBOClass[]>([]);
  const [accounts, setAccounts] = useState<QBOAccount[]>([]);
  const [trackingType, setTrackingType] = useState<TrackingType>("location");
  const [selectedDivisions, setSelectedDivisions] = useState<SelectedDivision[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dates
  const [datePreset, setDatePreset] = useState<DatePreset>("last_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jeDate, setJeDate] = useState("");
  const [description, setDescription] = useState("");
  const [journalNumber, setJournalNumber] = useState("");
  const [showDateOptions, setShowDateOptions] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [locsRes, classesRes, acctRes] = await Promise.all([
        fetch("/api/qbo/locations", { cache: "no-store" }),
        fetch("/api/qbo/classes", { cache: "no-store" }),
        fetch("/api/qbo/accounts", { cache: "no-store" }),
      ]);
      const { locations: locs } = await locsRes.json();
      const { classes: cls } = await classesRes.json();
      const { accounts: accts } = await acctRes.json();
      setLocations(locs ?? []);
      setClasses(cls ?? []);
      setAccounts(accts ?? []);

      if (templateId) {
        const tmplRes = await fetch("/api/allocations/templates", { cache: "no-store" });
        const { templates } = await tmplRes.json();
        const tmpl = (templates ?? []).find((t: { id: string }) => t.id === templateId);
        if (tmpl) {
          const preSelected = (tmpl.rules ?? [])
            .map((r: { qbo_account_id: string; rule_type: "revenue_pct" | "fixed_split"; fixed_pct_map?: Record<string, number>; fixed_pct_division_a: number | null }) => {
              const acct = (accts ?? []).find((a: QBOAccount) => a.Id === r.qbo_account_id);
              if (!acct) return null;
              return { account: acct, ruleType: r.rule_type, fixedPctMap: r.fixed_pct_map ?? {} };
            })
            .filter(Boolean) as SelectedAccount[];
          setSelectedAccounts(preSelected);
        }
      }

      // Load saved divisions
      const divsRes = await fetch("/api/divisions", { cache: "no-store" });
      const { divisions: savedDivs, trackingType: savedType } = await divsRes.json();
      if (savedDivs?.length > 0) {
        setSelectedDivisions(savedDivs.map((d: { id: string; name: string; qbo_location_id?: string; qbo_class_id?: string }) => ({
          id: d.id, name: d.name,
          qbo_location_id: d.qbo_location_id,
          qbo_class_id: d.qbo_class_id,
        })));
        setTrackingType(savedType ?? "location");
      }

      setLoading(false);
    }
    load();
  }, [templateId]);

  useEffect(() => {
    if (!loading && stepParam === "dates") setStep("dates");
  }, [loading, stepParam]);

  useEffect(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    if (datePreset === "last_month") {
      setStartDate(fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)));
      setEndDate(fmt(new Date(today.getFullYear(), today.getMonth(), 0)));
    } else if (datePreset === "this_month") {
      setStartDate(fmt(new Date(today.getFullYear(), today.getMonth(), 1)));
      setEndDate(fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    }
  }, [datePreset]);

  const addDivision = () => {
    setSelectedDivisions(prev => [...prev, {
      id: `new-${Date.now()}`,
      name: "",
      qbo_location_id: undefined,
      qbo_class_id: undefined,
    }]);
  };

  const removeDivision = (id: string) => {
    setSelectedDivisions(prev => prev.filter(d => d.id !== id));
  };

  const updateDivision = (id: string, updates: Partial<SelectedDivision>) => {
    setSelectedDivisions(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const items = trackingType === "location" ? locations : classes;

  const saveConfigAndRun = async () => {
    if (!startDate || !endDate) { setRunError("Please select a period."); return; }
    setRunning(true);
    setRunError("");

    // Save divisions
    await fetch("/api/divisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackingType,
        divisions: selectedDivisions.map(d => ({
          name: d.name,
          qbo_location_id: trackingType === "location" ? d.qbo_location_id : null,
          qbo_class_id: trackingType === "class" ? d.qbo_class_id : null,
        })),
      }),
    });

    // Save allocation rules
    await fetch("/api/onboarding/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        divisionAId: trackingType === "location" ? selectedDivisions[0]?.qbo_location_id : null,
        divisionAName: selectedDivisions[0]?.name,
        divisionBId: trackingType === "location" ? selectedDivisions[1]?.qbo_location_id : null,
        divisionBName: selectedDivisions[1]?.name,
        rules: selectedAccounts.map(s => ({
          qbo_account_id: s.account.Id,
          qbo_account_name: s.account.FullyQualifiedName,
          rule_type: s.ruleType,
          account_type: s.account.AccountType,
          fixed_pct_map: s.ruleType === "fixed_split" ? s.fixedPctMap : null,
          fixed_pct_division_a: s.ruleType === "fixed_split"
            ? (s.fixedPctMap[selectedDivisions[0]?.id] ?? 50)
            : null,
        })),
      }),
    });

    const period = startDate.slice(0, 7);
    const periodLabel = new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" });
    const res = await fetch("/api/allocations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period, startDate, endDate,
        jeDate: jeDate || endDate,
        description: description || `Division allocation - ${periodLabel}`,
        journalNumber,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setRunError(data.error ?? "Something went wrong"); setRunning(false); return; }
    router.push("/review?period=" + period + "&t=" + Date.now());
  };

  const toggleAccount = (acct: QBOAccount) => {
    setSelectedAccounts(prev => {
      const exists = prev.find(s => s.account.Id === acct.Id);
      if (exists) return prev.filter(s => s.account.Id !== acct.Id);
      // Initialize equal split across current divisions
      const equalPct = Math.round(100 / Math.max(selectedDivisions.length, 1));
      const map: Record<string, number> = {};
      selectedDivisions.forEach((d, i) => {
        map[d.id] = i === selectedDivisions.length - 1
          ? 100 - equalPct * (selectedDivisions.length - 1)
          : equalPct;
      });
      return [...prev, { account: acct, ruleType: "revenue_pct", fixedPctMap: map }];
    });
  };

  const filteredAccounts = accounts.filter(a =>
    a.FullyQualifiedName.toLowerCase().includes(search.toLowerCase())
  );

  const periodLabel = startDate
    ? new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })
    : "Select a period";

  const stepOrder: Step[] = ["divisions", "accounts", "splits", "dates"];
  const stepLabels: Record<Step, string> = {
    divisions: trackingType === "location" ? "Locations" : "Classes",
    accounts: "Accounts",
    splits: "Rules",
    dates: "Dates",
  };
  const currentStepIndex = stepOrder.indexOf(step);
  const canProceedDivisions = selectedDivisions.length >= 1 && selectedDivisions.every(d => d.qbo_location_id || d.qbo_class_id);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      {templateId ? "Loading template..." : "Loading QBO data..."}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {stepOrder.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                i < currentStepIndex ? "bg-green-100 text-green-700" :
                i === currentStepIndex ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {i < currentStepIndex && <CheckCircle2 size={12} />}
                {stepLabels[s]}
              </div>
              {i < stepOrder.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          ))}
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          {templateId ? "New Allocation (from template)" : "New Allocation"}
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          {step === "divisions" && (trackingType === "location"
            ? "Choose which locations or departments to allocate expenses across."
            : "Choose which classes to allocate expenses across.")}
          {step === "accounts" && "Choose accounts whose expenses are shared across your locations."}
          {step === "splits" && "Set an allocation rule for each account."}
          {step === "dates" && "Choose the period to allocate."}
        </p>

        {/* Step 1 — Divisions */}
        {step === "divisions" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            {/* Tracking type toggle */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">My shared expenses are organized by:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTrackingType("location")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    trackingType === "location"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  Location / Department
                </button>
                <button
                  onClick={() => setTrackingType("class")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    trackingType === "class"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  Class
                </button>
              </div>
            </div>

            <h2 className="font-medium text-gray-900 mb-3">
              {trackingType === "location"
                ? "Select your locations / departments"
                : "Select your classes"}{" "}
              <span className="text-xs text-gray-400 font-normal">(minimum 1)</span>
            </h2>

            <div className="space-y-3 mb-4">
              {selectedDivisions.map((div, idx) => (
                <div key={div.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-400 w-4 shrink-0">{idx + 1}</span>
                  <select
                    value={trackingType === "location" ? div.qbo_location_id ?? "" : div.qbo_class_id ?? ""}
                    onChange={e => {
                      const selected = items.find(i => i.Id === e.target.value);
                      updateDivision(div.id, {
                        qbo_location_id: trackingType === "location" ? e.target.value : undefined,
                        qbo_class_id: trackingType === "class" ? e.target.value : undefined,
                        name: selected?.Name ?? div.name,
                      });
                    }}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="">Select {trackingType === "location" ? "location / department" : "class"}...</option>
                    {items.map(item => (
                      <option key={item.Id} value={item.Id}>{item.Name}</option>
                    ))}
                  </select>
                  {selectedDivisions.length > 1 && (
                    <button onClick={() => removeDivision(div.id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addDivision}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-6"
            >
              <Plus size={14} /> Add another {trackingType === "location" ? "location" : "class"}
            </button>

            <button
              disabled={!canProceedDivisions}
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
              type="text" placeholder="Search accounts..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 text-sm border border-gray-200 rounded-xl"
            />
            <div className="space-y-0.5 max-h-96 overflow-y-auto mb-6 border border-gray-100 rounded-xl divide-y divide-gray-50">
              {filteredAccounts.map(acct => {
                const selected = selectedAccounts.some(s => s.account.Id === acct.Id);
                return (
                  <button key={acct.Id} onClick={() => toggleAccount(acct)}
                    className={"w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors " + (selected ? "bg-indigo-50" : "hover:bg-gray-50")}>
                    {selected ? <CheckSquare size={18} className="text-indigo-600 shrink-0" /> : <Square size={18} className="text-gray-300 shrink-0" />}
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
              <button onClick={() => setStep("divisions")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                <ChevronLeft size={16} /> Back
              </button>
              <button disabled={selectedAccounts.length === 0} onClick={() => setStep("splits")}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
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
                  <p className="flex-1 text-sm font-medium text-gray-900 truncate min-w-0">{s.account.FullyQualifiedName}</p>
                  <select
                    value={s.ruleType}
                    onChange={e => setSelectedAccounts(prev => prev.map(a =>
                      a.account.Id === s.account.Id ? { ...a, ruleType: e.target.value as "revenue_pct" | "fixed_split" } : a
                    ))}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white shrink-0"
                  >
                    <option value="revenue_pct">Revenue %</option>
                    <option value="fixed_split">Fixed split</option>
                  </select>
                  {s.ruleType === "fixed_split" && (
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {selectedDivisions.map((div, di) => {
                        const isLast = di === selectedDivisions.length - 1;
                        // Last division auto-calculates to make sum = 100
                        const otherSum = selectedDivisions
                          .filter((_, j) => j !== di)
                          .reduce((sum, d) => sum + (s.fixedPctMap[d.id] ?? 0), 0);
                        const autoVal = Math.max(0, 100 - otherSum);
                        return (
                          <div key={div.id} className="flex items-center gap-0.5">
                            <span className="text-xs text-gray-400 whitespace-nowrap">{div.name}:</span>
                            {isLast ? (
                              <span className="w-12 text-xs text-center px-1 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-500">
                                {autoVal}
                              </span>
                            ) : (
                              <input
                                type="number" min={0} max={100}
                                value={s.fixedPctMap[div.id] ?? 0}
                                onChange={e => {
                                  const val = Math.min(100, Math.max(0, Number(e.target.value)));
                                  setSelectedAccounts(prev => prev.map(a =>
                                    a.account.Id === s.account.Id
                                      ? { ...a, fixedPctMap: { ...a.fixedPctMap, [div.id]: val } }
                                      : a
                                  ));
                                }}
                                className="w-12 text-xs text-center border border-gray-200 rounded-lg px-1 py-1.5 focus:outline-none focus:border-indigo-400"
                              />
                            )}
                            <span className="text-xs text-gray-400">%</span>
                            {di < selectedDivisions.length - 1 && <span className="text-gray-200 mx-0.5">/</span>}
                          </div>
                        );
                      })}
                      {/* Warn if doesn't sum to 100 */}
                      {(() => {
                        const allButLast = selectedDivisions.slice(0, -1).reduce((sum, d) => sum + (s.fixedPctMap[d.id] ?? 0), 0);
                        return allButLast > 100 ? <span className="text-xs text-red-500 ml-1">exceeds 100%</span> : null;
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("accounts")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setStep("dates")}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
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
            <div className="flex gap-2 mb-4">
              {(["last_month", "this_month", "custom"] as DatePreset[]).map(p => (
                <button key={p} onClick={() => setDatePreset(p)}
                  className={"px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors " +
                    (datePreset === p ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300")}>
                  {p === "last_month" ? "Last Month" : p === "this_month" ? "This Month" : "Custom"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period start</label>
                <input type="date" value={startDate}
                  onChange={e => { setStartDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period end</label>
                <input type="date" value={endDate}
                  onChange={e => { setEndDate(e.target.value); setDatePreset("custom"); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
            </div>
            <button onClick={() => setShowDateOptions(!showDateOptions)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mb-3 block">
              {showDateOptions ? "Hide options" : "Show options (JE date, memo, journal number)"}
            </button>
            {showDateOptions && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Journal entry date</label>
                  <input type="date" value={jeDate} onChange={e => setJeDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                  <p className="text-xs text-gray-400 mt-1">Defaults to period end.</p>
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
                    placeholder={startDate ? `Division allocation - ${periodLabel}` : "e.g. May 2026 Division Allocation"}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
                </div>
              </div>
            )}
            {runError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">{runError}</div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep("splits")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={saveConfigAndRun} disabled={running || !startDate || !endDate}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                {running ? <><Loader2 size={16} className="animate-spin" /> Calculating...</> : <><ArrowRight size={16} /> Run {periodLabel}</>}
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>}>
      <NewAllocationContent />
    </Suspense>
  );
}
// v3
