import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-3">
      <h1>Cold Email Cockpit</h1>
      <p className="text-sm text-zinc-400">Phase 1 operator console.</p>
      <div className="flex gap-2 text-sm">
        <Link href="/accounts" className="rounded-md border border-white/20 px-3 py-2 hover:bg-white/10">Accounts</Link>
        <Link href="/inbox" className="rounded-md border border-white/20 px-3 py-2 hover:bg-white/10">Inbox</Link>
      </div>
    </div>
  );
}
