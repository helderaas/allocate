import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ signedOut?: string }> }) {
  const { signedOut } = await searchParams;
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value ?? cookieStore.get("sb_access_token")?.value;
  const firmId = cookieStore.get("firm_id")?.value;
  const intuitSub = cookieStore.get("intuit_sub")?.value;

  // Only auto-redirect if not explicitly signed out
  if (!signedOut) {
    if (userId && firmId) {
      redirect("/dashboard");
    }
    if (intuitSub) {
      redirect("/api/auth/restore");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/allocate-logo-primary.svg" alt="Allocate" width={160} height={36} className="mx-auto mb-6" priority />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col items-center gap-6">

          <div className="w-full text-center border-b border-gray-100 pb-6">
            <p className="text-sm font-medium text-gray-700 mb-1">New to Allocate?</p>
            <p className="text-xs text-gray-400 mb-4">Connect your QuickBooks Online account to get started.</p>
            <a href="/api/auth/intuit" className="group flex justify-center">
              <img src="/Sign_in_blue_btn_tall_default.svg" alt="Sign in with Intuit" width={220} className="group-hover:hidden" />
              <img src="/Sign_in_blue_btn_tall_hover.svg" alt="Sign in with Intuit" width={220} className="hidden group-hover:block" />
            </a>
            <p className="text-xs text-gray-400 mt-3">14-day free trial · Cancel anytime</p>
          </div>

          <div className="w-full text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">Already have an account?</p>
            <p className="text-xs text-gray-400 mb-4">Sign in directly without reconnecting QuickBooks.</p>
            <a
              href="/api/auth/restore"
              className="w-full flex items-center justify-center px-6 py-2.5 border border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-sm font-medium transition-colors"
            >
              Sign in as returning user
            </a>
          </div>

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
