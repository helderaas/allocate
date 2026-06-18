"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AllocationDraft, AllocationLine } from "@/types";
import { isIncomeAccount } from "@/lib/allocation-engine";
import {
  CheckCircle, XCircle, Loader2, ArrowLeft,
  ChevronDown, ChevronUp, BookmarkPlus, X, Lock, AlertCircle,
} from "lucide-react";

interface Division {
  id: string;
  name: string;
  qbo_location_id?: string | null;
  qbo_class_id?: string | null;
}

// N-division line: division_amounts is a map of divisionId -> editable amount
interface EditableLine extends AllocationLine {
  description: string;
  division_amounts_edited: Record<string, number>;
  // division_amounts from engine (original calculated values)
  division_amounts?: Record<string, number>;
}

const DIVISION_COLORS = [
  "text-brand-600",
  "text-teal-600",
  "text-brand-600",
  "text-orange-600",
  "text-pink-600",
  "text-sky-600",
];

function fmt(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const period = params.get("period");
  const t = params.get("t");
  const allocationType = params.get("type") ?? "account";

  const [draft, setDraft] = useState<AllocationDraft | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");
  const [jeDate, setJeDate] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [journalNumber, setJournalNumber] = useState("");
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({});

  const [amendNote, setAmendNote] = useState("");
  const [showAmendNote, setShowAmendNote] = useState(false);

  const isLocked = !!(draft?.locked_at);
  const isPosted = draft?.status === "posted";

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState("");
  const [templateSaved, setTemplateSaved] = useState(false);

  useEffect(() => {
    async function load() {
      if (!period) return;
      setLoading(true);
      setDraft(null);
      setLines([]);

      const [draftRes, divsRes] = await Promise.all([
        fetch("/api/allocations/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period }),
        }),
        fetch("/api/divisions", { cache: "no-store" }),
      ]);

      const draftData = await draftRes.json();
      const { divisions: divRows } = await divsRes.json();
      const divList: Division[] = divRows ?? [];
      setDivisions(divList);

      if (draftData.draft) {
        setDraft(draftData.draft);
        setJeDate(draftData.draft.je_date || "");
        setDefaultDescription(draftData.draft.description || "");
        setJournalNumber(draftData.draft.journal_number || "");

        const rawLines: (AllocationLine & { division_amounts?: Record<string, number> })[] =
          typeof draftData.draft.lines === "string"
            ? JSON.parse(draftData.draft.lines)
            : draftData.draft.lines;

        setLines(rawLines.map(l => {
          // Build editable amounts map from N-division data or fall back to legacy 2-div fields
          const baseAmounts: Record<string, number> = l.division_amounts
            ? { ...l.division_amounts }
            : {
                [divList[0]?.id ?? "div-a"]: l.division_a_amount,
                [divList[1]?.id ?? "div-b"]: l.division_b_amount,
              };
          return {
            ...l,
            description: draftData.draft.description || "",
            division_amounts_edited: baseAmounts,
          };
        }));
      }
      setLoading(false);
    }
    load();
  }, [period, t]);

  const updateAmount = (lineIndex: number, divisionId: string, value: number) => {
    setLines(prev => prev.map((l, i) =>
      i === lineIndex
        ? { ...l, division_amounts_edited: { ...l.division_amounts_edited, [divisionId]: value } }
        : l
    ));
  };

  const updateDescription = (lineIndex: number, value: string) => {
    setLines(prev => prev.map((l, i) => i === lineIndex ? { ...l, description: value } : l));
  };

  const applyDescriptionToAll = () => {
    setLines(prev => prev.map(l => ({ ...l, description: defaultDescription })));
  };

  const toggleLine = (index: number) => {
    setExpandedLines(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Totals: sum all division debit amounts per line
  const lineTotal = (l: EditableLine) =>
    Object.values(l.division_amounts_edited).reduce((s, v) => s + (v || 0), 0);

  const totalDebits = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const totalCredits = totalDebits; // credits always equal debits (offset line)
  const isBalanced = true; // credit line = sum of debits, always balanced

  const handleReject = () => {
    router.push(allocationType === "vendor" ? "/new-vendor-allocation" : "/new-allocation");
  };

  const approve = async () => {
    if (!draft) return;
    setPosting(true);
    setError("");

    // Merge edited amounts back into lines for the API
    const updatedLines = lines.map(l => ({
      ...l,
      division_amounts: l.division_amounts_edited,
      // Keep legacy fields in sync for backwards compat
      division_a_amount: Object.values(l.division_amounts_edited)[0] ?? l.division_a_amount,
      division_b_amount: Object.values(l.division_amounts_edited)[1] ?? l.division_b_amount,
    }));

    const res = await fetch("/api/allocations/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: draft.id,
        jeDate,
        description: defaultDescription,
        journalNumber,
        lines: updatedLines,
        note: amendNote || undefined,
      }),
    });

    if (res.ok) {
      setPosted(true);
    } else {
      const data = await res.json();
      if (data.qbo_reconnect_required) {
        setError("Your QuickBooks connection has expired. Please go back to the dashboard and reconnect QuickBooks.");
      } else {
        setError(data.error ?? "Something went wrong");
      }
    }
    setPosting(false);
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) { setSaveTemplateError("Please enter a name."); return; }
    setSavingTemplate(true);
    setSaveTemplateError("");

    let rules;
    if (allocationType === "vendor" && draft) {
      // For vendor templates: save vendor list + split percentages from the draft lines
      const firstLine = (draft.lines as unknown as { vendor_name?: string; division_amounts?: Record<string, number>; total_amount?: number }[])?.[0];
      const vendorNames = draft.vendor_name ? draft.vendor_name.split(", ") : [];
      const splitMap: Record<string, number> = {};
      if (firstLine?.division_amounts && firstLine.total_amount) {
        for (const [divId, amt] of Object.entries(firstLine.division_amounts)) {
          splitMap[divId] = Math.round((amt / firstLine.total_amount) * 100);
        }
      }
      rules = [{ vendor_names: vendorNames, splitMap }];
    } else {
      const configRes = await fetch("/api/onboarding/config", { cache: "no-store" });
      const config = await configRes.json();
      rules = config.rules;
    }

    const res = await fetch("/api/allocations/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName, rules, allocation_type: allocationType }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveTemplateError(data.error ?? "Failed to save");
      setSavingTemplate(false);
      return;
    }
    setSavingTemplate(false);
    setTemplateSaved(true);
    setTimeout(() => {
      setShowSaveModal(false);
      setTemplateSaved(false);
      setTemplateName("");
    }, 1500);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-gray-500">
      <Loader2 className="animate-spin" size={20} /> Loading draft...
    </div>
  );

  if (posted) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-brand-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-brand-sage" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Journal entry posted!</h2>
        <p className="text-gray-500 text-sm mb-6">The allocation has been posted to QuickBooks.</p>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );

  if (!draft) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Draft not found.</div>
  );

  const periodLabel = period
    ? new Date(period + "-02").toLocaleString("default", { month: "long", year: "numeric" })
    : period;

  // JE lines count: each account = N debit lines + 1 credit line
  const totalJELines = lines.length * (divisions.length + 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-10 px-4">
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Review allocation</h1>
            <p className="text-gray-500 text-sm mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            <button
              onClick={() => { setShowSaveModal(true); setSaveTemplateError(""); setTemplateName(""); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-brand-200 bg-brand-50 hover:bg-brand-100 rounded-xl text-sm font-medium text-brand-700"
            >
              <BookmarkPlus size={16} /> Save configuration
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <XCircle size={16} /> {allocationType === "vendor" ? "Edit vendor" : "Edit accounts"}
            </button>
            <button
              onClick={approve}
              disabled={posting || isLocked}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm"
              title={isLocked ? "Unlock this entry from the History page to make changes" : ""}
            >
              {posting ? <Loader2 size={16} className="animate-spin" /> : isLocked ? <Lock size={16} /> : <CheckCircle size={16} />}
              {posting ? "Posting..." : isLocked ? "Locked" : isPosted ? "Amend & repost to QBO" : "Approve & post to QBO"}
            </button>
          </div>
        </div>

        {/* Save template modal */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Save this configuration</h2>
                <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              {templateSaved ? (
                <div className="flex flex-col items-center py-4 gap-3 text-brand-sage">
                  <CheckCircle size={32} />
                  <p className="text-sm font-medium">Template saved!</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Give this configuration a name so you can reuse it for future allocations.
                  </p>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveAsTemplate()}
                    placeholder="e.g. Month End Allocation"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 mb-3 focus:outline-none focus:border-brand-400"
                    autoFocus
                  />
                  {saveTemplateError && <p className="text-xs text-red-500 mb-3">{saveTemplateError}</p>}
                  <button
                    onClick={saveAsTemplate}
                    disabled={savingTemplate}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                  >
                    {savingTemplate ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
                    {savingTemplate ? "Saving..." : "Save template"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Locked banner */}
        {isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3 text-amber-700 text-sm">
            <Lock size={16} className="shrink-0" />
            <span>This allocation is <strong>locked</strong>. To make changes, unlock it from the History page first.</span>
          </div>
        )}

        {/* Amend note */}
        {isPosted && !isLocked && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-blue-700 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} />
              <span className="font-medium">You are amending a posted entry.</span>
            </div>
            <p className="text-xs text-blue-600 mb-2">The existing QBO journal entry will be voided and a new one posted. This is logged in the audit trail.</p>
            <input
              type="text"
              value={amendNote}
              onChange={e => setAmendNote(e.target.value)}
              placeholder="Reason for amendment (optional)"
              className="w-full text-xs border border-blue-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>
        )}

        {/* JE details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Journal entry details</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Journal entry date</label>
              <input type="date" value={jeDate} onChange={e => setJeDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Journal number (optional)</label>
              <input type="text" value={journalNumber} onChange={e => setJournalNumber(e.target.value)}
                placeholder="e.g. JE-2026-05"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-500">Default description (applies to all lines)</label>
              <button onClick={applyDescriptionToAll}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                Apply to all lines
              </button>
            </div>
            <input type="text" value={defaultDescription}
              onChange={e => setDefaultDescription(e.target.value)}
              placeholder="e.g. May 2026 Division Allocation"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">JE lines</p>
            <p className="text-2xl font-semibold text-gray-900">{totalJELines}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total debits</p>
            <p className="text-2xl font-semibold text-brand-sage">{fmt(totalDebits)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total credits</p>
            <p className="text-2xl font-semibold text-red-500">{fmt(totalCredits)}</p>
          </div>
        </div>

        {/* Lines table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <span className="col-span-3">Account</span>
            <span className="col-span-2">Location</span>
            <span className="col-span-4">Description</span>
            <span className="col-span-1 text-right">Debit</span>
            <span className="col-span-1 text-right">Credit</span>
            <span className="col-span-1"></span>
          </div>

          {lines.map((line, i) => {
            const creditAmount = lineTotal(line);
            return (
              <div key={i} className="border-b border-gray-100 last:border-0">

                {/* One debit row per division */}
                {divisions.map((div, di) => {
                  const amount = line.division_amounts_edited[div.id] ?? 0;
                  const colorClass = DIVISION_COLORS[di % DIVISION_COLORS.length];
                  return (
                    <div key={div.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50 ${di % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <span className="col-span-3 text-sm font-medium text-gray-900 truncate">
                        {di === 0 ? line.account_name : ""}
                      </span>
                      <span className={`col-span-2 text-sm font-medium ${colorClass} truncate`}>{div.name}</span>
                      <div className="col-span-4">
                        {di === 0 && (
                          <input
                            type="text"
                            value={line.description}
                            onChange={e => updateDescription(i, e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-400"
                            placeholder="Line description..."
                          />
                        )}
                      </div>
                      <div className="col-span-1">
                        {isIncomeAccount(line.account_type) ? (
                          <span className="w-full text-xs text-right block text-gray-300">—</span>
                        ) : (
                          <input
                            type="number"
                            value={amount}
                            onChange={e => updateAmount(i, div.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-400 text-brand-sage"
                          />
                        )}
                      </div>
                      <div className="col-span-1">
                        {isIncomeAccount(line.account_type) ? (
                          <input
                            type="number"
                            value={amount}
                            onChange={e => updateAmount(i, div.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-400 text-red-500"
                          />
                        ) : (
                          <span className="text-sm text-right text-gray-300 block">—</span>
                        )}
                      </div>
                      {di === 0 ? (
                        <button
                          onClick={() => toggleLine(i)}
                          className="col-span-1 flex justify-end text-gray-300 hover:text-gray-500"
                        >
                          {expandedLines[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      ) : (
                        <span className="col-span-1" />
                      )}
                    </div>
                  );
                })}

                {/* Credit row — untagged offset, no location */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-gray-100/60">
                  <span className="col-span-3 text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                  <span className="col-span-2 text-xs text-gray-400 italic">{isIncomeAccount(line.account_type) ? "Untagged debit offset" : "Untagged offset"}</span>
                  <div className="col-span-4">
                    <span className="text-xs text-gray-400">{line.description}</span>
                  </div>
                  <span className="col-span-1 text-sm text-right text-gray-300">
                    {isIncomeAccount(line.account_type) ? creditAmount.toFixed(2) : "—"}
                  </span>
                  <span className={`col-span-1 text-xs text-right font-medium pr-1 ${isIncomeAccount(line.account_type) ? "text-gray-300" : "text-red-500"}`}>
                    {isIncomeAccount(line.account_type) ? "—" : creditAmount.toFixed(2)}
                  </span>
                  <span className="col-span-1" />
                </div>

                {/* Expanded breakdown */}
                {expandedLines[i] && (
                  <div className="px-4 py-3 bg-brand-50 border-t border-brand-100 space-y-2">
                    <div className="flex gap-4 flex-wrap text-xs text-brand-700 mb-2">
                      <span>Rule: {line.rule_type === "revenue_pct" ? "Revenue %" : "Fixed split"}</span>
                      {divisions.map((div, di) => {
                        const pct = line.rule_type === "revenue_pct"
                          ? (di === 0 ? line.division_a_pct : line.division_b_pct)
                          : null;
                        return (
                          <span key={div.id}>
                            {div.name}: {pct !== null ? pct.toFixed(1) + "%" : fmt(line.division_amounts_edited[div.id] ?? 0)}
                          </span>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg px-3 py-2 border border-brand-100">
                        <p className="text-xs text-gray-400 mb-0.5">Total GL balance</p>
                        <p className="text-sm font-semibold text-gray-900">{fmt(line.total_amount ?? 0)}</p>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-brand-100 col-span-2">
                        <p className="text-xs text-gray-400 mb-1">Already tagged (not reallocated)</p>
                        <div className="flex gap-3 flex-wrap">
                          {divisions.map((div, di) => {
                            const tagged = di === 0
                              ? (line.already_tagged_a ?? 0)
                              : di === 1
                                ? (line.already_tagged_b ?? 0)
                                : 0;
                            const colorClass = DIVISION_COLORS[di % DIVISION_COLORS.length];
                            return (
                              <span key={div.id} className={`text-xs font-medium ${colorClass}`}>
                                {div.name}: {fmt(tagged)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-brand-100 col-span-3">
                        <p className="text-xs text-gray-400 mb-0.5">Being allocated (untagged)</p>
                        <p className="text-sm font-semibold text-brand-600">{fmt(line.untagged_amount ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spacing at bottom */}
        <div className="h-12" />
      </div>
    </div>
  );
}

function ReviewPageInner() {
  const params = useSearchParams();
  const t = params.get("t") ?? "0";
  return <ReviewContent key={t} />;
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    }>
      <ReviewPageInner />
    </Suspense>
  );
}
// v12
