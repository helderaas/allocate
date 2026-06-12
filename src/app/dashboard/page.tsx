"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import UpgradeWall from "@/components/UpgradeWall";
import {
  Calendar, CheckCircle, Clock,
  Loader2, Plus, ChevronRight, BookOpen, Trash2, Play, X, XCircle, History,
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

interface Template {
  id: string;
  name: string;
  rules: {
    qbo_account_id: string;
    qbo_account_name: string;
    rule_type: string;
    fixed_pct_division_a: number | null;
  }[];
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [allHistory, setAllHistory] = useState<AllocationDraftRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>("loading");
  const [isFirmOnly, setIsFirmOnly] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    fetch("/api/stripe/subscription", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setSubscriptionStatus(d.subscription?.subscription_status ?? "inactive");
        setIsFirmOnly(d.subscription?.is_firm_only ?? false);
      });
    fetch("/api/companies", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const tenantId = document.cookie.split("; ").find(c => c.startsWith("tenant_id="))?.split("=")[1];
        const current = (d.companies ?? []).find((c: { id: string; company_name?: string }) => c.id === tenantId);
        setCompanyName(current?.company_name ?? "");
      });
  }, []);

  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("fresh");
  const [error, setError] = useState("");
  const [qboReconnectRequired, setQboReconnectRequired] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/allocations/history?t=" + Date.now(), { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setAllHistory(data.drafts ?? []);
      } else {
        console.error("History API error:", data);
      }
    } catch (e) { console.error("History fetch error:", e); }
    finally { setHistoryLoading(false); }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/allocations/templates", { cache: "no-store" });
      if (res.ok) {
        const { templates: t } = await res.json();
        setTemplates(t ?? []);
      }
    } catch { /* non-blocking */ }
    setTemplatesLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    loadTemplates();

    // Re-fetch when tab becomes visible (handles returning from review page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Small delay to allow replica to catch up
        setTimeout(() => {
          loadHistory();
          loadTemplates();
        }, 1500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadHistory, loadTemplates]);

  // Split history into drafts and posted/voided
  const draftEntries = allHistory.filter(a => a.status === "draft").slice(0, 3);
  const postedEntries = allHistory.filter(a => a.status === "posted" || a.status === "voided").slice(0, 5);
  const hasMoreHistory = allHistory.filter(a => a.status === "posted" || a.status === "voided").length > 5;

  const handleNewAllocation = () => {
    setSelectedTemplateId("fresh");
    setError("");
    setShowLaunchModal(true);
  };

  const handleLaunchContinue = () => {
    if (selectedTemplateId === "fresh") {
      router.push("/new-allocation");
    } else {
      router.push(`/new-allocation?templateId=${selectedTemplateId}&step=dates`);
    }
    setShowLaunchModal(false);
  };

  const deleteTemplate = async (id: string) => {
    await fetch("/api/allocations/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadTemplates();
  };

  const voidAllocation = async (draftId: string) => {
    if (!draftId) { setError("Invalid allocation ID"); return; }
    setVoidingId(draftId);
    setError("");
    setQboReconnectRequired(false);
    try {
      const res = await fetch("/api/allocations/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      let data: { error?: string; qbo_reconnect_required?: boolean } = {};
      try { data = await res.json(); } catch { /* empty response */ }
      if (!res.ok) {
        if (data.qbo_reconnect_required) {
          setQboReconnectRequired(true);
          setError("Your QuickBooks connection has expired. Please reconnect QuickBooks.");
        } else {
          setError(data.error || `Void failed (status ${res.status}). Check your QBO connection.`);
        }
      } else {
        setTimeout(() => loadHistory(), 500);
      }
    } catch (e) {
      setError("Network error — could not reach the server. Please try again.");
      console.error("Void error:", e);
    }
    setVoidingId(null);
    setShowVoidConfirm(null);
  };

  const periodLabel = (period: string) =>
    new Date(period + "-02").toLocaleString("default", { month: "long", year: "numeric" });

  // Show loading spinner while checking subscription
  if (subscriptionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  // Show upgrade wall for inactive/canceled subscriptions
  if (subscriptionStatus !== "active") {
    return <UpgradeWall />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{companyName ? `${companyName} Dashboard` : "Dashboard"}</h1>
          <button
            onClick={handleNewAllocation}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm"
          >
            <Plus size={16} /> New Allocation
          </button>
        </div>



        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-red-700 text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            {qboReconnectRequired && (() => {
              const url = new URL("https://appcenter.intuit.com/connect/oauth2");
              url.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
              url.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
              url.searchParams.set("response_type", "code");
              url.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
              url.searchParams.set("state", "allocate_connect");
              return (
                <a href={url.toString()}
                  className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">
                  Reconnect QuickBooks
                </a>
              );
            })()}
          </div>
        )}

        {/* Launch modal */}
        {showLaunchModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">New Allocation</h2>
                <button onClick={() => setShowLaunchModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Start fresh with a blank setup, or pre-fill from a saved template.
              </p>
              <div className="space-y-2 mb-6">
                <button
                  onClick={() => setSelectedTemplateId("fresh")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    selectedTemplateId === "fresh"
                      ? "border-brand-400 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
                    <Plus size={16} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Start fresh</p>
                    <p className="text-xs text-gray-400">Choose divisions, accounts, and rules from scratch</p>
                  </div>
                  {selectedTemplateId === "fresh" && (
                    <CheckCircle size={16} className="text-brand-500 ml-auto shrink-0" />
                  )}
                </button>

                {templatesLoading ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-gray-400 text-sm">
                    <Loader2 size={14} className="animate-spin" /> Loading templates...
                  </div>
                ) : templates.length > 0 ? (
                  templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                        selectedTemplateId === t.id
                          ? "border-brand-400 bg-brand-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen size={15} className="text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.rules.length} account{t.rules.length !== 1 ? "s" : ""}</p>
                      </div>
                      {selectedTemplateId === t.id && (
                        <CheckCircle size={16} className="text-brand-500 shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No saved templates yet.</p>
                )}
              </div>
              <button
                onClick={handleLaunchContinue}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium text-sm"
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Saved Templates */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Saved Templates</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
          {templatesLoading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              No templates yet. Run an allocation and save the configuration from the review screen.
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen size={15} className="text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.rules.length} account{t.rules.length !== 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={() => { setSelectedTemplateId(t.id); setShowLaunchModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg"
                >
                  <Play size={12} /> Use
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* In Progress — drafts */}
        {!historyLoading && draftEntries.length > 0 && (
          <>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">In Progress</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
              {draftEntries.map(a => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Clock size={15} className="text-amber-500" />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => router.push("/review?period=" + a.period + "&t=" + Date.now())}
                  >
                    <p className="text-sm font-medium text-gray-900">{periodLabel(a.period)}</p>
                    <p className="text-xs text-gray-400 truncate">{a.description || "Division allocation"}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-500">Draft</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch("/api/allocations/draft", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ draftId: a.id }),
                      });
                      setTimeout(() => loadHistory(), 500);
                    }}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                    title="Delete draft"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight
                    size={14}
                    className="text-gray-300 cursor-pointer"
                    onClick={() => router.push("/review?period=" + a.period + "&t=" + Date.now())}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Recent Posted */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Recent Allocations</h2>
          <button
            onClick={() => router.push("/history")}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <History size={13} /> View full history
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          {historyLoading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : postedEntries.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No posted allocations yet.</div>
          ) : (
            postedEntries.map(a => (
              <div key={a.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  a.status === "posted" ? "bg-brand-200/30" : "bg-gray-100"
                }`}>
                  <Calendar size={15} className={a.status === "posted" ? "text-brand-sage" : "text-gray-400"} />
                </div>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => router.push("/review?period=" + a.period + "&t=" + Date.now())}
                >
                  <p className={`text-sm font-medium ${a.status === "voided" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {periodLabel(a.period)}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{a.description || "Division allocation"}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                  a.status === "posted" ? "text-brand-sage" : "text-gray-400"
                }`}>
                  {a.status === "posted" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                </div>
                {a.status === "posted" && (
                  showVoidConfirm === a.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Mark as voided? (also void manually in QBO)</span>
                      <button
                        onClick={() => voidAllocation(a.id)}
                        disabled={voidingId === a.id}
                        className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-60"
                      >
                        {voidingId === a.id ? <Loader2 size={10} className="animate-spin" /> : "Confirm"}
                      </button>
                      <button
                        onClick={() => setShowVoidConfirm(null)}
                        className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowVoidConfirm(a.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <XCircle size={11} /> Void
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </div>

        {hasMoreHistory && (
          <button
            onClick={() => router.push("/history")}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <History size={14} /> View all posted allocations
          </button>
        )}
      </div>
    </div>
  );
}
// v11



