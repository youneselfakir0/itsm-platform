import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const PRIO_COLORS = { p1: 'bg-red-500', p2: 'bg-orange-500', p3: 'bg-yellow-500', p4: 'bg-slate-500' };
const STATUSES = ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'];

export default function Tickets({ user }) {
  const [tickets, setTickets] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'p3' });
  const [showForm, setShowForm] = useState(false);
  const [suggest, setSuggest] = useState(null);

  const load = () => { api('/tickets').then(setTickets).catch(console.error); };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    const t = await api('/tickets', { method: 'POST', body: form });
    // classification IA automatique
    api('/ai/classify', { method: 'POST', body: { ticket_id: t.id, title: t.title, description: t.description } })
      .then((c) => api(`/tickets/${t.id}`, { method: 'PATCH', body: { category: c.category, priority: c.priority } }))
      .then(load).catch(() => {});
    setShowForm(false); setForm({ title: '', description: '', priority: 'p3' });
    load();
  };

  const open = async (t) => {
    setSel(await api(`/tickets/${t.id}`));
    setSuggest(null);
  };

  const setStatus = async (status) => {
    await api(`/tickets/${sel.id}`, { method: 'PATCH', body: { status } });
    open(sel); load();
  };

  const askAI = async () => setSuggest(await api('/ai/suggest', { method: 'POST', body: sel }));

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1">
        <div className="flex justify-between mb-4">
          <h2 className="text-2xl font-bold">Tickets</h2>
          <button onClick={() => setShowForm(!showForm)} className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg text-sm font-semibold">+ Nouveau</button>
        </div>
        {showForm && (
          <form onSubmit={create} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 space-y-3">
            <input required className="w-full bg-slate-800 rounded-lg px-3 py-2" placeholder="Titre"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="w-full bg-slate-800 rounded-lg px-3 py-2" placeholder="Description" rows={3}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button className="bg-cyan-600 px-4 py-2 rounded-lg text-sm">Créer (classification IA auto)</button>
          </form>
        )}
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} onClick={() => open(t)}
              className={`bg-slate-900 border rounded-xl p-3 cursor-pointer hover:border-cyan-700 ${sel?.id === t.id ? 'border-cyan-600' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${PRIO_COLORS[t.priority]}`} />
                <span className="text-slate-500 text-sm">#{t.number}</span>
                <span className="font-medium flex-1 truncate">{t.title}</span>
                <span className="text-xs bg-slate-800 px-2 py-1 rounded">{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div className="w-96 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 overflow-auto">
          <h3 className="font-bold">#{sel.number} — {sel.title}</h3>
          <p className="text-sm text-slate-400">{sel.description}</p>
          <p className="text-xs">Catégorie: <span className="text-cyan-400">{sel.category || '—'}</span> · Priorité: {sel.priority}</p>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`text-xs px-2 py-1 rounded ${sel.status === s ? 'bg-cyan-600' : 'bg-slate-800 hover:bg-slate-700'}`}>{s}</button>
            ))}
          </div>
          <button onClick={askAI} className="w-full bg-violet-600/30 border border-violet-600 text-violet-300 rounded-lg py-2 text-sm">💡 Suggestion IA</button>
          {suggest && (
            <ol className="text-sm space-y-1 list-decimal list-inside text-slate-300">
              {suggest.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          <div className="border-t border-slate-800 pt-2">
            <p className="text-xs font-semibold text-slate-500 mb-1">Historique</p>
            {sel.history?.map((h) => (
              <p key={h.id} className="text-xs text-slate-500">{h.field}: {h.old_value} → {h.new_value}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
