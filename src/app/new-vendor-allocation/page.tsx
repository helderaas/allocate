"use client";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronRight, ChevronLeft, Loader2, CheckCircle2,
  ArrowRight, Calendar, Trash2, Plus, Search,
} from "lucide-react";

type Step = "divisions" | "vendor" | "splits" | "dates";
type DatePreset = "last_month" | "this_month" | "custom";
type TrackingType = "location" | "class";

interface QBOLocation { Id: string; Name: string; }
interface QBOClass { Id: string; Name: string; }
interface Vendor { Id: string; DisplayName: string; }

interface SelectedDivision {
  id: string;
  name: string;
  qbo_location_id?: string;
  qbo_class_id?: string;
}

interface AccountPreview {
  id: string;
  accountName: string;
  total: number;
}

function NewVendorAllocationContent() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("divisions");
  const [trackingType, setTrackingType] = useState<TrackingType>("location");
  const [locations, setLocations] = useState<QBOLocation[]>([]);
  const [classes, setClasses] = useState<QBOClass[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<SelectedDivision[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [splitMap, setSplitMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [previewAccounts, setPreviewAccounts] = useState<AccountPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      const [locsRes, classesRes, vendorsRes, divsRes] = await Promise.all([
        fetch("/api/qbo/locations", { cache: "no-store" }),
        fetch("/api/qbo/classes", { cache: "no-store" }),
        fetch("/api/qbo/vendors", { cache: "no-store" }),
        fetch("/api/divisions", { cache: "no-store" }),
      ]);
      const { locations: locs } = await locsRes.json();
      const { classes: cls } = await classesRes.json();
      const { vendors: vends } = await vendorsRes.json();
      const { divisions: savedDivs, trackingType: savedType } = await divsRes.json();

      setLocations(locs ?? []);
      setClasses(cls ?? []);
      setVendors(vends ?? []);

      if (savedDivs?.length > 0) {
        setSelectedDivisions(savedDivs.map((d: SelectedDivision) => ({
          id: d.id, name: d.name,
          qbo_location_id: d.qbo_location_id,
          qbo_class_id: d.qbo_class_id,
        })));
        setTrackingType(savedType ?? "location");
      }
      setLoading(false);
    }
    load();
  }, []);

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

  // Initialize equal split when divisions change
  useEffect(() => {
    if (selectedDivisions.length === 0) return;
    const equal = Math.round(100 / selectedDivisions.length);
    const map: Record<string, number> = {};
    selectedDivisions.forEach((d, i) => {
      map[d.id] = i === selectedDivisions.length - 1
        ? 100 - equal * (selectedDivisions.length - 1)
        : equal;
    });
    setSplitMap(map);
  }, [selectedDivisions.length]);

  // Preview accounts when vendor + dates are both set
  useEffect(() => {
    if (!selectedVendor || !startDate || !endDate) { setPreviewAccounts([]); return; }
    setPreviewLoading(true);
    fetch(`/api/qbo/vendor-transactions?vendorId=${selectedVendor.Id}&vendorName=${encodeURIComponent(selectedVendor.DisplayName)}&startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => { setPreviewAccounts(d.accounts ?? []); setPreviewLoading(false); })
      .catch(() => setPreviewLoading(false));
  }, [selectedVendor, startDate, endDate]);

  const addDivision = () => setSelectedDivisions(prev => [...prev, { id: `new-${Date.now()}`, name: "" }]);
  const removeDivision = (id: string) => setSelectedDivisions(prev => prev.filter(d => d.id !== id));
  const updateDivision = (id: string, updates: Partial<SelectedDivision>) =>
    setSelectedDivisions(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

  const items = trackingType === "location" ? locations : classes;
  const canProceedDivisions = selectedDivisions.length >= 1 && selectedDivisions.every(d => d.qbo_location_id || d.qbo_class_id);
  const splitTotal = Object.values(splitMap).reduce((sum, v) => sum + v, 0);

  const filteredVendors = vendors.filter(v =>
    v.DisplayName.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const periodLabel = startDate
    ? new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })
    : "Select a period";

  const runAllocation = async () => {
    if (!selectedVendor || !startDate || !endDate) { setRunError("Please select a vendor and period."); return; }
    if (Math.abs(splitTotal - 100) > 0.5) { setRunError("Split percentages must add up to 100%."); return; }
    setRunning(true); setRunError("");

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

    const period = startDate.slice(0, 7);
    const res = await fetch("/api/allocations/run-vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: selectedVendor.Id,
        vendorName: selectedVendor.DisplayName,
        period, startDate, endDate,
        jeDate: jeDate || endDate,
        description: description || `Vendor allocation - ${selectedVendor.DisplayName} - ${periodLabel}`,
        journalNumber,
        splitMap,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setRunError(data.error ?? "Something went wrong"); setRunning(false); return; }
    router.push("/review?period=" + period + "&t=" + Date.now() + "&type=vendor");
  };

  const stepOrder: Step[] = ["divisions", "vendor", "splits", "dates"];
  const stepLabels: Record<Step, string> = {
    divisions: trackingType === "location" ? "Locations" : "Classes",
    vendor: "Vendor",
    splits: "Splits",
    dates: "Dates",
  };
  const currentStepIndex = stepOrder.indexOf(step);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} />
      Loading QuickBooks Online data...
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Image src="/allocate-logo-primary.svg" alt="Allocate" width={120} height={28} priority />
        <button onClick={() => router.push("/dashboard")} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {stepOrder.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                i < currentStepIndex ? "bg-brand-200 text-brand-sage" :
                i === currentStepIndex ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {i < currentStepIndex && <CheckCircle2 size={12} />}
                {stepLabels[s]}
              </div>
              {i < stepOrder.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          ))}
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">New Vendor Allocation</h1>
        <p className="text-gray-500 mb-8 text-sm">
          {step === "divisions" && "Choose which locations or departments to allocate vendor expenses across."}
          {step === "vendor" && "Select the vendor whose transactions you want to allocate."}
          {step === "splits" && "Set the percentage split across your divisions."}
          {step === "dates" && "Choose the period to allocate."}
        </p>

        {/* Step 1 — Divisions */}
        {step === "divisions" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">My shared expenses are organized by:</p>
              <div className="flex gap-2">
                {(["location", "class"] as TrackingType[]).map(t => (
                  <button key={t} onClick={() => setTrackingType(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      trackingType === t
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
                    }`}>
                    {t === "location" ? "Location / Department" : "Class"}
                  </button>
                ))}
              </div>
            </div>

            <h2 className="font-medium text-gray-900 mb-3">
              Select your {trackingType === "location" ? "locations / departments" : "classes"}{" "}
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

            <button onClick={addDivision}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium mb-6">
              <Plus size={14} /> Add another {trackingType === "location" ? "location" : "class"}
            </button>

            <button disabled={!canProceedDivisions} onClick={() => setStep("vendor")}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
              Next: pick vendor <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2 — Vendor picker */}
        {step === "vendor" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-4">Select a vendor</h2>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Search vendors..."
                value={vendorSearch} onChange={e => setVendorSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
            <div className="space-y-0.5 max-h-96 overflow-y-auto mb-6 border border-gray-100 rounded-xl divide-y divide-gray-50">
              {filteredVendors.map(v => (
                <button key={v.Id} onClick={() => setSelectedVendor(v)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    selectedVendor?.Id === v.Id ? "bg-brand-50" : "hover:bg-gray-50"
                  }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.DisplayName}</p>
                  </div>
                  {selectedVendor?.Id === v.Id && <CheckCircle2 size={14} className="text-brand-400 shrink-0" />}
                </button>
              ))}
              {filteredVendors.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No vendors found</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("divisions")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                <ChevronLeft size={16} /> Back
              </button>
              <button disabled={!selectedVendor} onClick={() => setStep("splits")}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                {selectedVendor ? `"${selectedVendor.DisplayName}" — set splits` : "Select a vendor"} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Splits */}
        {step === "splits" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-1">Set split percentages</h2>
            <p className="text-sm text-gray-500 mb-6">
              These percentages apply to all expense accounts for <span className="font-medium text-gray-800">{selectedVendor?.DisplayName}</span>.
            </p>

            <div className="space-y-3 mb-6">
              {selectedDivisions.map((div, di) => {
                const isLast = di === selectedDivisions.length - 1;
                const otherSum = selectedDivisions
                  .filter((_, j) => j !== di)
                  .reduce((sum, d) => sum + (splitMap[d.id] ?? 0), 0);
                const autoVal = Math.max(0, 100 - otherSum);
                return (
                  <div key={div.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100">
                    <span className="flex-1 text-sm font-medium text-gray-800">{div.name}</span>
                    {isLast ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-16 text-sm text-center px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-500">{autoVal}</span>
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={0} max={100}
                          value={splitMap[div.id] ?? 0}
                          onChange={e => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value)));
                            setSplitMap(prev => ({ ...prev, [div.id]: val }));
                          }}
                          className="w-16 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-400"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {Math.abs(splitTotal - 100) > 0.5 && (
                <p className="text-xs text-red-500">Splits must add up to 100% (currently {splitTotal}%)</p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("vendor")}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                <ChevronLeft size={16} /> Back
              </button>
              <button disabled={Math.abs(splitTotal - 100) > 0.5} onClick={() => setStep("dates")}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                Next: choose dates <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Dates */}
        {step === "dates" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-brand-500" /> Choose period
            </h2>
            <div className="flex gap-2 mb-4">
              {(["last_month", "this_month", "custom"] as DatePreset[]).map(p => (
                <button key={p} onClick={() => setDatePreset(p)}
                  className={"px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors " +
                    (datePreset === p ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200 hover:border-brand-300")}>
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

            {/* Account preview */}
            {selectedVendor && startDate && endDate && (
              <div className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Accounts to be allocated for <span className="text-gray-900">{selectedVendor.DisplayName}</span>:
                </p>
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <Loader2 size={12} className="animate-spin" /> Loading transactions...
                  </div>
                ) : previewAccounts.length === 0 ? (
                  <p className="text-xs text-amber-600">No transactions found for this vendor in this period.</p>
                ) : (
                  <div className="space-y-1">
                    {previewAccounts.map(a => (
                      <div key={a.id} className="flex justify-between text-xs">
                        <span className="text-gray-700">{a.accountName}</span>
                        <span className="text-gray-900 font-medium">${a.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold border-t border-gray-200 pt-1 mt-1">
                      <span className="text-gray-700">Total</span>
                      <span className="text-gray-900">${previewAccounts.reduce((s, a) => s + a.total, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setShowDateOptions(!showDateOptions)}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium mb-3 block">
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
                    placeholder={selectedVendor ? `Vendor allocation - ${selectedVendor.DisplayName} - ${periodLabel}` : ""}
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
              <button onClick={runAllocation}
                disabled={running || !startDate || !endDate || previewAccounts.length === 0}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                {running
                  ? <><Loader2 size={16} className="animate-spin" /> Calculating...</>
                  : previewAccounts.length === 0 && startDate && endDate
                    ? "No transactions found"
                    : <><ArrowRight size={16} /> Run {periodLabel}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewVendorAllocationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>}>
      <NewVendorAllocationContent />
    </Suspense>
  );
}
