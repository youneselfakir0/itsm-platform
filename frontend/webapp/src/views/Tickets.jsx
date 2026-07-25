import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const PRIO_COLORS = { p1: 'bg-red-500', p2: 'bg-orange-500', p3: 'bg-yellow-500', p4: 'bg-slate-500' };
const STATUSES = ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'];

const EMPTY_FORM = {
  type: 'incident', title: '', description: '', priority: 'p3', category: '',
  is_existing: false, related_ticket_number: '', first_seen_on: new Date().toISOString().slice(0, 10),
  users_affected: '1', error_message: '', asset_tag: '', callback_number: '',
  troubleshooting: '', root_cause: '', resolution_notes: '', kb_article: '',
};

export default function Tickets({ user }) {
  const [tickets, setTickets] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [suggest, setSuggest] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const load = () => { api('/tickets').then(setTickets).catch(console.error); };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v !== false));
    const t = await api('/tickets', { method: 'POST', body });
    // classification IA automatique (ne remplit que ce que l'utilisateur n'a pas fixé)
    api('/ai/classify', { method: 'POST', body: { ticket_id: t.id, title: t.title, description: t.description } })
      .then((c) => api(`/tickets/${t.id}`, { method: 'PATCH', body: { category: form.category || c.category } }))
      .then(load).catch(() => {});
    setShowForm(false); setForm(EMPTY_FORM);
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
          <form onSubmit={create} className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 space-y-3" aria-label="Nouveau ticket">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label htmlFor="t-type" className="block text-xs text-slate-400">Type</label>
                <select id="t-type" className="bg-slate-800 rounded-lg px-3 py-2 text-sm w-full" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="incident">Incident</option>
                  <option value="request">Demande</option>
                  <option value="problem">Problème</option>
                  <option value="change">Changement</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="t-priority" className="block text-xs text-slate-400">Priorité</label>
                <select id="t-priority" className="bg-slate-800 rounded-lg px-3 py-2 text-sm w-full" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="p1">P1 — Critique</option>
                  <option value="p2">P2 — Haute</option>
                  <option value="p3">P3 — Normale</option>
                  <option value="p4">P4 — Basse</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="t-category" className="block text-xs text-slate-400">Catégorie</label>
                <select id="t-category" className="bg-slate-800 rounded-lg px-3 py-2 text-sm w-full" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Catégorie (auto IA)</option>
                  {['network', 'account', 'infrastructure', 'messaging', 'application', 'general'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-title" className="block text-xs text-slate-400">Titre</label>
              <input id="t-title" required className="w-full bg-slate-800 rounded-lg px-3 py-2" placeholder="Titre"
                value={form.title} onChange={set('title')} />
            </div>
            <div className="space-y-1">
              <label htmlFor="t-desc" className="block text-xs text-slate-400">Description</label>
              <textarea id="t-desc" required className="w-full bg-slate-800 rounded-lg px-3 py-2" rows={3}
                placeholder="Description du problème par l'utilisateur : impact, contexte…"
                value={form.description} onChange={set('description')} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <label className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <input type="checkbox" checked={form.is_existing} onChange={set('is_existing')} />
                Problème existant ?
              </label>
              {form.is_existing && (
                <div className="space-y-1">
                  <label htmlFor="t-related" className="block text-xs text-slate-400">N° ticket existant</label>
                  <input id="t-related" className="bg-slate-800 rounded-lg px-3 py-2 w-full" placeholder="N° ticket existant"
                    value={form.related_ticket_number} onChange={set('related_ticket_number')} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <label htmlFor="t-firstseen" className="text-xs text-slate-500 whitespace-nowrap">1ère occurrence</label>
                <input id="t-firstseen" type="date" className="flex-1 bg-slate-800 rounded-lg px-3 py-2"
                  value={form.first_seen_on} onChange={set('first_seen_on')} />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-users" className="block text-xs text-slate-400">Utilisateurs affectés</label>
                <select id="t-users" className="bg-slate-800 rounded-lg px-3 py-2 w-full" value={form.users_affected} onChange={set('users_affected')}>
                  {['1', '3', '5', '10+'].map((n) => <option key={n} value={n}>{n} utilisateur(s) affecté(s)</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="t-asset" className="block text-xs text-slate-400">Actif / N° de série</label>
                <input id="t-asset" className="bg-slate-800 rounded-lg px-3 py-2 w-full" placeholder="Actif / N° de série"
                  value={form.asset_tag} onChange={set('asset_tag')} />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-callback" className="block text-xs text-slate-400">N° de rappel</label>
                <input id="t-callback" className="bg-slate-800 rounded-lg px-3 py-2 w-full" placeholder="N° de rappel"
                  value={form.callback_number} onChange={set('callback_number')} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-error" className="block text-xs text-slate-400">Message / code d'erreur</label>
              <input id="t-error" className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm" placeholder="Message / code d'erreur"
                value={form.error_message} onChange={set('error_message')} />
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-slate-400">Champs technicien (dépannage, cause racine, résolution, KB)</summary>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <textarea id="t-ts" className="bg-slate-800 rounded-lg px-3 py-2" rows={3} placeholder="Étapes de dépannage effectuées" aria-label="Étapes de dépannage"
                  value={form.troubleshooting} onChange={set('troubleshooting')} />
                <textarea id="t-rc" className="bg-slate-800 rounded-lg px-3 py-2" rows={3} placeholder="Cause racine identifiée" aria-label="Cause racine identifiée"
                  value={form.root_cause} onChange={set('root_cause')} />
                <textarea id="t-res" className="bg-slate-800 rounded-lg px-3 py-2" rows={3} placeholder="Résolution / prochaines étapes" aria-label="Résolution"
                  value={form.resolution_notes} onChange={set('resolution_notes')} />
              </div>
              <div className="space-y-1 mt-2">
                <label htmlFor="t-kb" className="block text-xs text-slate-400">Article KB / Confluence utilisé</label>
                <input id="t-kb" className="w-full bg-slate-800 rounded-lg px-3 py-2" placeholder="Article KB / Confluence utilisé"
                  value={form.kb_article} onChange={set('kb_article')} />
              </div>
            </details>
            <button type="submit" className="bg-cyan-600 px-4 py-2 rounded-lg text-sm">Créer</button>
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
                <span className="text-xs text-slate-500">{t.requester_name}</span>
                <span className="text-xs text-cyan-600">{t.assignee_name || ''}</span>
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
          <div className="text-xs space-y-1 bg-slate-950 rounded-lg p-2">
            <p>Type: <span className="text-slate-300">{sel.type}</span> · Priorité: <span className="text-slate-300">{sel.priority}</span> · Catégorie: <span className="text-cyan-400">{sel.category || '—'}</span></p>
            <p>Demandeur: <span className="text-cyan-300">{sel.requester_name || sel.requester_id}</span></p>
            <p>Assigné à: <span className="text-cyan-300">{sel.assignee_name || 'non assigné'}</span></p>
            <p>Créé: {new Date(sel.created_at).toLocaleString('fr-FR')}</p>
            <p className="border-t border-slate-800 pt-1">{sel.is_existing ? 'Problème existant' : 'Nouveau'}
              {sel.is_existing && sel.related_ticket_number ? ` · lié au #${sel.related_ticket_number}` : ''}
              {sel.first_seen_on ? ` · 1ère occurrence: ${sel.first_seen_on}` : ''}
              {sel.users_affected ? ` · ${sel.users_affected} affecté(s)` : ''}</p>
            {sel.asset_tag && <p>Actif / N° série: <span className="text-slate-300">{sel.asset_tag}</span></p>}
            {sel.callback_number && <p>N° de rappel: <span className="text-slate-300">{sel.callback_number}</span></p>}
            {sel.error_message && <p>Erreur: <span className="text-slate-300">{sel.error_message}</span></p>}
            {sel.kb_article && <p>KB: <span className="text-cyan-400">{sel.kb_article}</span></p>}
            {sel.troubleshooting && <p>Dépannage: <span className="text-slate-300 whitespace-pre-wrap">{sel.troubleshooting}</span></p>}
            {sel.root_cause && <p>Cause racine: <span className="text-slate-300">{sel.root_cause}</span></p>}
            {sel.resolution_notes && <p>Résolution: <span className="text-slate-300 whitespace-pre-wrap">{sel.resolution_notes}</span></p>}
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} aria-pressed={sel.status === s}
                className={`text-xs px-2 py-1 rounded ${sel.status === s ? 'bg-cyan-600' : 'bg-slate-800 hover:bg-slate-700'}`}>{s}</button>
            ))}
          </div>
          <button onClick={() => api(`/tickets/${sel.id}`, { method: 'PATCH', body: { assignee_id: user.sub } }).then(() => open(sel))}
            className="w-full bg-slate-800 hover:bg-slate-700 rounded-lg py-1.5 text-xs">Me l'assigner</button>
          <button onClick={askAI} className="w-full bg-violet-600/30 border border-violet-600 text-violet-300 rounded-lg py-2 text-sm">💡 Suggestion IA</button>
          {suggest && (
            <ol className="text-sm space-y-1 list-decimal list-inside text-slate-300">
              {suggest.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          <div className="border-t border-slate-800 pt-2">
            <p className="text-xs font-semibold text-slate-500 mb-1">Commentaires</p>
            {sel.comments?.map((c) => (
              <div key={c.id} className="text-xs mb-1">
                <span className="text-cyan-300">{c.author_name || c.author_id}</span>
                <span className="text-slate-600"> · {new Date(c.created_at).toLocaleString('fr-FR')}</span>
                <p className="text-slate-300">{c.body}</p>
              </div>
            ))}
            <form onSubmit={async (e) => { e.preventDefault(); const body = e.target.c.value; if (!body) return; await api(`/tickets/${sel.id}/comments`, { method: 'POST', body: { body } }); e.target.reset(); open(sel); }}
              className="flex gap-1 mt-1">
              <label htmlFor="ticket-comment" className="sr-only">Commenter</label>
              <input id="ticket-comment" name="c" className="flex-1 bg-slate-800 rounded px-2 py-1 text-xs" placeholder="Commenter…" />
              <button type="submit" className="bg-cyan-600 rounded px-2 text-xs">→</button>
            </form>
          </div>
          <div className="border-t border-slate-800 pt-2">
            <p className="text-xs font-semibold text-slate-500 mb-1">Historique (qui a fait quoi)</p>
            {sel.history?.map((h) => (
              <p key={h.id} className="text-xs text-slate-500">
                <span className="text-cyan-300">{h.actor_name || 'système'}</span> · {h.field}: {h.old_value ?? '—'} → {h.new_value}
                <span className="text-slate-600"> · {new Date(h.at).toLocaleString('fr-FR')}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
