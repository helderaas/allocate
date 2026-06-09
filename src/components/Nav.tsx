"use client";
import { useState, useEffect } from "react";
import { LogOut, ChevronDown, Building2, Plus, CreditCard } from "lucide-react";

interface Company {
  id: string;
  qbo_realm_id: string;
  company_name?: string;
  division_a_location_name?: string;
  division_b_location_name?: string;
}

export default function Nav() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string>("");
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe/subscription", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSubscriptionStatus(d.subscription?.subscription_status ?? null));
  }, []);

  const handleManageBilling = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST", credentials: "include" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      // No customer yet - go to checkout
      const checkoutRes = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      const checkoutData = await checkoutRes.json();
      if (checkoutData.url) window.location.href = checkoutData.url;
    }
  };

  useEffect(() => {
    fetch("/api/companies", { credentials: "include" })
      .then(r => r.json())
      .then(d => setCompanies(d.companies ?? []));

    // Get current tenant from cookie via a lightweight endpoint
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setCurrentTenantId(d.tenantId ?? ""));
  }, []);

  const currentCompany = companies.find(c => c.id === currentTenantId);

  const switchCompany = async (tenantId: string) => {
    setSwitching(true);
    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
      credentials: "include",
    });
    setSwitching(false);
    setShowSwitcher(false);
    window.location.href = "/dashboard";
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  const companyLabel = currentCompany?.company_name
    ?? currentCompany?.division_a_location_name
    ?? "My Company";

  const qboAuthUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  qboAuthUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
  qboAuthUrl.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
  qboAuthUrl.searchParams.set("response_type", "code");
  qboAuthUrl.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
  qboAuthUrl.searchParams.set("state", "allocate_connect");

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between relative">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-gray-900">Allocate</span>

        {/* Company switcher — only shows if firm has companies */}
        {companies.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
            >
              <Building2 size={14} className="text-indigo-500" />
              <span className="max-w-32 truncate">{companyLabel}</span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>

            {showSwitcher && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your companies</p>
                </div>
                {companies.map(c => (
                  <button
                    key={c.id}
                    onClick={() => switchCompany(c.id)}
                    disabled={switching}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                      c.id === currentTenantId ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      c.id === currentTenantId ? "bg-indigo-100" : "bg-gray-100"
                    }`}>
                      <Building2 size={13} className={c.id === currentTenantId ? "text-indigo-600" : "text-gray-400"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.company_name ?? c.division_a_location_name ?? "Unnamed Company"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {c.division_a_location_name && c.division_b_location_name
                          ? `${c.division_a_location_name} · ${c.division_b_location_name}`
                          : "Not configured"}
                      </p>
                    </div>
                    {c.id === currentTenantId && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                    )}
                  </button>
                ))}
                <div className="border-t border-gray-100">
                  <a
                    href={qboAuthUrl.toString()}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Plus size={14} /> Connect another company
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {subscriptionStatus === "active" && (
          <button onClick={handleManageBilling}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <CreditCard size={14} /> Billing
          </button>
        )}
        <button onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </nav>
  );
}


