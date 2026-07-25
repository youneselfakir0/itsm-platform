import React, { useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

export default function Copilot() {
  const { t } = useI18n();
  const [script, setScript] = useState(null);
  const [logsOut, setLogsOut] = useState(null);
  const [req, setReq] = useState('');
  const [logs, setLogs] = useState('');

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">{t('copilot.title')}</h2>
      <div className="bg-surface border border-surface rounded-xl p-4 space-y-2">
        <p className="font-semibold">{t('copilot.scriptGen')}</p>
        <div className="space-y-1">
          <label htmlFor="ai-req" className="block text-sm text-muted">{t('copilot.request')}</label>
          <textarea id="ai-req" className="w-full bg-input rounded-lg px-3 py-2 text-sm" rows={2}
            placeholder="Ex: script PowerShell qui liste les comptes AD verrouillés"
            value={req} onChange={(e) => setReq(e.target.value)} />
        </div>
        <button type="button" onClick={async () => setScript(await api('/ai/script', { method: 'POST', body: { request: req } }))}
          className="bg-violet-600 px-4 py-2 rounded-lg text-sm">{t('copilot.generate')}</button>
        {script && <pre className="text-xs bg-slate-950 rounded-lg p-3 overflow-auto text-green-300">{script.script}</pre>}
      </div>
      <div className="bg-surface border border-surface rounded-xl p-4 space-y-2">
        <p className="font-semibold">{t('copilot.logAnalysis')}</p>
        <div className="space-y-1">
          <label htmlFor="ai-logs" className="block text-sm text-muted">{t('copilot.logs')}</label>
          <textarea id="ai-logs" className="w-full bg-input rounded-lg px-3 py-2 text-xs font-mono" rows={5}
            placeholder="Collez vos logs ici…" value={logs} onChange={(e) => setLogs(e.target.value)} />
        </div>
        <button type="button" onClick={async () => setLogsOut(await api('/ai/analyze-logs', { method: 'POST', body: { logs } }))}
          className="bg-violet-600 px-4 py-2 rounded-lg text-sm">{t('copilot.analyze')}</button>
        {logsOut && (
          <div className="text-sm space-y-1">
            <p className="text-cyan-300">{logsOut.summary}</p>
            {logsOut.errors.map((e, i) => <p key={i} className="text-xs font-mono text-red-400">{e}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
