import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.js';

export default function Cmdb() {
  const { t } = useI18n();
  const [cis, setCis] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ class: 'server', name: '', attributes: '{}' });
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api('/cmdb/cis').then(setCis).catch(console.error);
    api('/cmdb/classes').then(setClasses).catch(console.error);
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    await api('/cmdb/cis', { method: 'POST', body: { ...form, attributes: JSON.parse(form.attributes || '{}') } });
    setShowForm(false); load();
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="flex justify-between mb-4">
          <h2 className="text-2xl font-bold">{t('cmdb.title')}</h2>
          <button onClick={() => setShowForm(!showForm)} className="bg-cyan-600 px-4 py-2 rounded-lg text-sm font-semibold">+ {t('cmdb.new')}</button>
        </div>
        {showForm && (
          <form onSubmit={create} className="bg-surface border border-surface rounded-xl p-4 mb-4 space-y-2" aria-label={t('cmdb.form.title')}>
            <div className="space-y-1">
              <label htmlFor="ci-class" className="block text-xs text-muted">{t('cmdb.class')}</label>
              <select id="ci-class" className="w-full bg-input rounded-lg px-3 py-2" value={form.class}
                onChange={(e) => setForm({ ...form, class: e.target.value })}>
                {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="ci-name" className="block text-xs text-muted">{t('cmdb.name')}</label>
              <input id="ci-name" required className="w-full bg-input rounded-lg px-3 py-2" placeholder={t('cmdb.name')}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="ci-attrs" className="block text-xs text-muted">{t('cmdb.attributes')}</label>
              <textarea id="ci-attrs" className="w-full bg-input rounded-lg px-3 py-2 font-mono text-xs" rows={3}
                placeholder='{"os":"...","ip":"..."}'
                value={form.attributes} onChange={(e) => setForm({ ...form, attributes: e.target.value })} />
            </div>
            <button type="submit" className="bg-cyan-600 px-4 py-2 rounded-lg text-sm">{t('cmdb.create')}</button>
          </form>
        )}
        <table className="w-full text-sm">
          <caption className="text-left text-xs text-faint mb-1">{t('cmdb.caption')}</caption>
          <thead><tr className="text-left text-faint border-b border-surface">
            <th scope="col" className="py-2">{t('cmdb.name')}</th><th scope="col">{t('cmdb.class')}</th><th scope="col">Statut</th><th scope="col">Env</th></tr></thead>
          <tbody>
            {cis.map((c) => (
              <tr key={c.id} onClick={async () => setSel(await api(`/cmdb/cis/${c.id}`))}
                className="border-b border-slate-900 hover:bg-surface cursor-pointer">
                <td className="py-2 font-medium">{c.name}</td>
                <td className="text-cyan-400">{c.class}</td>
                <td>{c.status}</td><td>{c.environment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="w-96 bg-surface border border-surface rounded-xl p-4 space-y-3">
          <h3 className="font-bold">{sel.name} <span className="text-cyan-500 text-sm">({sel.class})</span></h3>
          <pre className="text-xs bg-page rounded-lg p-2 overflow-auto">{JSON.stringify(sel.attributes, null, 2)}</pre>
          <div>
            <p className="text-xs font-semibold text-faint mb-1">{t('cmdb.relations')}</p>
            {sel.relations?.map((r, i) => (
              <p key={i} className="text-sm">{r.dir === 'out' ? '→' : '←'} <span className="text-cyan-400">{r.relation}</span> {r.target_name}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
