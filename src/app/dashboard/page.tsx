"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ArrowRight, CheckCircle, Clock, Settings, Loader2 } from "lucide-react";

const mockAllocations = [
  { period: "2025-05", label: "May 2025", status: "posted", total: 46770, createdAt: "Jun 2, 2025" },
  { period: "2025-04", label: "Apr 2025", status: "posted", total: 44200, createdAt: "May 1, 2025" },
  { period: "2025-03", label: "Mar 2025", status: "posted", total: 43100, createdAt: "Apr 2, 2025" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  const today = new Date();
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(fmt(firstOfLastMonth));
  const [endDate, setEndDate] = useState(fmt(lastOfLastMonth));
  const [jeDate, setJeDate] = useState(fmt(lastOfLastMonth));
  const [description, setDescription] = useState("");
  const [journalNumber, setJournalNumber] = useState("");

  const period = startDate.slice(0, 7);
  const periodLabel = new Date(startDate + "T12:00:00")
    .toLocaleString("default", { month: "long", year: "numeric" });

  const defaultDescription = "Division allocation - " + periodLabel;

  const runAllocation = async () => {
    setRunning(true);
    setError("");
    const res = await fetch("/api/allocations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period,
        startDate,
        endDate,
        jeDate,
        description: description || defaultDescription,
        journalNumber,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setRunning(false);
      return;
    }
    router.push("/review?period=" + period);
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <a href="/onboarding" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <Settings size={14} /> Settings
        </a>
      </nav>
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Lakewood Medical Group LLC</p>
          </div>
          <button onClick={runAllocation} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm">
            {running
              ? <><Loader2 size={16} className="animate-spin" /><span>Calculating...</span></>
              : <><span>{"Run " + periodLabel}</span><ArrowRight size={16} /></>}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Allocation settings</h2>
            <button onClick={() => setShowOptions(!showOptions)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              {showOptions ? "Hide options" : "Show options"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period start</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period end</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>

          {showOptions && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
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
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description / memo</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder={defaultDescription}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Accounts configured", value: "36" },
            { label: "Revenue % rules", value: "30" },
            { label: "Fixed split rules", value: "6" },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{m.value}</p>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Allocation history</h2>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {mockAllocations.map((a, i) => (
            <div key={i} onClick={() => router.push("/review?period=" + a.period)}
              className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Calendar size={16} className="text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{a.label}</p>
                <p className="text-xs text-gray-400">{"Created " + a.createdAt}</p>
              </div>
              <p className="text-sm font-medium text-gray-900">{"$" + a.total.toLocaleString()}</p>
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                {a.status === "posted" ? <CheckCircle size={14} /> : <Clock size={14} />}
                <span>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
