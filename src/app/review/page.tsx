"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AllocationDraft, AllocationLine } from "@/types";
import {
  CheckCircle, XCircle, Loader2, ArrowLeft,
  ChevronDown, ChevronUp, BookmarkPlus, X, Lock, AlertCircle,
} from "lucide-react";

interface EditableLine extends AllocationLine {
  division_a_description: string;
  division_b_description: string;
  division_a_amount_edited: number;
  division_b_amount_edited: number;
}

function ReviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const period = params.get("period");
  const t = params.get("t");

  const [draft, setDraft] = useState<AllocationDraft | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
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

  // Derived: is this entry locked?
  const isLocked = !!(draft?.locked_at);
  const isPosted = draft?.status === "posted";

  // Save-as-template state
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
      const res = await fetch("/api/allocations/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (data.draft) {
        setDraft(data.draft);
        setJeDate(data.draft.je_date || "");
        setDefaultDescription(data.draft.description || "");
        setJournalNumber(data.draft.journal_number || "");
        const rawLines: AllocationLine[] = typeof data.draft.lines === "string"
          ? JSON.parse(data.draft.lines)
          : data.draft.lines;
        setLines(rawLines.map(l => ({
          ...l,
          division_a_description: data.draft.description || "",
          division_b_description: data.draft.description || "",
          division_a_amount_edited: l.division_a_amount,
          division_b_amount_edited: l.division_b_amount,
        })));
      }
      setLoading(false);
    }
    load();
  }, [period, t]);

  const updateLine = (index: number, field: keyof EditableLine, value: string | number) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const applyDescriptionToAll = () => {
    setLines(prev => prev.map(l => ({
      ...l,
      division_a_description: defaultDescription,
      division_b_description: defaultDescription,
    })));
  };

  const toggleLine = (index: number) => {
    setExpandedLines(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const totalDebits = lines.reduce((sum, l) => sum + (l.division_a_amount_edited || 0) + (l.division_b_amount_edited || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (l.division_a_amount_edited || 0) + (l.division_b_amount_edited || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const handleReject = () => {
    router.push("/new-allocation");
  };

  const approve = async () => {
    if (!draft) return;
    if (!isBalanced) {
      setError("Journal entry is not balanced. Total debits must equal total credits.");
      return;
    }
    setPosting(true);
    setError("");

    const updatedLines = lines.map(l => ({
      ...l,
      division_a_amount: l.division_a_amount_edited,
      division_b_amount: l.division_b_amount_edited,
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
      setError(data.error ?? "Something went wrong");
    }
    setPosting(false);
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) { setSaveTemplateError("Please enter a name."); return; }
    setSavingTemplate(true);
    setSaveTemplateError("");

    // Pull current active config rules to save
    const configRes = await fetch("/api/onboarding/config", { cache: "no-store" });
    const { rules } = await configRes.json();

    const res = await fetch("/api/allocations/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName, rules }),
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
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Journal entry posted!</h2>
        <p className="text-gray-500 text-sm mb-6">The allocation has been posted to QuickBooks.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );

  if (!draft) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">Draft not found.</div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-10 px-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Review allocation</h1>
            <p className="text-gray-500 text-sm mt-0.5">Period: {period}</p>
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            {/* Save configuration */}
            <button
              onClick={() => { setShowSaveModal(true); setSaveTemplateError(""); setTemplateName(""); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-sm font-medium text-indigo-700"
            >
              <BookmarkPlus size={16} /> Save configuration
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <XCircle size={16} /> Edit accounts
            </button>
            <button
              onClick={approve}
              disabled={posting || !isBalanced || isLocked}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm"
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
                <div className="flex flex-col items-center py-4 gap-3 text-green-600">
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
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 mb-3 focus:outline-none focus:border-indigo-400"
                    autoFocus
                  />
                  {saveTemplateError && (
                    <p className="text-xs text-red-500 mb-3">{saveTemplateError}</p>
                  )}
                  <button
                    onClick={saveAsTemplate}
                    disabled={savingTemplate}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
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
            <span>This allocation is <strong>locked</strong>. To make changes, unlock it from the History page first. You can still void it.</span>
          </div>
        )}

        {/* Amend note prompt — shown when editing a posted entry */}
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

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Journal entry details</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Journal entry date</label>
              <input
                type="date" value={jeDate}
                onChange={e => setJeDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
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
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-500">Default description (applies to all lines)</label>
              <button
                onClick={applyDescriptionToAll}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Apply to all lines
              </button>
            </div>
            <input
              type="text" value={defaultDescription}
              onChange={e => setDefaultDescription(e.target.value)}
              placeholder="e.g. May 2026 Division Allocation"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total lines</p>
            <p className="text-2xl font-semibold text-gray-900">{lines.length * 2}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total debits</p>
            <p className={"text-2xl font-semibold " + (isBalanced ? "text-green-600" : "text-red-500")}>
              {"$" + totalDebits.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total credits</p>
            <p className={"text-2xl font-semibold " + (isBalanced ? "text-red-500" : "text-orange-500")}>
              {"$" + totalCredits.toLocaleString()}
            </p>
          </div>
        </div>

        {!isBalanced && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-orange-700 text-sm">
            Warning: Journal entry is out of balance by {"$" + Math.abs(totalDebits - totalCredits).toFixed(2)}. Adjust line amounts before posting.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <span className="col-span-3">Account</span>
            <span className="col-span-2">Location</span>
            <span className="col-span-4">Description</span>
            <span className="col-span-1 text-right">Debit</span>
            <span className="col-span-1 text-right">Credit</span>
            <span className="col-span-1"></span>
          </div>

          {lines.map((line, i) => (
            <div key={i} className="border-b border-gray-100 last:border-0">
              {/* Row 1: Debit Division A */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50">
                <span className="col-span-3 text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="col-span-2 text-sm text-blue-600">Division A</span>
                <div className="col-span-4">
                  <input
                    type="text"
                    value={line.division_a_description}
                    onChange={e => updateLine(i, "division_a_description", e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                    placeholder="Line description..."
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    value={line.division_a_amount_edited}
                    onChange={e => updateLine(i, "division_a_amount_edited", parseFloat(e.target.value) || 0)}
                    className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 text-green-600"
                  />
                </div>
                <span className="col-span-1 text-sm text-right text-gray-400"></span>
                <button
                  onClick={() => toggleLine(i)}
                  className="col-span-1 flex justify-end text-gray-300 hover:text-gray-500"
                >
                  {expandedLines[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Row 2: Debit Division B */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50 bg-gray-50/50">
                <span className="col-span-3 text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="col-span-2 text-sm text-teal-600">Division B</span>
                <div className="col-span-4">
                  <input
                    type="text"
                    value={line.division_b_description}
                    onChange={e => updateLine(i, "division_b_description", e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                    placeholder="Line description..."
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    value={line.division_b_amount_edited}
                    onChange={e => updateLine(i, "division_b_amount_edited", parseFloat(e.target.value) || 0)}
                    className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 text-green-600"
                  />
                </div>
                <span className="col-span-1 text-sm text-right text-gray-400"></span>
                <span className="col-span-1"></span>
              </div>

              {/* Row 3: Credit untagged (no location) — read-only, auto-calculated */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-gray-100/60">
                <span className="col-span-3 text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="col-span-2 text-xs text-gray-400 italic">Untagged offset</span>
                <div className="col-span-4">
                  <input
                    type="text"
                    value={line.division_a_description}
                    onChange={e => updateLine(i, "division_a_description", e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                    placeholder="Line description..."
                  />
                </div>
                <span className="col-span-1 text-sm text-right text-gray-400"></span>
                <span className="col-span-1 text-xs text-right text-red-500 font-medium pr-1">
                  {(line.division_a_amount_edited + line.division_b_amount_edited).toFixed(2)}
                </span>
                <span className="col-span-1"></span>
              </div>

              {expandedLines[i] && (
                <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100 space-y-2">
                  <div className="flex gap-6 text-xs text-indigo-700">
                    <span>Rule: {line.rule_type === "revenue_pct" ? "Revenue %" : "Fixed split"}</span>
                    <span>Div A: {line.division_a_pct.toFixed(1)}%</span>
                    <span>Div B: {line.division_b_pct.toFixed(1)}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="bg-white rounded-lg px-3 py-2 border border-indigo-100">
                      <p className="text-xs text-gray-400 mb-0.5">Total balance</p>
                      <p className="text-sm font-semibold text-gray-900">${(line.total_amount ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2 border border-indigo-100">
                      <p className="text-xs text-gray-400 mb-0.5">Already tagged</p>
                      <p className="text-sm font-semibold text-green-600">
                        A: ${(line.already_tagged_a ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} /
                        B: ${(line.already_tagged_b ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2 border border-indigo-100">
                      <p className="text-xs text-gray-400 mb-0.5">Being allocated</p>
                      <p className="text-sm font-semibold text-indigo-600">${(line.untagged_amount ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
// v11



