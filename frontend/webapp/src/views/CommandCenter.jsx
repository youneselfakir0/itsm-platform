import React, { useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

export default function CommandCenter() {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [err, setErr] = useState(null);

  const suggest = async () => {
    setErr(null);
    try {
      const res = await api('/ai/classify', { method: 'POST', body: { title: input } });
      setSuggestion(res);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">{t('command.title')}</h2>
      <div className="bg-surface border border-surface rounded-xl p-4 space-y-2">
        <p className="font-semibold">{t('command.suggest')}</p>
        <div className="space-y-1">
          <label htmlFor="cc-input" className="block text-sm text-muted">{t('command.prompt')}</label>
          <textarea id="cc-input" className="w-full bg-input rounded-lg px-3 py-2 text-sm" rows={3}
            placeholder="Ex: VPN down au bureau, les utilisateurs ne peuvent pas accéder au réseau"
            value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button type="button" onClick={suggest}
          className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg text-sm">{t('command.classify')}</button>
        {err && <p role="alert" className="text-red-400 text-sm">{err}</p>}
        {suggestion && (
          <div className="text-sm space-y-1 bg-slate-950 rounded-lg p-3">
            <p className="text-cyan-300">Catégorie : {suggestion.category}</p>
            <p className="text-cyan-300">Priorité : {suggestion.priority}</p>
            <p className="text-cyan-300">Équipe : {suggestion.team}</p>
            <p className="text-xs text-muted">Confiance : {suggestion.confidence} ({suggestion.source})</p>
          </div>
        )}
      </div>
    </div>
  );
}
