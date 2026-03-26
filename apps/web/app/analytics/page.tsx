'use client';

import { useEffect, useState } from 'react';

type Analytics = {
  kpis: { sent: number; reply: number; bounce_hard: number; bounce_soft: number; unsubscribe: number };
  campaigns: Array<{ campaign_id: string; campaign_name: string; sent: number; reply: number; bounce_hard: number; bounce_soft: number; unsubscribe: number }>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch('/api/analytics').then((r) => r.json()).then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <h2>Analytics</h2>
      <div className="grid grid-cols-5 gap-3">
        {[
          ['Sent', data?.kpis.sent ?? 0],
          ['Replies', data?.kpis.reply ?? 0],
          ['Hard bounces', data?.kpis.bounce_hard ?? 0],
          ['Soft bounces', data?.kpis.bounce_soft ?? 0],
          ['Unsubs', data?.kpis.unsubscribe ?? 0]
        ].map(([label, value]) => (
          <div key={String(label)} className="panel p-4">
            <p className="text-xs uppercase text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-left">Campaign</th>
              <th className="px-3 py-2 text-left">Sent</th>
              <th className="px-3 py-2 text-left">Replies</th>
              <th className="px-3 py-2 text-left">Hard</th>
              <th className="px-3 py-2 text-left">Soft</th>
              <th className="px-3 py-2 text-left">Unsubs</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-white/[0.02]">
            {data?.campaigns.map((c) => (
              <tr key={c.campaign_id} className="border-t border-white/10">
                <td className="px-3 py-2">{c.campaign_name}</td>
                <td className="px-3 py-2">{c.sent}</td>
                <td className="px-3 py-2">{c.reply}</td>
                <td className="px-3 py-2">{c.bounce_hard}</td>
                <td className="px-3 py-2">{c.bounce_soft}</td>
                <td className="px-3 py-2">{c.unsubscribe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
