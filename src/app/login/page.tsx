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

          {/* Official Intuit Sign in with Intuit button */}
          <a
            href="/api/auth/intuit"
            className="group block w-full"
          >
            <Image
              src="/Sign_in_blue_btn_tall_default.png"
              alt="Sign in with Intuit"
              width={400}
              height={52}
              className="w-full group-hover:hidden"
              priority
            />
            <Image
              src="/Sign_in_blue_btn_tall_hover.png"
              alt="Sign in with Intuit"
              width={400}
              height={52}
              className="w-full hidden group-hover:block"
              priority
            />
          </a>

          <p className="text-xs text-gray-400 text-center">
            New to Allocate? Signing in will create your account automatically.
          </p>
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
