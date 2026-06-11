import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user_id")?.value ?? cookieStore.get("sb_access_token")?.value;
  const firmId = cookieStore.get("firm_id")?.value;
  const intuitSub = cookieStore.get("intuit_sub")?.value;

  // Active session — go straight to dashboard
  if (userId && firmId) {
    redirect("/dashboard");
  }

  // Has intuit_sub cookie — restore session without OAuth
  if (intuitSub) {
    redirect("/api/auth/restore");
  }

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
          <a href="/api/auth/intuit" className="group flex justify-center">
            <img src="/Sign_in_blue_btn_tall_default.svg" alt="Sign in with Intuit" width={220} className="group-hover:hidden" />
            <img src="/Sign_in_blue_btn_tall_hover.svg" alt="Sign in with Intuit" width={220} className="hidden group-hover:block" />
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
