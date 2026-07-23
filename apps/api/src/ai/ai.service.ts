import { Injectable } from '@nestjs/common';

const AI_API_URL = process.env.AI_API_URL; // ex: http://192.168.0.20:11434/v1/chat/completions
const AI_MODEL = process.env.AI_MODEL || 'llama3';

const RULES: { re: RegExp; category: string; priority: string; team: string }[] = [
  { re: /vpn|réseau|network|dns|firewall|flux/i, category: 'network', priority: 'p2', team: 'infra' },
  { re: /mot de passe|password|compte|account|verrou|lock|ad |active directory/i, category: 'account', priority: 'p3', team: 'support' },
  { re: /serveur|server|cpu|ram|disk|vm|hyper|vmware/i, category: 'infrastructure', priority: 'p1', team: 'infra' },
  { re: /mail|outlook|exchange|smtp|messagerie/i, category: 'messaging', priority: 'p2', team: 'support' },
];

async function llm(prompt: string): Promise<string | null> {
  if (!AI_API_URL) return null;
  try {
    const r = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.AI_API_KEY ? { Authorization: `Bearer ${process.env.AI_API_KEY}` } : {}) },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'user', content: prompt }], stream: false }),
    });
    const j: any = await r.json();
    return j.choices?.[0]?.message?.content ?? j.response ?? null;
  } catch { return null; }
}

@Injectable()
export class AiService {
  async classify(dto: { title: string; description?: string }) {
    const text = `${dto.title} ${dto.description ?? ''}`;
    const hit = RULES.find((r) => r.re.test(text));
    const heuristic = hit
      ? { category: hit.category, priority: hit.priority, team: hit.team, confidence: 0.6, source: 'heuristic' }
      : { category: 'general', priority: 'p3', team: 'support', confidence: 0.4, source: 'heuristic' };
    const out = await llm(`Classe ce ticket ITSM. Réponds en JSON {category,priority,team}. Ticket: ${text}`);
    if (out) {
      try { return { ...heuristic, ...JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? '{}'), source: 'llm' }; } catch { /* fallback */ }
    }
    return heuristic;
  }

  async suggest(dto: { title: string; category?: string; description?: string }) {
    const out = await llm(`Donne 3 à 5 étapes de résolution concrètes pour ce ticket. Ticket: ${dto.title} ${dto.description ?? ''}`);
    if (out) return { steps: out.split(/\n+/).filter((l) => l.trim()).slice(0, 5), source: 'llm' };
    const base: Record<string, string[]> = {
      network: ['Vérifier la connectivité (ping/traceroute)', 'Contrôler la config VPN/DNS', 'Redémarrer l’interface réseau', 'Escalader à l’équipe infra si persistant'],
      account: ['Vérifier le statut du compte AD', 'Déverrouiller / réinitialiser le mot de passe', 'Contrôler l’appartenance aux groupes', 'Demander à l’utilisateur de retester'],
      messaging: ['Vérifier le profil de messagerie', 'Recréer le profil Outlook/OST', 'Contrôler la connectivité au serveur mail', 'Escalader si problème serveur'],
    };
    return { steps: base[dto.category ?? ''] ?? ['Reproduire le problème', 'Consulter la base de connaissances', 'Appliquer le correctif', 'Documenter la résolution'], source: 'heuristic' };
  }

  async script(dto: { request: string }) {
    const out = await llm(`Génère un script (PowerShell ou Bash) pour: ${dto.request}. Réponds uniquement avec le script.`);
    return { script: out ?? `# Généré localement (LLM indisponible)\n# Tâche: ${dto.request}\nWrite-Host "TODO: implémenter ${dto.request}"`, source: out ? 'llm' : 'heuristic' };
  }

  async analyzeLogs(dto: { logs: string }) {
    const lines = dto.logs.split(/\n/);
    const errors = lines.filter((l) => /error|fail|exception|critical|fatal/i.test(l));
    const warnings = lines.filter((l) => /warn/i.test(l));
    return { total: lines.length, errors: errors.slice(0, 20), warnings: warnings.slice(0, 20), summary: `${errors.length} erreurs, ${warnings.length} avertissements sur ${lines.length} lignes` };
  }
}
