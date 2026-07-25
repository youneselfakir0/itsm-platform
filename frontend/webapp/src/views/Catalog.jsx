import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

export default function Catalog({ user }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sel, setSel] = useState(null);
  const [formData, setFormData] = useState({});
  const canApprove = (user.permissions || []).some((p) => ['catalog:approve', 'admin:*'].includes(p));

  const load = () => {
    api('/catalog/items').then(setItems).catch(console.error);
    api('/catalog/requests').then(setRequests).catch(console.error);
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    await api('/catalog/requests', { method: 'POST', body: { item_id: sel.id, form_data: formData } });
    setSel(null); setFormData({}); load();
  };

  const decide = async (id, decision) => {
    await api(`/catalog/requests/${id}/decision`, { method: 'POST', body: { decision } });
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('catalog.title')}</h2>
      <div className="grid grid-cols-3 gap-4">
        {items.map((i) => (
          <div key={i.id} onClick={() => { setSel(i); setFormData({}); }}
            className="bg-slate-900 border border-slate-800 hover:border-cyan-700 rounded-xl p-4 cursor-pointer">
            <p className="text-xs text-cyan-500">{i.category}</p>
            <p className="font-semibold">{i.name}</p>
            <p className="text-sm text-slate-400">{i.description}</p>
            {i.requires_approval && <p className="text-xs text-amber-400 mt-1">⚠ {t('catalog.approvalRequired')}</p>}
          </div>
        ))}
      </div>
      {sel && (
        <form onSubmit={submit} className="bg-slate-900 border border-cyan-800 rounded-xl p-4 space-y-3 max-w-md">
          <h3 className="font-bold">{sel.name}</h3>
          {(sel.form_schema || []).map((f) => (
            <div key={f.name}>
              <label htmlFor={`cf-${f.name}`} className="text-sm text-slate-400">{f.label}</label>
              {f.type === 'select' ? (
                <select id={`cf-${f.name}`} className="w-full bg-slate-800 rounded-lg px-3 py-2"
                  onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input id={`cf-${f.name}`} required={f.required} type={f.type === 'number' ? 'number' : 'text'}
                  className="w-full bg-slate-800 rounded-lg px-3 py-2"
                  onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="submit" className="bg-cyan-600 px-4 py-2 rounded-lg text-sm">{t('catalog.submit')}</button>
            <button type="button" onClick={() => setSel(null)} className="bg-slate-800 px-4 py-2 rounded-lg text-sm">{t('catalog.cancel')}</button>
          </div>
        </form>
      )}
      <div>
        <h3 className="font-bold mb-2">{t('catalog.requests')}</h3>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
              <span className="flex-1">{r.item_name}</span>
              <span className={`text-xs px-2 py-1 rounded ${r.status === 'approved' ? 'bg-green-900 text-green-300' : r.status === 'rejected' ? 'bg-red-900 text-red-300' : 'bg-slate-800'}`}>{r.status}</span>
              {canApprove && r.status === 'pending_approval' && (
                <>
                  <button onClick={() => decide(r.id, 'approved')} className="text-xs bg-green-700 px-2 py-1 rounded">{t('catalog.approve')}</button>
                  <button onClick={() => decide(r.id, 'rejected')} className="text-xs bg-red-700 px-2 py-1 rounded">{t('catalog.reject')}</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
