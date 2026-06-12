import Image from "next/image";
import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/allocate-logo-primary.svg" alt="Allocate" width={140} height={32} priority />
        </Link>
        <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
          Sign in
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">Get Help</h1>
        <p className="text-gray-500 mb-12">We are here to help you get the most out of Allocate.</p>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact Support</h2>
          <p className="text-gray-500 text-sm mb-4">
            Have a question or running into an issue? Send us an email and we will get back to you as soon as possible.
          </p>
          <a
            href="mailto:support@allocateapp.net"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            support@allocateapp.net
          </a>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">What is Allocate and who is it for?</h3>
              <p className="text-sm text-gray-500">Allocate automates shared expense allocation for QuickBooks Online companies with multiple divisions, locations, or departments. It is built for bookkeepers, CPAs, and business owners who manually split shared expenses across divisions every month.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How does Allocate connect to QuickBooks Online?</h3>
              <p className="text-sm text-gray-500">Allocate uses Intuit&apos;s official OAuth 2.0 integration. You sign in with your existing Intuit account — no separate username or password required.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">How is Allocate priced?</h3>
              <p className="text-sm text-gray-500">$17/month per QuickBooks Online connection. Accounting firms pay per client connection. Your firm&apos;s own QuickBooks Online is free with any active client subscription. Starts with a 14-day free trial.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Does Allocate post journal entries automatically?</h3>
              <p className="text-sm text-gray-500">No — Allocate calculates and prepares the journal entries, then shows you a full review screen before anything is posted. You approve and post with one click.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Can I manage multiple client companies?</h3>
              <p className="text-sm text-gray-500">Yes. Allocate is built for accounting firms managing multiple QuickBooks Online companies. Each client connection appears in your company switcher and is billed separately at $17/month.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">What happens if I need to reverse an allocation?</h3>
              <p className="text-sm text-gray-500">You can void any posted allocation from your dashboard. You will also need to manually void the corresponding journal entry in QuickBooks Online.</p>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">About Allocate</h2>
          <p className="text-sm text-gray-500">
            Allocate is built by Allocate LLC, based in Athens, Georgia. Built by a CPA, for accountants — because we lived this problem ourselves.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-6 mt-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 Allocate LLC</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
