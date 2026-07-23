import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function Card({ label, value, accent }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold ${accent || ''}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/reports/overview').then(setD).catch(console.error); }, []);
  if (!d) return <p className="text-slate-500">Chargement…</p>;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-4 gap-4">
        <Card label="Tickets ouverts" value={d.tickets.open} accent="text-cyan-400" />
        <Card label="Total tickets" value={d.tickets.total} />
        <Card label="Créés (7j)" value={d.tickets.last7d} />
        <Card label="MTTR (h)" value={d.mttr_hours} accent="text-violet-400" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="font-semibold mb-2">Par statut</p>
          {d.by_status.map((s) => <p key={s.status} className="text-sm flex justify-between"><span className="text-slate-400">{s.status}</span><span>{s.count}</span></p>)}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="font-semibold mb-2">CMDB</p>
          {d.cmdb.map((c) => <p key={c.class} className="text-sm flex justify-between"><span className="text-slate-400">{c.class}</span><span>{c.count}</span></p>)}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="font-semibold mb-2">Jobs automation</p>
          {d.automation.map((j) => <p key={j.status} className="text-sm flex justify-between"><span className="text-slate-400">{j.status}</span><span>{j.count}</span></p>)}
        </div>
      </div>
    </div>
  );
}
