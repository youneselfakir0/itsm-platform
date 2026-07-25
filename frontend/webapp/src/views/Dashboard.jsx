import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

function Card({ label, value, accent }) {
  return (
    <div className="bg-surface border border-surface rounded-xl p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold ${accent || ''}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const [d, setD] = useState(null);
  useEffect(() => { api('/reports/overview').then(setD).catch(console.error); }, []);
  if (!d) return <p className="text-slate-500">{t('dashboard.loading')}</p>;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
      <div className="grid grid-cols-4 gap-4">
        <Card label={t('dashboard.openTickets')} value={d.tickets.open} accent="text-cyan-400" />
        <Card label={t('dashboard.totalTickets')} value={d.tickets.total} />
        <Card label={t('dashboard.last7d')} value={d.tickets.last7d} />
        <Card label={t('dashboard.mttr')} value={d.mttr_hours} accent="text-violet-400" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-surface rounded-xl p-4">
          <p className="font-semibold mb-2">{t('dashboard.byStatus')}</p>
          {d.by_status.map((s) => <p key={s.status} className="text-sm flex justify-between"><span className="text-muted">{s.status}</span><span>{s.count}</span></p>)}
        </div>
        <div className="bg-surface border border-surface rounded-xl p-4">
          <p className="font-semibold mb-2">{t('dashboard.cmdb')}</p>
          {d.cmdb.map((c) => <p key={c.class} className="text-sm flex justify-between"><span className="text-muted">{c.class}</span><span>{c.count}</span></p>)}
        </div>
        <div className="bg-surface border border-surface rounded-xl p-4">
          <p className="font-semibold mb-2">{t('dashboard.jobs')}</p>
          {d.automation.map((j) => <p key={j.status} className="text-sm flex justify-between"><span className="text-muted">{j.status}</span><span>{j.count}</span></p>)}
        </div>
      </div>
    </div>
  );
}
