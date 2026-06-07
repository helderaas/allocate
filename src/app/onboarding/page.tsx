"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QBOAccount, QBOLocation } from "@/types";
import { CheckSquare, Square, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";

type Step = "locations" | "accounts" | "splits" | "done";

interface SelectedAccount {
  account: QBOAccount;
  ruleType: "revenue_pct" | "fixed_split";
  fixedPctA: number;
}

function OnboardingContent() {
  const params = useSearchParams();
  const router = useRouter();
  const tenantIdParam = params.get("tenantId");
  const returnTo = params.get("returnTo");
  const errorParam = params.get("error");

  const [step, setStep] = useState<Step>("locations");
  const [locations, setLocations] = useState<QBOLocation[]>([]);
  const [accounts, setAccounts] = useState<QBOAccount[]>([]);
  const [divisionA, setDivisionA] = useState<QBOLocation | null>(null);
  const [divisionB, setDivisionB] = useState<QBOLocation | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const shouldLoad = (tenantIdParam && tenantIdParam !== "current") || returnTo === "dashboard";
    if (!shouldLoad) { setLoading(false); return; }

    async function load() {
      setLoading(true);

      // Load QBO data and saved config in parallel
      const [locRes, acctRes, configRes] = await Promise.all([
        fetch("/api/qbo/locations", { cache: "no-store" }),
        fetch("/api/qbo/accounts", { cache: "no-store" }),
        fetch("/api/onboarding/config", { cache: "no-store" }),
      ]);

      const { locations: locs } = await locRes.json();
      const { accounts: accts } = await acctRes.json();
      const { tenant, rules } = await configRes.json();

      const locList: QBOLocation[] = locs ?? [];
      const acctList: QBOAccount[] = accts ?? [];

      setLocations(locList);
      setAccounts(acctList);

      // Pre-populate divisions from saved tenant config
      if (tenant?.division_a_location_id) {
        const savedA = locList.find(l => l.Id === tenant.division_a_location_id);
        if (savedA) setDivisionA(savedA);
      }
      if (tenant?.division_b_location_id) {
        const savedB = locList.find(l => l.Id === tenant.division_b_location_id);
        if (savedB) setDivisionB(savedB);
      }

      // Pre-populate selected accounts from saved rules
      if (rules?.length) {
        const preSelected: SelectedAccount[] = rules
          .map((r: { qbo_account_id: string; rule_type: "revenue_pct" | "fixed_split"; fixed_pct_division_a: number | null }) => {
            const acct = acctList.find(a => a.Id === r.qbo_account_id);
            if (!acct) return null;
            return {
              account: acct,
              ruleType: r.rule_type,
              fixedPctA: r.fixed_pct_division_a ?? 50,
            };
          })
          .filter(Boolean) as SelectedAccount[];
        setSelectedAccounts(preSelected);
      }

      setLoading(false);
    }

    load();
  }, [tenantIdParam, returnTo]);

  const saveConfig = async () => {
    setSaving(true);
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
    setSaving(false);
    if (returnTo === "dashboard") {
      router.push("/dashboard");
    } else {
      setStep("done");
    }
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

  if (errorParam) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 font-medium">Connection failed: {errorParam}</p>
        <a href="/" className="mt-4 text-indigo-600 text-sm underline block">Try again</a>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} /> Loading your QBO data...
    </div>
  );

  const isEditMode = returnTo === "dashboard";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          {isEditMode ? "Edit allocation rules" : "Set up Allocate"}
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          {isEditMode
            ? "Your current configuration is pre-loaded. Make any changes and save."
            : "Configure your divisions and allocation rules."}
        </p>

        {/* Step 1 — Divisions */}
        {step === "locations" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-1">Step 1 — Select your two divisions</h2>
            <p className="text-sm text-gray-500 mb-4">Choose which QBO locations represent each division.</p>
            <div className="space-y-2 mb-6">
              {locations.map(loc => (
                <div key={loc.Id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <p className="flex-1 font-medium text-sm text-gray-900">{loc.Name}</p>
                  <button onClick={() => setDivisionA(loc)}
                    className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-colors " + (divisionA?.Id === loc.Id ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
                  >
                    {divisionA?.Id === loc.Id ? "✓ " : ""}Division A
                  </button>
                  <button onClick={() => setDivisionB(loc)}
                    className={"text-xs px-3 py-1.5 rounded-lg font-medium transition-colors " + (divisionB?.Id === loc.Id ? "bg-teal-100 text-teal-700 ring-1 ring-teal-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
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
            <h2 className="font-medium text-gray-900 mb-1">Step 2 — Select shared expense accounts</h2>
            <p className="text-sm text-gray-500 mb-1">Choose accounts whose expenses are split between divisions.</p>
            {selectedAccounts.length > 0 && (
              <p className="text-xs text-indigo-600 font-medium mb-3">
                {selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""} currently selected
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
                    className={"w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors " + (selected ? "bg-indigo-50" : "hover:bg-gray-50")}
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
              <button onClick={() => setStep("locations")}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Back
              </button>
              <button
                disabled={selectedAccounts.length === 0}
                onClick={() => setStep("splits")}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                {selectedAccounts.length} selected — set splits <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Splits */}
        {step === "splits" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-medium text-gray-900 mb-1">Step 3 — Set allocation rules</h2>
            <p className="text-sm text-gray-500 mb-4">Choose a rule for each account.</p>
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
              <button onClick={() => setStep("accounts")}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Back
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <>Save configuration <ChevronRight size={16} /></>}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Configuration saved!</h2>
            <p className="text-sm text-gray-500 mb-6">
              {selectedAccounts.length} accounts configured across {
                selectedAccounts.filter(s => s.ruleType === "revenue_pct").length
              } revenue % rules and {
                selectedAccounts.filter(s => s.ruleType === "fixed_split").length
              } fixed split rules.
            </p>
            <a href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700">
              Go to dashboard <ChevronRight size={16} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
// v5

