export default function Home() {
  const qboAuthUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  qboAuthUrl.searchParams.set("client_id", process.env.QBO_CLIENT_ID ?? "");
  qboAuthUrl.searchParams.set("redirect_uri", process.env.QBO_REDIRECT_URI ?? "");
  qboAuthUrl.searchParams.set("response_type", "code");
  qboAuthUrl.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
  qboAuthUrl.searchParams.set("state", "allocate_connect");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-semibold text-gray-900 mb-3">Allocate</h1>
        <p className="text-gray-500 text-lg mb-8">
          Automated expense allocation for multi-division QuickBooks companies.
        </p>
        <a
          href={qboAuthUrl.toString()}
          className="inline-flex items-center justify-center gap-3 w-full py-3 px-6 bg-[#2CA01C] hover:bg-[#238a16] text-white font-medium rounded-xl transition-colors text-base"
        >
          Connect to QuickBooks
        </a>
        <p className="mt-4 text-xs text-gray-400">
          Your QuickBooks credentials are never stored. Authentication is handled securely by Intuit.
        </p>
      </div>
    </main>
  );
}
