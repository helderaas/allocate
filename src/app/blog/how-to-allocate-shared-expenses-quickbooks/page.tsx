import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "How to Allocate Shared Expenses Across Divisions in QuickBooks Online | Allocate",
  description: "A step-by-step guide to splitting shared overhead expenses like rent, utilities, and payroll across multiple locations, departments, or classes in QuickBooks Online.",
};

export default function Post() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold text-gray-900">Allocate</Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors">
            Start free trial
          </Link>
        </div>
      </nav>

      <article className="max-w-2xl mx-auto px-6 py-16">
        {/* Back */}
        <Link href="/blog" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-8">
          <ArrowLeft size={14} /> Back to blog
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-full">QuickBooks Tips</span>
            <span className="text-xs text-gray-400">June 9, 2026 · 6 min read</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
            How to Allocate Shared Expenses Across Divisions in QuickBooks Online
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed">
            If your company has multiple locations, departments, or classes sharing overhead expenses — you already know the monthly pain of splitting those costs manually in QuickBooks Online. Here's how to do it right, and how to automate it entirely.
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none space-y-8">

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The problem with shared expenses</h2>
            <p className="text-gray-600 leading-relaxed">
              Most multi-division businesses share overhead costs that don't naturally belong to a single location or department. Think rent for a shared facility, the owner's salary, company-wide insurance, accounting fees, or software subscriptions that everyone uses.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              QuickBooks Online is excellent at tracking these expenses — but it doesn't automatically split them across your locations, classes, or departments. That means every month, someone has to manually calculate the right split and post a journal entry to allocate those costs.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              For a business with two divisions, that might be manageable. For three or more? It becomes a time-consuming, error-prone monthly chore.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The two most common allocation methods</h2>
            <p className="text-gray-600 leading-relaxed">
              Before we get into the mechanics, it helps to understand the two most common ways businesses split shared expenses:
            </p>

            <div className="mt-6 space-y-6">
              <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">1. Revenue percentage split</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Each division pays a share of the overhead proportional to its share of total revenue. If your Chiropractic division generates 60% of revenue and your Behavioral Health division generates 40%, then shared expenses are split 60/40.
                </p>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  This method is considered the most equitable because it ties overhead costs to the division's ability to generate revenue. It's also the most complex to calculate because the percentages change every month.
                </p>
              </div>

              <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">2. Fixed percentage split</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  You set a fixed percentage for each division that stays the same every month — for example, 50/50, 70/30, or any split that makes sense for your business.
                </p>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  This method is simpler and more predictable. It's common when divisions are roughly equal in size, or when management wants consistent cost allocation regardless of monthly revenue fluctuations.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How to do it manually in QuickBooks Online</h2>
            <p className="text-gray-600 leading-relaxed">
              Here's the manual process most accountants follow each month. Fair warning — it's tedious.
            </p>

            <ol className="mt-6 space-y-5">
              {[
                {
                  step: "1. Run your P&L by Class or Location",
                  detail: "Go to Reports → Profit & Loss → Customize → add the Location or Class column. This shows revenue by division, which you'll need to calculate revenue percentages."
                },
                {
                  step: "2. Calculate the split percentages",
                  detail: "Divide each division's revenue by total revenue. If Division A had $60,000 and Division B had $40,000 in revenue, your split is 60% / 40%. Do this in a spreadsheet."
                },
                {
                  step: "3. Run your General Ledger report",
                  detail: "For each shared expense account, run the GL report to see the untagged balance — the amount not already assigned to a location or class. That's the amount you need to allocate."
                },
                {
                  step: "4. Calculate the amounts per division",
                  detail: "Multiply the untagged balance by each division's percentage. For a $10,000 rent expense with a 60/40 split: $6,000 to Division A, $4,000 to Division B."
                },
                {
                  step: "5. Create the journal entry",
                  detail: "In QBO, go to + New → Journal Entry. Create debit lines for each division with the location/class tag applied, and a single credit line for the untagged offset. Make sure debits = credits."
                },
                {
                  step: "6. Repeat for every shared expense account",
                  detail: "If you have 8 shared expense accounts and 3 divisions, that's 8 separate calculations and potentially 32 journal entry lines — every single month."
                },
              ].map(({ step, detail }) => (
                <li key={step} className="flex gap-4">
                  <div className="shrink-0 w-1 bg-brand-200 rounded-full mt-1" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{step}</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 text-sm font-medium mb-1">⚠️ The real problem</p>
              <p className="text-amber-700 text-sm leading-relaxed">
                This process is completely manual, highly repetitive, and prone to errors — especially when revenue percentages change month to month. One wrong formula in your spreadsheet, one mistyped amount in QuickBooks Online, and your financial statements are off.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">A better way: automate the entire process</h2>
            <p className="text-gray-600 leading-relaxed">
              This is exactly the problem that Allocate was built to solve. Instead of manually pulling reports, calculating percentages, and typing journal entries, Allocate connects to your QuickBooks Online and does everything automatically.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4">
              {[
                { icon: "📊", title: "Pulls live data from QuickBooks Online", desc: "Allocate reads your actual GL balances and P&L revenue figures directly from QuickBooks — no manual exports or spreadsheets." },
                { icon: "🧮", title: "Calculates splits automatically", desc: "Revenue percentage splits are recalculated fresh each month using your actual QBO data. Fixed splits stay exactly where you set them." },
                { icon: "✅", title: "Review before posting", desc: "You see the full journal entry before it goes anywhere. Edit any line if needed, then approve with one click." },
                { icon: "📬", title: "Posts directly to QuickBooks", desc: "The journal entry posts to QuickBooks Online instantly — properly tagged to each location or class. No copy-pasting, no typos." },
                { icon: "🗂️", title: "Saves your configuration", desc: "Save your account rules as a template. Next month, run the same allocation in seconds." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-2xl shrink-0">{icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{title}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Who needs expense allocation?</h2>
            <p className="text-gray-600 leading-relaxed">
              If any of these describe your situation, expense allocation is probably part of your monthly close:
            </p>
            <ul className="mt-4 space-y-2">
              {[
                "Multi-location businesses (retail, healthcare, restaurants, professional services)",
                "Companies with multiple service lines or product divisions sharing overhead",
                "Healthcare practices with multiple specialties (chiropractic + behavioral health, dental + ortho)",
                "Franchises allocating corporate overhead to individual locations",
                "Accounting firms managing clients with shared expense structures",
                "Any QuickBooks Online company using Locations, Classes, or Departments to track divisions",
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-gray-600 text-sm">
                  <span className="text-brand-500 mt-0.5 shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Getting started</h2>
            <p className="text-gray-600 leading-relaxed">
              Allocate works with any QuickBooks Online company that uses Locations, Departments, or Classes. Setup takes about 5 minutes:
            </p>
            <ol className="mt-4 space-y-2">
              {[
                "Connect your QuickBooks Online company",
                "Select which accounts have shared expenses",
                "Set your allocation rule for each account (revenue % or fixed split)",
                "Run your first allocation — review the journal entry and post",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3 text-gray-600 text-sm">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          {/* CTA */}
          <div className="mt-12 p-8 bg-brand-50 rounded-2xl border border-brand-100 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Stop doing this manually every month</h3>
            <p className="text-gray-600 text-sm mb-6">
              Allocate automates your shared expense journal entries and posts them directly to QuickBooks. Try it free for 14 days.
            </p>
            <Link href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-colors">
              Start free trial <ArrowRight size={14} />
            </Link>
            <p className="text-xs text-gray-400 mt-3">No credit card required · Cancel anytime</p>
          </div>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <span>© 2026 Allocate · <Link href="/" className="hover:text-gray-600">allocateapp.net</Link></span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
