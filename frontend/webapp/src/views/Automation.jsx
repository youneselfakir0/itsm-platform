import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Automation() {
  const [runbooks, setRunbooks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [sel, setSel] = useState(null);
  const [params, setParams] = useState('{}');

  const load = () => {
    api('/automation/runbooks').then(setRunbooks).catch(console.error);
    api('/automation/jobs').then(setJobs).catch(console.error);
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const launch = async (rb) => {
    await api('/automation/jobs', { method: 'POST', body: { runbook: rb.name, params: JSON.parse(params || '{}'), dry_run: true } });
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Automation <span className="text-xs text-amber-400 font-normal">(dry-run forcé côté UI)</span></h2>
      <div className="grid grid-cols-2 gap-4">
        {runbooks.map((rb) => (
          <div key={rb.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="font-semibold">{rb.name}</p>
            <p className="text-sm text-slate-400">{rb.description}</p>
            <p className="text-xs text-slate-500 mt-1">connector: {rb.connector} · action: {rb.action}</p>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 space-y-1">
                <label htmlFor={`params-${rb.id}`} className="block text-xs text-slate-400">Paramètres (JSON)</label>
                <input id={`params-${rb.id}`} className="flex-1 bg-slate-800 rounded-lg px-2 py-1 text-xs font-mono" placeholder='{"sam":"jdoe"}'
                  onChange={(e) => setParams(e.target.value)} />
              </div>
              <button type="button" onClick={() => launch(rb)} className="bg-cyan-600 px-3 py-1 rounded-lg text-xs self-end">Lancer</button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-bold mb-2">Jobs récents</h3>
        <div className="space-y-1">
          {jobs.map((j) => (
            <div key={j.id} onClick={async () => setSel(await api(`/automation/jobs/${j.id}`))}
              className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm flex gap-3 cursor-pointer hover:border-cyan-700">
              <span className="flex-1">{j.runbook}</span>
              {j.dry_run && <span className="text-xs text-amber-400">dry-run</span>}
              <span className={j.status === 'succeeded' ? 'text-green-400' : j.status === 'failed' ? 'text-red-400' : 'text-slate-400'}>{j.status}</span>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <p className="font-bold text-sm mb-2">{sel.runbook} — logs</p>
          {sel.logs?.map((l, i) => <p key={i} className="text-xs font-mono text-slate-400">[{l.level}] {l.message}</p>)}
          <pre className="text-xs text-cyan-300 mt-2">{JSON.stringify(sel.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
