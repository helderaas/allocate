"use client";
import { useState } from "react";
import { Calendar, ArrowRight, CheckCircle, Clock, Settings } from "lucide-react";

const mockAllocations = [
  { period: "May 2025", status: "posted", total: 46770, createdAt: "Jun 2, 2025" },
  { period: "Apr 2025", status: "posted", total: 44200, createdAt: "May 1, 2025" },
  { period: "Mar 2025", status: "posted", total: 43100, createdAt: "Apr 2, 2025" },
];

export default function DashboardPage() {
  const [running, setRunning] = useState(false);

  const runAllocation = async () => {
    setRunning(true);
    await new Promise(r => setTimeout(r, 1500));
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Allocate</span>
        <a href="/onboarding" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><Settings size={14} /> Settings</a>
      </nav>
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Lakewood Medical Group LLC</p>
          </div>
          <button onClick={runAllocation} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm"
          >
            {running ? "Calculating…" : <>Run June 2025 <ArrowRight size={16} /></>}
          </button>
        </div>

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
            <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Calendar size={16} className="text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{a.period}</p>
                <p className="text-xs text-gray-400">Created {a.createdAt}</p>
              </div>
              <p className="text-sm font-medium text-gray-900">${a.total.toLocaleString()}</p>
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                {a.status === "posted" ? <CheckCircle size={14} /> : <Clock size={14} />}
                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
