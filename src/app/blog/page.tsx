import Link from "next/link";
import { ArrowRight } from "lucide-react";

const posts = [
  {
    slug: "how-to-allocate-shared-expenses-quickbooks",
    title: "How to Allocate Shared Expenses Across Divisions in QuickBooks Online",
    excerpt: "If your company has multiple locations, departments, or classes sharing overhead expenses like rent, utilities, insurance, and payroll — you already know the monthly pain of splitting those costs manually in QBO.",
    date: "June 9, 2026",
    readTime: "6 min read",
    category: "QuickBooks Tips",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold text-gray-900">Allocate</Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
            Start free trial
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Blog</h1>
        <p className="text-gray-500 mb-12">Practical guides for accountants and business owners managing multi-division QuickBooks companies.</p>

        <div className="space-y-8">
          {posts.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`}
              className="block group p-6 rounded-2xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{post.category}</span>
                <span className="text-xs text-gray-400">{post.date} · {post.readTime}</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-700 transition-colors">{post.title}</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">{post.excerpt}</p>
              <span className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
                Read article <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-16">
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
