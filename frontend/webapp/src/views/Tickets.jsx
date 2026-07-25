import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

const PRIO_COLORS = { p1: 'bg-red-500', p2: 'bg-orange-500', p3: 'bg-yellow-500', p4: 'bg-slate-500' };
const STATUSES = ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'];

const EMPTY_FORM = {
  type: 'incident', title: '', description: '', priority: 'p3', category: '',
  is_existing: false, related_ticket_number: '', first_seen_on: new Date().toISOString().slice(0, 10),
  users_affected: '1', error_message: '', asset_tag: '', callback_number: '',
  troubleshooting: '', root_cause: '', resolution_notes: '', kb_article: '',
};

export default function Tickets({ user }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [suggest, setSuggest] = useState(null);
  const [aiBadge, setAiBadge] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const load = () => { api('/tickets').then(setTickets).catch(console.error); };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '' && v !== false));
    const tk = await api('/tickets', { method: 'POST', body });
    // classification IA automatique (ne remplit que ce que l'utilisateur n'a pas fixé)
    api('/ai/classify', { method: 'POST', body: { ticket_id: tk.id, title: tk.title, description: tk.description } })
      .then((c) => { setAiBadge(true); return api(`/tickets/${tk.id}`, { method: 'PATCH', body: { category: form.category || c.category } }); })
      .then(load).catch(() => {});
    setShowForm(false); setForm(EMPTY_FORM); setAiBadge(false);
    load();
  };

  const open = async (tk) => {
    setSel(await api(`/tickets/${tk.id}`));
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
          <h2 className="text-2xl font-bold">{t('tickets.title')}</h2>
          <button onClick={() => setShowForm(!showForm)} className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg text-sm font-semibold">+ {t('tickets.new')}</button>
        </div>
        <div className="bg-surface border border-cyan-800/40 rounded-xl p-3 mb-4 flex items-center gap-4 text-sm" aria-label={t('tickets.itilFlow')}>
          <span className="font-semibold text-cyan-300">🛡 {t('tickets.itilFlow')}</span>
          <span className="flex items-center gap-1"><b className="w-5 h-5 rounded-full bg-cyan-600 text-center text-xs">1</b> {t('itil.step1')}</span>
          <span aria-hidden>→</span>
          <span className="flex items-center gap-1"><b className="w-5 h-5 rounded-full bg-violet-600 text-center text-xs">2</b> {t('itil.step2')}</span>
          <span aria-hidden>→</span>
          <span className="flex items-center gap-1"><b className="w-5 h-5 rounded-full bg-emerald-600 text-center text-xs">3</b> {t('itil.step3')}</span>
          <span className="ml-auto text-muted">{tickets.filter((x) => x.category).length}/{tickets.length} {t('itil.classified')}</span>
        </div>
        {showForm && (
          <form onSubmit={create} className="bg-surface border border-surface rounded-xl p-4 mb-4 space-y-3" aria-label={t('tickets.form.title')}>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label htmlFor="t-type" className="block text-xs text-muted">{t('tickets.type')}</label>
                <select id="t-type" className="bg-input rounded-lg px-3 py-2 text-sm w-full" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="incident">{t('tickets.type')}: Incident</option>
                  <option value="request">{t('tickets.type')}: Demande</option>
                  <option value="problem">{t('tickets.type')}: Problème</option>
                  <option value="change">{t('tickets.type')}: Changement</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="t-priority" className="block text-xs text-muted">{t('tickets.priority')}</label>
                <select id="t-priority" className="bg-input rounded-lg px-3 py-2 text-sm w-full" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="p1">P1 — Critique</option>
                  <option value="p2">P2 — Haute</option>
                  <option value="p3">P3 — Normale</option>
                  <option value="p4">P4 — Basse</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="t-category" className="block text-xs text-muted">{t('tickets.category')}</label>
                <select id="t-category" className="bg-input rounded-lg px-3 py-2 text-sm w-full" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">{t('tickets.category')} (auto IA)</option>
                  {['network', 'account', 'infrastructure', 'messaging', 'application', 'general'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-title" className="block text-xs text-muted">{t('tickets.titleField')}</label>
              <input id="t-title" required className="w-full bg-input rounded-lg px-3 py-2" placeholder={t('tickets.titleField')}
                value={form.title} onChange={set('title')} />
            </div>
            <div className="space-y-1">
              <label htmlFor="t-desc" className="block text-xs text-muted">{t('tickets.description')}</label>
              <textarea id="t-desc" required className="w-full bg-input rounded-lg px-3 py-2" rows={3}
                placeholder={t('tickets.description')}
                value={form.description} onChange={set('description')} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <label className="flex items-center gap-2 bg-input rounded-lg px-3 py-2">
                <input type="checkbox" checked={form.is_existing} onChange={set('is_existing')} />
                {t('tickets.existing')}
              </label>
              {form.is_existing && (
                <div className="space-y-1">
                  <label htmlFor="t-related" className="block text-xs text-muted">{t('tickets.related')}</label>
                  <input id="t-related" className="bg-input rounded-lg px-3 py-2 w-full" placeholder={t('tickets.related')}
                    value={form.related_ticket_number} onChange={set('related_ticket_number')} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <label htmlFor="t-firstseen" className="text-xs text-faint whitespace-nowrap">{t('tickets.firstSeen')}</label>
                <input id="t-firstseen" type="date" className="flex-1 bg-input rounded-lg px-3 py-2"
                  value={form.first_seen_on} onChange={set('first_seen_on')} />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-users" className="block text-xs text-muted">{t('tickets.usersAffected')}</label>
                <select id="t-users" className="bg-input rounded-lg px-3 py-2 w-full" value={form.users_affected} onChange={set('users_affected')}>
                  {['1', '3', '5', '10+'].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="t-asset" className="block text-xs text-muted">{t('tickets.asset')}</label>
                <input id="t-asset" className="bg-input rounded-lg px-3 py-2 w-full" placeholder={t('tickets.asset')}
                  value={form.asset_tag} onChange={set('asset_tag')} />
              </div>
              <div className="space-y-1">
                <label htmlFor="t-callback" className="block text-xs text-muted">{t('tickets.callback')}</label>
                <input id="t-callback" className="bg-input rounded-lg px-3 py-2 w-full" placeholder={t('tickets.callback')}
                  value={form.callback_number} onChange={set('callback_number')} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="t-error" className="block text-xs text-muted">{t('tickets.errorMsg')}</label>
              <input id="t-error" className="w-full bg-input rounded-lg px-3 py-2 text-sm" placeholder={t('tickets.errorMsg')}
                value={form.error_message} onChange={set('error_message')} />
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted">{t('tickets.techDetails')}</summary>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <textarea id="t-ts" className="bg-input rounded-lg px-3 py-2" rows={3} placeholder={t('tickets.troubleshooting')} aria-label={t('tickets.troubleshooting')}
                  value={form.troubleshooting} onChange={set('troubleshooting')} />
                <textarea id="t-rc" className="bg-input rounded-lg px-3 py-2" rows={3} placeholder={t('tickets.rootCause')} aria-label={t('tickets.rootCause')}
                  value={form.root_cause} onChange={set('root_cause')} />
                <textarea id="t-res" className="bg-input rounded-lg px-3 py-2" rows={3} placeholder={t('tickets.resolution')} aria-label={t('tickets.resolution')}
                  value={form.resolution_notes} onChange={set('resolution_notes')} />
              </div>
              <div className="space-y-1 mt-2">
                <label htmlFor="t-kb" className="block text-xs text-muted">{t('tickets.kb')}</label>
                <input id="t-kb" className="w-full bg-input rounded-lg px-3 py-2" placeholder={t('tickets.kb')}
                  value={form.kb_article} onChange={set('kb_article')} />
              </div>
            </details>
            <button type="submit" className="bg-cyan-600 px-4 py-2 rounded-lg text-sm">{t('tickets.create')}</button>
          </form>
        )}
        <div className="space-y-2">
          {tickets.map((tk) => (
            <div key={tk.id} onClick={() => open(tk)}
              className={`bg-surface border rounded-xl p-3 cursor-pointer hover:border-cyan-700 ${sel?.id === tk.id ? 'border-cyan-600' : 'border-surface'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${PRIO_COLORS[tk.priority]}`} />
                <span className="text-faint text-sm">#{tk.number}</span>
                <span className="font-medium flex-1 truncate">{tk.title}</span>
                <span className="text-xs text-faint">{tk.requester_name}</span>
                <span className="text-xs text-cyan-600">{tk.assignee_name || ''}</span>
                <span className="text-xs bg-input px-2 py-1 rounded">{tk.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div className="w-96 bg-surface border border-surface rounded-xl p-4 space-y-3 overflow-auto">
          <h3 className="font-bold">#{sel.number} — {sel.title}</h3>
          <p className="text-sm text-muted">{sel.description}</p>
          <div className="text-xs space-y-1 bg-page rounded-lg p-2">
            <p>{t('tickets.type')}: <span className="text-body">{sel.type}</span> · {t('tickets.priority')}: <span className="text-body">{sel.priority}</span> · {t('tickets.category')}: <span className="text-cyan-400">{sel.category || '—'}</span></p>
            <p>{t('tickets.comments')}: <span className="text-cyan-300">{sel.requester_name || sel.requester_id}</span></p>
            <p>{t('tickets.assign')}: <span className="text-cyan-300">{sel.assignee_name || 'non assigné'}</span></p>
            <p>Créé: {new Date(sel.created_at).toLocaleString(langFmt())}</p>
            <p className="border-t border-surface pt-1">{sel.is_existing ? t('tickets.existing') : t('tickets.new')}
              {sel.is_existing && sel.related_ticket_number ? ` · lié au #${sel.related_ticket_number}` : ''}
              {sel.first_seen_on ? ` · ${t('tickets.firstSeen')}: ${sel.first_seen_on}` : ''}
              {sel.users_affected ? ` · ${sel.users_affected}` : ''}</p>
            {sel.asset_tag && <p>{t('tickets.asset')}: <span className="text-body">{sel.asset_tag}</span></p>}
            {sel.callback_number && <p>{t('tickets.callback')}: <span className="text-body">{sel.callback_number}</span></p>}
            {sel.error_message && <p>{t('tickets.errorMsg')}: <span className="text-body">{sel.error_message}</span></p>}
            {sel.kb_article && <p>KB: <span className="text-cyan-400">{sel.kb_article}</span></p>}
            {sel.troubleshooting && <p>{t('tickets.troubleshooting')}: <span className="text-body whitespace-pre-wrap">{sel.troubleshooting}</span></p>}
            {sel.root_cause && <p>{t('tickets.rootCause')}: <span className="text-body">{sel.root_cause}</span></p>}
            {sel.resolution_notes && <p>{t('tickets.resolution')}: <span className="text-body whitespace-pre-wrap">{sel.resolution_notes}</span></p>}
          </div>
          {aiBadge && <p className="text-xs text-violet-400">✨ {t('tickets.classifiedByAI')}</p>}
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} aria-pressed={sel.status === s}
                className={`text-xs px-2 py-1 rounded ${sel.status === s ? 'bg-cyan-600' : 'bg-input hover:bg-slate-700'}`}>{s}</button>
            ))}
          </div>
          <button onClick={() => api(`/tickets/${sel.id}`, { method: 'PATCH', body: { assignee_id: user.sub } }).then(() => open(sel))}
            className="w-full bg-input hover:bg-slate-700 rounded-lg py-1.5 text-xs">{t('tickets.assign')}</button>
          <button onClick={askAI} className="w-full bg-violet-600/30 border border-violet-600 text-violet-300 rounded-lg py-2 text-sm">💡 {t('tickets.aiSuggestion')}</button>
          {suggest && (
            <ol className="text-sm space-y-1 list-decimal list-inside text-body">
              {suggest.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          <div className="border-t border-surface pt-2">
            <p className="text-xs font-semibold text-faint mb-1">{t('tickets.comments')}</p>
            {sel.comments?.map((c) => (
              <div key={c.id} className="text-xs mb-1">
                <span className="text-cyan-300">{c.author_name || c.author_id}</span>
                <span className="text-slate-600"> · {new Date(c.created_at).toLocaleString(langFmt())}</span>
                <p className="text-body">{c.body}</p>
              </div>
            ))}
            <form onSubmit={async (e) => { e.preventDefault(); const body = e.target.c.value; if (!body) return; await api(`/tickets/${sel.id}/comments`, { method: 'POST', body: { body } }); e.target.reset(); open(sel); }}
              className="flex gap-1 mt-1">
              <label htmlFor="ticket-comment" className="sr-only">{t('tickets.comments')}</label>
              <input id="ticket-comment" name="c" className="flex-1 bg-input rounded px-2 py-1 text-xs" placeholder={t('tickets.commentPlaceholder')} />
              <button type="submit" className="bg-cyan-600 rounded px-2 text-xs">→</button>
            </form>
          </div>
          <div className="border-t border-surface pt-2">
            <p className="text-xs font-semibold text-faint mb-1">{t('tickets.history')}</p>
            {sel.history?.map((h) => (
              <p key={h.id} className="text-xs text-faint">
                <span className="text-cyan-300">{h.actor_name || 'système'}</span> · {h.field}: {h.old_value ?? '—'} → {h.new_value}
                <span className="text-slate-600"> · {new Date(h.at).toLocaleString(langFmt())}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper local: format de date selon la langue courante (fr-FR / en-CA).
function langFmt() {
  const l = (typeof localStorage !== 'undefined' && localStorage.getItem('itsm_lang')) || 'fr';
  return l === 'en' ? 'en-CA' : 'fr-FR';
}
