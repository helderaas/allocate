import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900">Allocate</Link>
        <Link href="/login" className="text-sm text-brand-600 hover:text-brand-700">Sign in</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Effective Date: June 8, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
            <p>These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Allocate application (&quot;Service&quot;) operated by Allocate LLC (&quot;Allocate,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a Georgia limited liability company.</p>
            <p className="mt-2">By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, you may not use the Service. If you are using the Service on behalf of a business, you represent that you have the authority to bind that business to these Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>Allocate is a SaaS application that connects to QuickBooks Online via OAuth to automate the allocation of shared expenses across multiple business divisions or locations. The Service calculates allocation amounts based on user-defined rules and posts journal entries directly to your QuickBooks company file.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Accounts and Registration</h2>
            <p>To use the Service, you must create an account with a valid email address and password. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized use of your account.</p>
            <p className="mt-2">You may not share your account credentials with others. Each account is for use by a single user or organization. Accounting firms may connect multiple QuickBooks companies under a single account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. QuickBooks Integration</h2>
            <p>The Service requires you to authorize Allocate to access your QuickBooks Online account via Intuit&apos;s OAuth API. By connecting your QuickBooks account, you authorize Allocate to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Read your chart of accounts, transaction data, and reports</li>
              <li>Create journal entries in your QuickBooks company file</li>
              <li>Access company and location information</li>
            </ul>
            <p className="mt-2">You may revoke this authorization at any time through your QuickBooks account settings or by disconnecting within Allocate. You are solely responsible for reviewing and approving all journal entries before posting them to QuickBooks. Allocate is not responsible for any errors in your QuickBooks data resulting from journal entries you approve and post.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Subscription and Payment</h2>
            <h3 className="text-base font-semibold text-gray-800 mb-2">5.1 Free Trial</h3>
            <p>New accounts receive a 14-day free trial. No payment is required during the trial period. At the end of the trial, your subscription will automatically begin and your payment method will be charged unless you cancel before the trial ends.</p>

            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">5.2 Subscription Fees</h3>
            <p>Subscription fees are charged monthly per connected QuickBooks company at the following graduated rates:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>1–5 companies: $17.00 per company per month</li>
              <li>6–10 companies: $15.00 per company per month</li>
              <li>11–15 companies: $13.00 per company per month</li>
              <li>16+ companies: $11.00 per company per month</li>
            </ul>
            <p className="mt-2">All fees are billed in U.S. dollars. Prices are subject to change with 30 days advance notice.</p>

            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">5.3 Payment Processing</h3>
            <p>Payments are processed by Stripe. By providing payment information, you authorize Allocate to charge your payment method for all subscription fees. You agree to Stripe&apos;s terms of service.</p>

            <h3 className="text-base font-semibold text-gray-800 mb-2 mt-4">5.4 Cancellation and Refunds</h3>
            <p>You may cancel your subscription at any time through the billing portal. Cancellations take effect at the end of the current billing period. We do not provide refunds for partial months. If your payment fails, we will notify you and may suspend access to the Service until payment is resolved.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Use the Service to store or transmit malicious code</li>
              <li>Interfere with the integrity or performance of the Service</li>
              <li>Resell or sublicense the Service without written permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data and Privacy</h2>
            <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-brand-600 hover:text-brand-700">Privacy Policy</Link>, which is incorporated into these Terms by reference. You retain ownership of all data you input into or connect to the Service. You grant Allocate a limited license to access and process your data solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>The Service, including its software, design, and content, is owned by Allocate LLC and protected by applicable intellectual property laws. These Terms do not grant you any rights to Allocate&apos;s trademarks, logos, or other brand features.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimer of Warranties</h2>
            <p className="uppercase text-sm font-medium">The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
            <p className="mt-2">Allocate does not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components. You acknowledge that journal entries posted to QuickBooks through the Service are based on rules you configure, and you are solely responsible for reviewing the accuracy of all posted entries.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Limitation of Liability</h2>
            <p className="uppercase text-sm font-medium">To the maximum extent permitted by applicable law, Allocate LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of or in connection with your use of the service.</p>
            <p className="mt-2">Allocate&apos;s total liability to you for any claims arising out of or related to these Terms or the Service shall not exceed the amount you paid to Allocate in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Allocate LLC and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys&apos; fees) arising out of your use of the Service, violation of these Terms, or infringement of any third-party rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Termination</h2>
            <p>We may suspend or terminate your account at any time for violation of these Terms, non-payment, or for any other reason with reasonable notice. You may terminate your account at any time by canceling your subscription and contacting us to delete your account. Upon termination, your right to use the Service ceases immediately.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of the State of Georgia, without regard to conflict of law principles. Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in Athens, Georgia, except that either party may seek injunctive relief in a court of competent jurisdiction.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Changes to Terms</h2>
            <p>We may modify these Terms at any time. We will provide at least 30 days notice of material changes via email or in-app notification. Your continued use of the Service after the effective date of any changes constitutes your acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">15. Contact</h2>
            <p>For questions about these Terms, please contact:</p>
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
