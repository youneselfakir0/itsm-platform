import { Injectable } from '@nestjs/common';

const AI_BASE = (process.env.AI_API_URL || 'http://192.168.0.20:11434').replace(/\/v1\/chat\/completions$/, '');
const AI_MODEL = process.env.AI_MODEL || 'qwen3:8b';
const AI_CODER_MODEL = process.env.AI_CODER_MODEL || 'qwen2.5-coder:latest';
const USE_OPENAI = !!process.env.AI_API_URL && process.env.AI_API_URL.includes('/v1/chat/completions');

const RULES: { re: RegExp; category: string; priority: string; team: string }[] = [
  { re: /vpn|réseau|network|dns|firewall|flux/i, category: 'network', priority: 'p2', team: 'infra' },
  { re: /mot de passe|password|compte|account|verrou|lock|ad |active directory/i, category: 'account', priority: 'p3', team: 'support' },
  { re: /serveur|server|cpu|ram|disk|vm|hyper|vmware/i, category: 'infrastructure', priority: 'p1', team: 'infra' },
  { re: /mail|outlook|exchange|smtp|messagerie/i, category: 'messaging', priority: 'p2', team: 'support' },
];

async function llm(prompt: string, model = AI_MODEL, temperature = 0.2): Promise<string | null> {
  try {
    if (USE_OPENAI) {
      const r = await fetch(process.env.AI_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.AI_API_KEY ? { Authorization: `Bearer ${process.env.AI_API_KEY}` } : {}) },
        body: JSON.stringify({ model: AI_MODEL, messages: [{ role: 'user', content: prompt }], stream: false }),
      });
      const j: any = await r.json();
      return j.choices?.[0]?.message?.content ?? null;
    }
    const r = await fetch(`${AI_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, think: false,
        options: { temperature },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j: any = await r.json();
    return j.message?.content ?? j.response ?? null;
  } catch { return null; }
}

/** Extrait le 1er objet JSON valide d'un texte bavard. */
function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json|```/g, '');
  const m = cleaned.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/** Nettoie une liste d'étapes bavardes en lignes concises. */
function cleanSteps(text: string): string[] {
  return text.split(/\n+/)
    .map((s) => s.replace(/^[\s\d.)*-]+/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length > 3 && !/^(voici|here|les étapes|steps)/i.test(l))
    .slice(0, 5);
}

@Injectable()
export class AiService {
  engineInfo() {
    return { provider: USE_OPENAI ? 'openai-compatible' : 'ollama', base: AI_BASE, model: AI_MODEL, reachable: true };
  }

  async classify(dto: { title: string; description?: string }) {
    const text = `${dto.title} ${dto.description ?? ''}`;
    const hit = RULES.find((r) => r.re.test(text));
    const heuristic = hit
      ? { category: hit.category, priority: hit.priority, team: hit.team, confidence: 0.6, source: 'heuristic' }
      : { category: 'general', priority: 'p3', team: 'support', confidence: 0.4, source: 'heuristic' };
    const out = await llm(`Tu es un classifieur de tickets ITSM. Réponds UNIQUEMENT en JSON valide {category,priority,team}. Priorité parmi p1/p2/p3/p4. Ticket: ${text}`);
    if (out) {
      const parsed = extractJson(out);
      if (parsed && parsed.category) return { ...heuristic, ...parsed, source: 'llm' };
    }
    return heuristic;
  }

  async suggest(dto: { title: string; category?: string; description?: string }) {
    const out = await llm(`Donne 3 à 5 étapes de résolution concrètes et numérotées pour ce ticket ITSM. Une étape par ligne, sans explication. Ticket: ${dto.title} ${dto.description ?? ''}`);
    if (out) {
      const steps = cleanSteps(out);
      if (steps.length) return { steps, source: 'llm' };
    }
    const base: Record<string, string[]> = {
      network: ['Vérifier la connectivité (ping/traceroute)', 'Contrôler la config VPN/DNS', 'Redémarrer l’interface réseau', 'Escalader à l’équipe infra si persistant'],
      account: ['Vérifier le statut du compte AD', 'Déverrouiller / réinitialiser le mot de passe', 'Contrôler l’appartenance aux groupes', 'Demander à l’utilisateur de retester'],
      messaging: ['Vérifier le profil de messagerie', 'Recréer le profil Outlook/OST', 'Contrôler la connectivité au serveur mail', 'Escalader si problème serveur'],
    };
    return { steps: base[dto.category ?? ''] ?? ['Reproduire le problème', 'Consulter la base de connaissances', 'Appliquer le correctif', 'Documenter la résolution'], source: 'heuristic' };
  }

  async script(dto: { request: string }) {
    const lang = /powershell|ad|windows|compte/i.test(dto.request) ? 'PowerShell' : 'Bash';
    const out = await llm(`Génère un script ${lang} sécurisé pour: ${dto.request}. Réponds UNIQUEMENT avec le code, sans explication ni markdown.`, AI_CODER_MODEL, 0.1);
    if (out) {
      const code = out.replace(/```(?:powershell|bash|ps1|sh)?\n?/gi, '').replace(/```/g, '').trim();
      return { script: code, source: 'llm' };
    }
    return { script: `# LLM indisponible\n# Tâche: ${dto.request}\nWrite-Host "TODO: implémenter ${dto.request}"`, source: 'heuristic' };
  }

  async analyzeLogs(dto: { logs: string }) {
    const lines = dto.logs.split(/\n/);
    const errors = lines.filter((l) => /error|fail|exception|critical|fatal/i.test(l));
    const warnings = lines.filter((l) => /warn/i.test(l));
    return { total: lines.length, errors: errors.slice(0, 20), warnings: warnings.slice(0, 20), summary: `${errors.length} erreurs, ${warnings.length} avertissements sur ${lines.length} lignes` };
  }
}
