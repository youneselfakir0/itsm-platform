import React, { useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken, decodeJwt } from './api.js';
import { useI18n, LANGS } from './i18n.js';
import { useTheme } from './theme.js';
import Tickets from './views/Tickets.jsx';
import Catalog from './views/Catalog.jsx';
import Cmdb from './views/Cmdb.jsx';
import Automation from './views/Automation.jsx';
import Dashboard from './views/Dashboard.jsx';
import Copilot from './views/Copilot.jsx';

const NAV = [
  { id: 'tickets', key: 'nav.tickets', perm: 'ticket:read' },
  { id: 'catalog', key: 'nav.catalog', perm: 'catalog:read' },
  { id: 'cmdb', key: 'nav.cmdb', perm: 'ci:read' },
  { id: 'automation', key: 'nav.automation', perm: 'automation:read' },
  { id: 'dashboard', key: 'nav.dashboard', perm: 'report:read' },
  { id: 'copilot', key: 'nav.copilot', perm: 'ai:use' },
];

function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('lang.select')}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`text-xs px-2 py-1 rounded ${lang === l.code ? 'bg-cyan-600 text-white' : 'bg-input text-muted hover:bg-slate-700'}`}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme, t } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={t('theme.toggle')}
      className="text-xs px-2 py-1 rounded bg-input text-muted hover:bg-slate-700">
      {theme === 'dark' ? '☀ Clair' : '🌙 Sombre'}
    </button>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const { t } = useI18n();
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(r.accessToken);
      location.reload();
    } catch (e2) { setErr(e2.message); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-surface p-8 rounded-2xl border border-surface w-96 space-y-4" aria-labelledby="login-title">
        <h1 id="login-title" className="text-2xl font-bold text-center">Twister<span className="text-cyan-400">ITSM</span></h1>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm text-muted">{t('login.email')}</label>
          <input id="email" name="email" type="email" autoComplete="username" required
            className="w-full bg-input rounded-lg px-3 py-2 outline-none focus:ring-2 ring-cyan-500"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm text-muted">{t('login.password')}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required
            className="w-full bg-input rounded-lg px-3 py-2 outline-none focus:ring-2 ring-cyan-500"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p role="alert" className="text-red-400 text-sm">{t('login.error')}: {err}</p>}
        <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-lg py-2 font-semibold">{t('login.submit')}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('tickets');
  const { t } = useI18n();
  const user = getToken() ? decodeJwt() : null;
  useEffect(() => {
    if (user && user.exp * 1000 < Date.now()) { clearToken(); location.reload(); }
  }, []);
  if (!user) return <Login />;

  const perms = user.permissions || [];
  const has = (p) => perms.includes(p) || perms.includes('admin:*');
  const nav = NAV.filter((n) => has(n.perm));
  const Views = { tickets: Tickets, catalog: Catalog, cmdb: Cmdb, automation: Automation, dashboard: Dashboard, copilot: Copilot };
  const View = Views[view] || Tickets;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-surface border-r border-surface p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6">Twister<span className="text-cyan-400">ITSM</span></h1>
        <nav aria-label={t('nav.main')} className="space-y-1 flex-1">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              aria-current={view === n.id ? 'page' : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${view === n.id ? 'bg-cyan-600/20 text-cyan-300' : 'hover:bg-input text-muted'}`}>
              {t(n.key)}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 mb-2">
          <LangSwitcher />
          <ThemeSwitcher />
        </div>
        <div className="text-xs text-faint border-t border-surface pt-3">
          <p className="truncate">{user.email}</p>
          <p className="uppercase text-cyan-500">{user.role}</p>
          <button onClick={() => { clearToken(); location.reload(); }} className="mt-2 text-red-400 hover:text-red-300">{t('nav.logout')}</button>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="flex-1 p-6 overflow-auto outline-none"><View user={user} /></main>
    </div>
  );
}
