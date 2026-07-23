import React, { useState } from 'react';
import { api } from '../api.js';

export default function Copilot() {
  const [script, setScript] = useState(null);
  const [logsOut, setLogsOut] = useState(null);
  const [req, setReq] = useState('');
  const [logs, setLogs] = useState('');

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Copilote IA</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <p className="font-semibold">Génération de script</p>
        <textarea className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm" rows={2}
          placeholder="Ex: script PowerShell qui liste les comptes AD verrouillés"
          value={req} onChange={(e) => setReq(e.target.value)} />
        <button onClick={async () => setScript(await api('/ai/script', { method: 'POST', body: { request: req } }))}
          className="bg-violet-600 px-4 py-2 rounded-lg text-sm">Générer</button>
        {script && <pre className="text-xs bg-slate-950 rounded-lg p-3 overflow-auto text-green-300">{script.script}</pre>}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <p className="font-semibold">Analyse de logs</p>
        <textarea className="w-full bg-slate-800 rounded-lg px-3 py-2 text-xs font-mono" rows={5}
          placeholder="Collez vos logs ici…" value={logs} onChange={(e) => setLogs(e.target.value)} />
        <button onClick={async () => setLogsOut(await api('/ai/analyze-logs', { method: 'POST', body: { logs } }))}
          className="bg-violet-600 px-4 py-2 rounded-lg text-sm">Analyser</button>
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
