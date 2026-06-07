"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, ArrowRight, CheckCircle, Clock, Settings,
  Loader2, Plus, ChevronRight, BookOpen, Trash2, Play, X,
} from "lucide-react";

interface AllocationDraftRow {
  id: string;
  period: string;
  status: string;
  created_at: string;
  total_debits: number;
  total_credits: number;
  description: string;
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
  const [history, setHistory] = useState<AllocationDraftRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // "New Allocation" launch modal state
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("fresh");
  const [runningTemplateId, setRunningTemplateId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/allocations/history", { cache: "no-store" });
      if (res.ok) {
        const { drafts } = await res.json();
        setHistory(drafts ?? []);
      }
    } catch { /* non-blocking */ }
    setHistoryLoading(false);
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
  }, [loadHistory, loadTemplates]);

  const handleNewAllocation = () => {
    setSelectedTemplateId("fresh");
    setError("");
    setShowLaunchModal(true);
  };

  const handleLaunchContinue = () => {
    if (selectedTemplateId === "fresh") {
      // Go to setup wizard with no pre-population
      router.push("/new-allocation");
    } else {
      // Go to setup wizard pre-filled from template
      router.push(`/new-allocation?templateId=${selectedTemplateId}`);
    }
  };

  const deleteTemplate = async (id: string) => {
    await fetch("/api/allocations/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadTemplates();
  };

  const statusColor = (s: string) =>
    s === "posted" ? "text-green-600" : "text-amber-500";
  const statusIcon = (s: string) =>
    s === "posted" ? <CheckCircle size={14} /> : <Clock size={14} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <a
          href="/onboarding?returnTo=dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Settings size={14} /> Settings
        </a>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <button
            onClick={handleNewAllocation}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm"
          >
            <Plus size={16} /> New Allocation
          </button>
        </div>

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

              {/* Options */}
              <div className="space-y-2 mb-6">
                <button
                  onClick={() => setSelectedTemplateId("fresh")}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    selectedTemplateId === "fresh"
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                    <Plus size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Start fresh</p>
                    <p className="text-xs text-gray-400">Choose divisions, accounts, and rules from scratch</p>
                  </div>
                  {selectedTemplateId === "fresh" && (
                    <CheckCircle size={16} className="text-indigo-500 ml-auto shrink-0" />
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
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen size={15} className="text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.rules.length} account{t.rules.length !== 1 ? "s" : ""}</p>
                      </div>
                      {selectedTemplateId === t.id && (
                        <CheckCircle size={16} className="text-indigo-500 shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No saved templates yet.</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm">{error}</div>
              )}

              <button
                onClick={handleLaunchContinue}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm"
              >
                Continue <ArrowRight size={16} />
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
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen size={15} className="text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.rules.length} account{t.rules.length !== 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedTemplateId(t.id);
                    setShowLaunchModal(true);
                  }}
                  disabled={runningTemplateId === t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg"
                >
                  {runningTemplateId === t.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  Use
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

        {/* Allocation History */}
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Allocation History</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {historyLoading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No allocations yet.</div>
          ) : (
            history.map(a => (
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
                    {new Date(a.period + "-02").toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
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
      </div>
    </div>
  );
}
// v5
