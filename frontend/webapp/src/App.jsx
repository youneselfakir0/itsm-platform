import React, { useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken, decodeJwt } from './api.js';
import Tickets from './views/Tickets.jsx';
import Catalog from './views/Catalog.jsx';
import Cmdb from './views/Cmdb.jsx';
import Automation from './views/Automation.jsx';
import Dashboard from './views/Dashboard.jsx';
import Copilot from './views/Copilot.jsx';

const NAV = [
  { id: 'tickets', label: 'Tickets', perm: 'ticket:read' },
  { id: 'catalog', label: 'Catalogue', perm: 'catalog:read' },
  { id: 'cmdb', label: 'CMDB', perm: 'ci:read' },
  { id: 'automation', label: 'Automation', perm: 'automation:read' },
  { id: 'dashboard', label: 'Dashboard', perm: 'report:read' },
  { id: 'copilot', label: 'Copilote IA', perm: 'ai:use' },
];

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
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
      <form onSubmit={submit} className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-96 space-y-4" aria-labelledby="login-title">
        <h1 id="login-title" className="text-2xl font-bold text-center">Twister<span className="text-cyan-400">ITSM</span></h1>
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm text-slate-400">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required
            className="w-full bg-slate-800 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-cyan-500"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm text-slate-400">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required
            className="w-full bg-slate-800 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-cyan-500"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p role="alert" className="text-red-400 text-sm">{err}</p>}
        <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-lg py-2 font-semibold">Connexion</button>
      </form>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('tickets');
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
      <aside className="w-56 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6">Twister<span className="text-cyan-400">ITSM</span></h1>
        <nav aria-label="Navigation principale" className="space-y-1 flex-1">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              aria-current={view === n.id ? 'page' : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${view === n.id ? 'bg-cyan-600/20 text-cyan-300' : 'hover:bg-slate-800 text-slate-300'}`}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="text-xs text-slate-500 border-t border-slate-800 pt-3">
          <p className="truncate">{user.email}</p>
          <p className="uppercase text-cyan-500">{user.role}</p>
          <button onClick={() => { clearToken(); location.reload(); }} className="mt-2 text-red-400 hover:text-red-300">Déconnexion</button>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="flex-1 p-6 overflow-auto outline-none"><View user={user} /></main>
    </div>
  );
}
