"use client";
import { Settings, LogOut } from "lucide-react";

interface NavProps {
  showSettings?: boolean;
}

export default function Nav({ showSettings = true }: NavProps) {
  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <span className="font-semibold text-gray-900">Allocate</span>
      <div className="flex items-center gap-4">
        {showSettings && (
          <a href="/onboarding?returnTo=dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <Settings size={14} /> Settings
          </a>
        )}
        <button onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </nav>
  );
}
