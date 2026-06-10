"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { LogOut, ChevronDown, Building2, Plus, CreditCard, Wifi, WifiOff, Trash2, RefreshCw, AlertTriangle, X } from "lucide-react";

interface Company {
  id: string;
  qbo_realm_id: string;
  company_name?: string;
  division_a_location_name?: string;
  division_b_location_name?: string;
  qbo_connected?: boolean;
}

type ConfirmAction = { type: "disconnect" | "cancel"; company: Company } | null;

export default function Nav() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string>("");
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      const checkoutRes = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      const checkoutData = await checkoutRes.json();
      if (checkoutData.url) window.location.href = checkoutData.url;
    }
  };

  const loadCompanies = () => {
    fetch("/api/companies", { credentials: "include" })
      .then(r => r.json())
      .then(d => setCompanies(d.companies ?? []));
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setCurrentTenantId(d.tenantId ?? ""));
  };

  useEffect(() => { loadCompanies(); }, []);

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

  const handleDisconnect = async (company: Company) => {
    setActionLoading(true);
    await fetch("/api/companies/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTenantId: company.id }),
      credentials: "include",
    });
    setConfirmAction(null);
    setActionLoading(false);
    setShowSwitcher(false);
    loadCompanies();
    window.location.href = "/dashboard";
  };

  const handleCancel = async (company: Company) => {
    setActionLoading(true);
    await fetch("/api/companies/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTenantId: company.id }),
      credentials: "include",
    });
    setConfirmAction(null);
    setActionLoading(false);
    setShowSwitcher(false);
    loadCompanies();
    window.location.href = "/dashboard";
  };

  const handleReconnect = async (company: Company) => {
    const res = await fetch("/api/companies/reconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTenantId: company.id }),
      credentials: "include",
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
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

  const companyName = (c: Company) => c.company_name ?? c.division_a_location_name ?? "Unnamed Company";

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between relative">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image src="/allocate-logo-primary.svg" alt="Allocate" width={160} height={36} priority />
          </a>

          {companies.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
              >
                <Building2 size={14} className={currentCompany?.qbo_connected === false ? "text-gray-400" : "text-brand-500"} />
                <span className="max-w-32 truncate">{companyLabel}</span>
                {currentCompany?.qbo_connected === false && (
                  <span className="text-xs text-amber-500 bg-amber-50 px-1 rounded">Disconnected</span>
                )}
                <ChevronDown size={13} className="text-gray-400" />
              </button>

              {showSwitcher && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Your companies</p>
                  </div>
                  {companies.map(c => (
                    <div key={c.id} className={`border-b border-gray-50 last:border-0 ${c.id === currentTenantId ? "bg-brand-50" : ""}`}>
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <button onClick={() => switchCompany(c.id)} disabled={switching} className="flex items-center gap-2.5 flex-1 text-left">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.id === currentTenantId ? "bg-brand-100" : "bg-gray-100"}`}>
                            {c.qbo_connected === false
                              ? <WifiOff size={13} className="text-gray-400" />
                              : <Building2 size={13} className={c.id === currentTenantId ? "text-brand-600" : "text-gray-400"} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{companyName(c)}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {c.qbo_connected === false ? "Disconnected · Read only" : (
                                c.division_a_location_name && c.division_b_location_name
                                  ? `${c.division_a_location_name} · ${c.division_b_location_name}`
                                  : "Connected"
                              )}
                            </p>
                          </div>
                          {c.id === currentTenantId && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
                        </button>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {c.qbo_connected === false ? (
                            <>
                              <button onClick={() => handleReconnect(c)} title="Reconnect QBO"
                                className="p-1 text-brand-400 hover:text-brand-600 hover:bg-brand-50 rounded">
                                <RefreshCw size={13} />
                              </button>
                              <button onClick={() => setConfirmAction({ type: "cancel", company: c })} title="Cancel & delete"
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setConfirmAction({ type: "disconnect", company: c })} title="Disconnect QBO"
                                className="p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                                <WifiOff size={13} />
                              </button>
                              <button onClick={() => setConfirmAction({ type: "cancel", company: c })} title="Cancel & delete"
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-100">
                    <a href={qboAuthUrl.toString()}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-brand-600 hover:bg-brand-50 transition-colors">
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

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle size={18} />
                <h2 className="text-base font-semibold text-gray-900">
                  {confirmAction.type === "disconnect" ? "Disconnect QuickBooks?" : "Cancel & delete company?"}
                </h2>
              </div>
              <button onClick={() => setConfirmAction(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              <strong>{companyName(confirmAction.company)}</strong>
            </p>

            {confirmAction.type === "disconnect" ? (
              <div className="text-sm text-gray-600 space-y-2 mb-6">
                <p>This will disconnect QuickBooks from this company. You will:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500">
                  <li>Keep all allocation history (read-only)</li>
                  <li>Be billed $5/month instead of $17/month</li>
                  <li>Be able to reconnect at any time</li>
                </ul>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-2 mb-6">
                <p className="font-medium text-red-600">⚠️ This action is permanent and cannot be undone.</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500">
                  <li>All allocation history will be deleted</li>
                  <li>All templates and rules will be deleted</li>
                  <li>Reconnecting later will start a completely new database</li>
                  <li>No deleted information can be recovered</li>
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Keep it
              </button>
              <button
                onClick={() => confirmAction.type === "disconnect"
                  ? handleDisconnect(confirmAction.company)
                  : handleCancel(confirmAction.company)
                }
                disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white ${
                  confirmAction.type === "disconnect"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-red-600 hover:bg-red-700"
                } disabled:opacity-60`}
              >
                {actionLoading ? "Processing..." : confirmAction.type === "disconnect" ? "Disconnect" : "Cancel & delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
