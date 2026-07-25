import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

function Card({ label, value, accent }) {
  return (
    <div className="bg-surface border border-surface rounded-xl p-4">
      <p className="text-sm text-faint">{label}</p>
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
      <div className="bg-surface border border-cyan-800/40 rounded-xl p-4">
        <p className="font-semibold mb-3">🛡 {t('tickets.itilFlow')}</p>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="flex items-center gap-1"><b className="w-5 h-5 rounded-full bg-cyan-600 text-center text-xs">1</b> {t('itil.step1')}</span>
          <span aria-hidden>→</span>
          <span className="flex items-center gap-1"><b className="w-5 h-5 rounded-full bg-violet-600 text-center text-xs">2</b> {t('itil.step2')}</span>
          <span aria-hidden>→</span>
          <span className="flex items-center gap-1"><b className="w-5 h-5 rounded-full bg-emerald-600 text-center text-xs">3</b> {t('itil.step3')}</span>
        </div>
        <p className="text-xs text-faint mt-3">{t('dashboard.openTickets')}: {d.tickets.open} · MTTR: {d.mttr_hours} h</p>
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
