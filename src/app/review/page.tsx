"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AllocationDraft, AllocationLine } from "@/types";
import { CheckCircle, XCircle, Loader2, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

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

  useEffect(() => {
    async function load() {
      if (!period) return;
      const res = await fetch("/api/allocations/draft?period=" + period);
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
  }, [period]);

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

  const totalDebits = lines.reduce((sum, l) => sum + (l.division_b_amount_edited || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (l.division_a_amount_edited || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const handleReject = () => {
    // Go back to onboarding account picker with returnTo=dashboard
    router.push("/onboarding?tenantId=current&returnTo=dashboard");
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
        <button onClick={() => router.push("/dashboard")}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700">
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
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={16} /> Back to dashboard
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Review allocation</h1>
            <p className="text-gray-500 text-sm mt-0.5">Period: {period}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleReject}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              <XCircle size={16} /> Edit accounts
            </button>
            <button onClick={approve} disabled={posting || !isBalanced}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm">
              {posting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {posting ? "Posting..." : "Approve & post to QBO"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>
        )}

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
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Apply to all lines
              </button>
            </div>
            <input type="text" value={defaultDescription} onChange={e => setDefaultDescription(e.target.value)}
              placeholder="e.g. May 2026 Division Allocation"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
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
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50">
                <span className="col-span-3 text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="col-span-2 text-sm text-blue-600">Division A</span>
                <div className="col-span-4">
                  <input type="text"
                    value={line.division_a_description}
                    onChange={e => updateLine(i, "division_a_description", e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                    placeholder="Line description..." />
                </div>
                <span className="col-span-1 text-sm text-right text-gray-400"></span>
                <div className="col-span-1">
                  <input type="number"
                    value={line.division_a_amount_edited}
                    onChange={e => updateLine(i, "division_a_amount_edited", parseFloat(e.target.value) || 0)}
                    className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 text-red-500" />
                </div>
                <button onClick={() => toggleLine(i)}
                  className="col-span-1 flex justify-end text-gray-300 hover:text-gray-500">
                  {expandedLines[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50 bg-gray-50/50">
                <span className="col-span-3 text-sm font-medium text-gray-900 truncate">{line.account_name}</span>
                <span className="col-span-2 text-sm text-teal-600">Division B</span>
                <div className="col-span-4">
                  <input type="text"
                    value={line.division_b_description}
                    onChange={e => updateLine(i, "division_b_description", e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                    placeholder="Line description..." />
                </div>
                <div className="col-span-1">
                  <input type="number"
                    value={line.division_b_amount_edited}
                    onChange={e => updateLine(i, "division_b_amount_edited", parseFloat(e.target.value) || 0)}
                    className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-400 text-green-600" />
                </div>
                <span className="col-span-1 text-sm text-right text-gray-400"></span>
                <span className="col-span-1"></span>
              </div>

              {expandedLines[i] && (
                <div className="px-4 py-2 bg-indigo-50 text-xs text-indigo-700 border-t border-indigo-100">
                  Rule: {line.rule_type === "revenue_pct" ? "Revenue %" : "Fixed split"} —
                  Division A: {line.division_a_pct.toFixed(1)}% /
                  Division B: {line.division_b_pct.toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>}>
      <ReviewContent />
    </Suspense>
  );
}
// v3
