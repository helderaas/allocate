import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  // If already logged in, redirect to dashboard
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb_access_token")?.value;
  if (accessToken) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Image src="/allocate-logo-primary.svg" alt="Allocate" width={160} height={36} priority />
        <div className="flex items-center gap-4">
          <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            Blog
          </Link>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            Sign in
          </Link>
          <Link href="/signup"
            className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors">
            Start free trial
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium mb-6">
          ✦ Built for multi-division, multi-location companies
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6 max-w-3xl mx-auto">
          Stop manually splitting shared expenses across divisions
        </h1>
        <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
          Allocate connects to QuickBooks Online and automatically calculates and posts journal entries for shared expenses — split by revenue percentage or fixed rules.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup"
            className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-base transition-colors shadow-sm">
            Start 14-day free trial
          </Link>
          <Link href="/login"
            className="px-8 py-3.5 border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-semibold text-base transition-colors">
            Sign in
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">No credit card required during trial · Cancel anytime</p>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">How it works</h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            From QuickBooks connection to posted journal entry in minutes, not hours.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Connect QuickBooks", desc: "Authorize Allocate to read your accounts and post journal entries via Intuit's secure OAuth." },
              { step: "2", title: "Define your rules", desc: "Choose which shared expense accounts to allocate and set split rules — by revenue % or fixed percentage." },
              { step: "3", title: "Run the allocation", desc: "Allocate reads your actual account balances and calculates the correct split for untagged transactions." },
              { step: "4", title: "Review & post", desc: "Review the journal entry, make any adjustments, then post directly to QuickBooks with one click." },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Everything you need</h2>
        <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
          Built by accountants, for accountants. Every feature designed around real-world allocation workflows.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: "📊",
              title: "Smart allocation engine",
              desc: "Only allocates untagged transactions — respects expenses already assigned to a division. No double-counting, ever.",
            },
            {
              icon: "⚖️",
              title: "Flexible split rules",
              desc: "Allocate by revenue percentage (calculated live from your P&L) or set fixed percentages per account.",
            },
            {
              icon: "📋",
              title: "Saved templates",
              desc: "Save your allocation configuration as a template. Run month-end allocations in seconds with one click.",
            },
            {
              icon: "🔒",
              title: "Audit trail & locking",
              desc: "Every action is logged. Lock posted entries to prevent amendments. Full audit history with timestamps.",
            },
            {
              icon: "🔄",
              title: "Amend & void",
              desc: "Made a mistake? Amend a posted entry and Allocate automatically voids the old JE and posts a new one.",
            },
            {
              icon: "🏢",
              title: "Multi-company support",
              desc: "Accounting firms can manage multiple client companies under one login with a simple company switcher.",
            },
          ].map(feature => (
            <div key={feature.title} className="p-6 rounded-2xl border border-gray-100 hover:border-brand-100 hover:bg-brand-50/30 transition-colors">
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="bg-brand-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Built for multi-division, multi-location companies</h2>
          <p className="text-brand-200 text-lg mb-8 max-w-2xl mx-auto">
            Perfect for any company operating multiple divisions, locations, or service lines under one QuickBooks company — from professional services to retail, healthcare to hospitality.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { title: "Practice owners", desc: "Run month-end allocations yourself without needing your accountant for routine journal entries." },
              { title: "Office managers", desc: "Simple guided workflow — no accounting degree required. Review and approve before anything posts." },
              { title: "Accounting firms", desc: "Manage all your multi-division clients from one login. Save templates per client for fast month-end close." },
            ].map(item => (
              <div key={item.title} className="bg-white/10 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-brand-200 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Simple, transparent pricing</h2>
        <p className="text-gray-500 text-center mb-12">Per connected QuickBooks company. Volume discounts for accounting firms.</p>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-8 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Allocate</h3>
                <p className="text-gray-500 text-sm mt-1">Everything included, no feature tiers</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-gray-900">$17<span className="text-lg font-normal text-gray-500">/mo</span></p>
                <p className="text-sm text-gray-400">per company · starts after 14-day trial</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {[
                "Unlimited monthly allocations",
                "Automated QBO journal entries",
                "Revenue % and fixed split rules",
                "Saved allocation templates",
                "Full audit trail with locking",
                "Amend and void posted entries",
                "Multi-company firm accounts",
                "Email support",
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-brand-sage">✓</span> {f}
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Volume discounts for firms:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-center">
                {[
                  { range: "1–5 cos", price: "$17/co" },
                  { range: "6–10 cos", price: "$15/co" },
                  { range: "11–15 cos", price: "$13/co" },
                  { range: "16+ cos", price: "$11/co" },
                ].map(tier => (
                  <div key={tier.range} className="bg-white rounded-lg p-2 border border-gray-200">
                    <p className="text-gray-500 text-xs">{tier.range}</p>
                    <p className="font-semibold text-gray-900">{tier.price}</p>
                  </div>
                ))}
              </div>
            </div>
            <Link href="/signup"
              className="block w-full text-center py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-colors">
              Start free 14-day trial
            </Link>
            <p className="text-center text-xs text-gray-400 mt-3">No credit card required during trial</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to automate your month-end close?</h2>
          <p className="text-gray-500 mb-8">Connect your QuickBooks account and run your first allocation in under 5 minutes.</p>
          <Link href="/signup"
            className="inline-block px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-base transition-colors shadow-sm">
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Allocate</span>
            <span>·</span>
            <span>© 2026 Allocate LLC</span>
          </div>
          <p className="text-xs text-gray-400 text-center w-full md:w-auto">Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
            <a href="mailto:support@allocateapp.net" className="hover:text-gray-600">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}


