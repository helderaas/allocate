import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/allocate-logo-primary.svg" alt="Allocate" width={160} height={36} className="mx-auto mb-6" priority />
          <p className="text-gray-500 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col items-center gap-6">
          <p className="text-sm text-gray-600 text-center">
            Allocate connects directly to QuickBooks Online. Sign in with your Intuit account to get started.
          </p>

          {/* Sign in with Intuit button */}
          <a
            href="/api/auth/intuit"
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#0077C5] hover:bg-[#005ea6] text-white rounded-xl font-medium text-sm transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2z" fill="white"/>
              <path d="M16 7c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2s2-.9 2-2V9c0-1.1-.9-2-2-2z" fill="#0077C5"/>
              <path d="M11 13c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2z" fill="#0077C5"/>
              <path d="M21 13c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2z" fill="#0077C5"/>
            </svg>
            Sign in with Intuit
          </a>

          <p className="text-xs text-gray-400 text-center">
            New to Allocate? Signing in will create your account automatically.
          </p>
        </div>

        {/* Error states */}
        <div id="error-container" className="mt-4">
          {/* Client-side error display handled below */}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By signing in you agree to our{" "}
          <Link href="/terms" className="text-brand-600 hover:text-brand-700">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-brand-600 hover:text-brand-700">Privacy Policy</Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-3">
          Intuit and QuickBooks are registered trademarks of Intuit Inc. Used with permission.
        </p>
      </div>
    </div>
  );
}
