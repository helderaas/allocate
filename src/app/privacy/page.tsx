import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900">Allocate</Link>
        <Link href="/login" className="text-sm text-brand-600 hover:text-brand-700">Sign in</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: June 8, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>Allocate LLC (&quot;Allocate,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Allocate application available at allocateapp.net (the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>
            <p className="mt-2">By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <h3 className="text-base font-semibold text-gray-800 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account registration information (email address and password)</li>
              <li>Business information provided during onboarding (division names, allocation rules)</li>
              <li>Payment information processed by Stripe (we do not store card numbers)</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">2.2 Information from QuickBooks Online</h3>
            <p>When you connect your QuickBooks Online account, we access and process the following data solely to provide the Service:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Chart of accounts and account balances</li>
              <li>Department and location data</li>
              <li>Profit and loss report data</li>
              <li>General ledger transaction data</li>
              <li>Company information (company name, country)</li>
            </ul>
            <p className="mt-2">We access this data only as necessary to calculate and post allocation journal entries on your behalf. We do not sell, share, or use your QuickBooks data for any purpose other than providing the Service.</p>

            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">2.3 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Log data (IP address, browser type, pages visited, timestamps)</li>
              <li>Cookie data used for authentication and session management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Calculate shared expense allocations and post journal entries to QuickBooks</li>
              <li>Process subscription payments through Stripe</li>
              <li>Send transactional emails (account confirmation, password reset)</li>
              <li>Respond to customer support requests</li>
              <li>Improve and develop the Service</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage and Security</h2>
            <p>Your data is stored securely using Supabase, a PostgreSQL database platform with industry-standard encryption at rest and in transit. QuickBooks OAuth tokens are stored encrypted and are used only to make authorized API calls on your behalf.</p>
            <p className="mt-2">We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Sharing and Disclosure</h2>
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Intuit/QuickBooks:</strong> To authenticate and make authorized API calls on your behalf</li>
              <li><strong>Stripe:</strong> To process subscription payments</li>
              <li><strong>Supabase:</strong> Our database infrastructure provider</li>
              <li><strong>Vercel:</strong> Our hosting infrastructure provider</li>
              <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
            </ul>
            <p className="mt-2">All third-party service providers are contractually obligated to protect your data and use it only for the purposes for which it was shared.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. QuickBooks Data Usage</h2>
            <p>Allocate&apos;s use of data obtained from QuickBooks Online is limited to the following:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Reading account balances and transaction data to calculate allocations</li>
              <li>Writing journal entries to your QuickBooks company file</li>
              <li>Reading location/department data to identify your divisions</li>
            </ul>
            <p className="mt-2">We do not use your QuickBooks data for advertising, analytics sold to third parties, or any purpose beyond providing the allocation service you have requested. We comply with Intuit&apos;s data handling requirements and developer policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide the Service. If you cancel your account, we will delete your personal data within 90 days, except where we are required to retain it for legal or regulatory purposes.</p>
            <p className="mt-2">Allocation history and journal entry records may be retained for up to 7 years for tax and accounting compliance purposes, after which they will be permanently deleted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access the personal information we hold about you</li>
              <li>Correct inaccurate personal information</li>
              <li>Request deletion of your personal information</li>
              <li>Disconnect your QuickBooks account at any time</li>
              <li>Export your allocation data</li>
              <li>Cancel your subscription at any time</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:privacy@allocateapp.net" className="text-brand-600 hover:text-brand-700">privacy@allocateapp.net</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cookies</h2>
            <p>We use essential cookies only — strictly necessary for authentication and session management. We do not use advertising cookies, tracking pixels, or third-party analytics cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Children&apos;s Privacy</h2>
            <p>The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, please contact us immediately.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a prominent notice in the Service. Your continued use of the Service after the effective date of any changes constitutes your acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us at:</p>
            <div className="mt-2 p-4 bg-gray-50 rounded-xl text-sm">
              <p className="font-medium">Allocate LLC</p>
              <p>Athens, Georgia</p>
              <p><a href="mailto:privacy@allocateapp.net" className="text-brand-600 hover:text-brand-700">privacy@allocateapp.net</a></p>
            </div>
          </section>

        </div>
      </div>

      <footer className="border-t border-gray-200 px-6 py-6 mt-12">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-400">
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
