// Moteur IA : LLM externe (OpenAI-compatible) si AI_API_URL défini,
// sinon fallback heuristique local (règles) — toujours fonctionnel.
const AI_API_URL = process.env.AI_API_URL;   // ex: http://192.168.0.30:11434/v1 (ollama)
const AI_API_KEY = process.env.AI_API_KEY || 'none';
const AI_MODEL = process.env.AI_MODEL || 'llama3.1';

const RULES = [
  { rx: /vpn|tunnel|ipsec|wan|routeur|switch|réseau|network|dns|dhcp/i, category: 'network', team: 'infra' },
  { rx: /mot de passe|password|compte|login|mfa|verrouill|lock/i, category: 'account', team: 'helpdesk' },
  { rx: /vm|hyperviseur|vmware|hyper-v|esxi|serveur|server|disque|disk|cpu|ram/i, category: 'infrastructure', team: 'infra' },
  { rx: /mail|outlook|exchange|smtp|teams|m365|office/i, category: 'messaging', team: 'helpdesk' },
  { rx: /application|logiciel|erreur|bug|crash/i, category: 'application', team: 'apps' },
];
const PRIO = [
  { rx: /production|prod down|critique|urgent|bloqu|down|panne générale/i, priority: 'p1' },
  { rx: /plusieurs|site|service dégradé|lent/i, priority: 'p2' },
];

function heuristic(title, description) {
  const text = `${title} ${description || ''}`;
  const cat = RULES.find((r) => r.rx.test(text));
  const pri = PRIO.find((r) => r.rx.test(text));
  return {
    category: cat?.category || 'general',
    team: cat?.team || 'helpdesk',
    priority: pri?.priority || 'p3',
    confidence: cat ? 0.7 : 0.4,
    model: 'heuristic-v1',
  };
}

async function llm(messages, jsonMode = false) {
  const r = await fetch(`${AI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL, messages, temperature: 0.2,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}`);
  return (await r.json()).choices[0].message.content;
}

async function classify(title, description) {
  if (!AI_API_URL) return heuristic(title, description);
  try {
    const out = await llm([
      { role: 'system', content: 'Tu es un classificateur ITSM. Réponds en JSON: {"category":"network|account|infrastructure|messaging|application|general","priority":"p1|p2|p3|p4","team":"infra|helpdesk|apps","confidence":0..1}' },
      { role: 'user', content: `Titre: ${title}\nDescription: ${description || ''}` },
    ], true);
    return { ...JSON.parse(out), model: AI_MODEL };
  } catch { return heuristic(title, description); }
}

async function suggest(ticket) {
  const base = {
    network: ['Vérifier l\'état du tunnel/équipement (ping, traceroute)', 'Contrôler les logs firewall', 'Redémarrer le service VPN si phase 2 KO'],
    account: ['Vérifier l\'état du compte AD (locked/expired)', 'Runbook ad-unlock-user ou ad-reset-password', 'Contrôler la synchro Azure AD'],
    infrastructure: ['Vérifier CPU/RAM/disque du CI lié', 'Consulter les alertes monitoring', 'Snapshot avant intervention'],
    messaging: ['Vérifier l\'état du service M365 (health dashboard)', 'Tester le flux SMTP', 'Contrôler les quotas boîte'],
    application: ['Reproduire l\'erreur', 'Consulter les logs applicatifs', 'Vérifier la dernière mise en production'],
    general: ['Qualifier la demande', 'Identifier le CI concerné'],
  };
  if (!AI_API_URL) return { steps: base[ticket.category] || base.general, model: 'heuristic-v1' };
  try {
    const out = await llm([
      { role: 'system', content: 'Technicien ITSM senior. Donne 3-5 étapes de résolution concrètes, JSON: {"steps":["..."]}' },
      { role: 'user', content: `Ticket: ${ticket.title}\n${ticket.description || ''}\nCatégorie: ${ticket.category}` },
    ], true);
    return { ...JSON.parse(out), model: AI_MODEL };
  } catch { return { steps: base[ticket.category] || base.general, model: 'heuristic-v1' }; }
}

async function genScript(request) {
  if (!AI_API_URL) {
    return {
      language: 'powershell',
      script: `# Généré (mode heuristique) pour: ${request}\n# Configurez AI_API_URL pour la génération LLM complète.\nWrite-Host "TODO: ${request}"`,
      model: 'heuristic-v1',
    };
  }
  const out = await llm([
    { role: 'system', content: 'Génère UNIQUEMENT le script demandé (PowerShell ou Bash selon le contexte), commenté, avec gestion d\'erreurs. Pas de markdown.' },
    { role: 'user', content: request },
  ]);
  return { language: /bash|linux|sh /i.test(request) ? 'bash' : 'powershell', script: out, model: AI_MODEL };
}

module.exports = { classify, suggest, genScript };
