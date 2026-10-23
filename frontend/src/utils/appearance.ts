/**
 * Personalização do SIESAL — temas de cor, animações e preferências.
 *
 * Como funciona o tema:
 *  - As classes Tailwind "cyan" e "sky" usam as variáveis CSS "--cNNN" e
 *    "--sNNN" (ver tailwind.config.js e index.css);
 *  - Cada tema (ACCENT_THEMES) define um matiz (hue) alvo;
 *  - applyAccentTheme() gera as 11 tonalidades de cada paleta preservando a
 *    saturação e luminosidade das paletas padrão e sobrescreve as variáveis
 *    no elemento html — a interface inteira recolor instantaneamente;
 *  - A escolha fica salva no localStorage e é reaplicada no boot (main.tsx).
 */

const ACCENT_KEY = '@siesal:accent';
const PREF_PREFIX = '@siesal:pref_';

export interface AccentTheme {
  id: string;
  nome: string;
  /** Matiz (HSL) alvo da paleta cyan; a paleta sky usa hue + 10. */
  hue: number;
  /** Cor de amostra exibida nos botões de escolha. */
  swatch: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'ciano', nome: 'Ciano', hue: 189, swatch: '#06b6d4' },
  { id: 'azul', nome: 'Azul', hue: 221, swatch: '#3b82f6' },
  { id: 'violeta', nome: 'Violeta', hue: 258, swatch: '#8b5cf6' },
  { id: 'esmeralda', nome: 'Esmeralda', hue: 160, swatch: '#10b981' },
  { id: 'ambar', nome: 'Âmbar', hue: 38, swatch: '#f59e0b' },
  { id: 'rosa', nome: 'Rosa', hue: 330, swatch: '#ec4899' },
];

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Paletas padrão do Tailwind (hex) — ciano ≈ hue 189 / sky ≈ hue 199
const DEFAULT_CYAN = [
  '#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee',
  '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#083344',
];
const DEFAULT_SKY = [
  '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
  '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#082f49',
];

/* ── Conversões de cor (hex ⇄ HSL ⇄ RGB) ── */

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h / 60) % 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hp >= 0 && hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

/** Re-gera a tonalidade com o matiz alvo, preservando saturação/luminosidade. */
function shiftHue(hex: string, targetHue: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb(targetHue, s, l);
  return `${r2} ${g2} ${b2}`;
}

/* ── Tema de cor ── */

export function getStoredAccent(): string {
  try {
    return localStorage.getItem(ACCENT_KEY) || 'ciano';
  } catch {
    return 'ciano';
  }
}

export function applyAccentTheme(id: string) {
  const theme = ACCENT_THEMES.find((t) => t.id === id);
  if (!theme) return;

  const root = document.documentElement;
  SHADES.forEach((shade, i) => {
    if (theme.id === 'ciano') {
      // Tema padrão: remove os overrides e deixa valer a paleta do CSS
      root.style.removeProperty(`--c${shade}`);
      root.style.removeProperty(`--s${shade}`);
    } else {
      root.style.setProperty(`--c${shade}`, shiftHue(DEFAULT_CYAN[i], theme.hue));
      root.style.setProperty(`--s${shade}`, shiftHue(DEFAULT_SKY[i], theme.hue + 10));
    }
  });

  try {
    localStorage.setItem(ACCENT_KEY, theme.id);
  } catch {
    /* localStorage indisponível — tema vale só nesta sessão */
  }
}

/* ── Animações reduzidas ── */

export function applyReducedMotion(enabled: boolean) {
  document.documentElement.classList.toggle('siesal-reduced-motion', enabled);
  setPref('reduzir_animacoes', enabled);
}

/* ── Preferências gerais persistidas ── */

export function getPref(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(`${PREF_PREFIX}${key}`);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
}

export function setPref(key: string, value: boolean) {
  try {
    localStorage.setItem(`${PREF_PREFIX}${key}`, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/**
 * Aplica o tema + preferências salvas ANTES do primeiro render
 * (chamado no main.tsx, evitando "flash" de cor padrão).
 */
export function loadAppearance() {
  try {
    applyAccentTheme(getStoredAccent());
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem(`${PREF_PREFIX}reduzir_animacoes`);
    const reduce =
      stored === null
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : stored === '1';
    document.documentElement.classList.toggle('siesal-reduced-motion', reduce);
  } catch {
    /* ignore */
  }
}

/* ── Som de notificação ── */

const BEEP_URL = '/sounds/notification-beep.ogg';

/** Instância reaproveitada do bipe baixado (Google Sound Library — CC BY 4.0). */
let beepAudio: HTMLAudioElement | null = null;

let audioCtx: AudioContext | null = null;

/**
 * "Aquece" o áudio no primeiro clique/tecla do usuário.
 *
 * Navegadores só permitem tocar som depois de uma interação com a página
 * (política de autoplay). Chamando isto logo no primeiro gesto, o bipe das
 * notificações funciona mesmo quando é disparado pelo polling em segundo plano.
 */
export function warmUpNotificationSound() {
  try {
    if (!beepAudio) {
      beepAudio = new Audio(BEEP_URL);
      beepAudio.volume = 0.5;
      beepAudio.load();
    }
    audioCtx =
      audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    /* som é opcional — nunca deve quebrar a aplicação */
  }
}

/** Bipe de reserva (sintetizado via Web Audio) caso o arquivo falhe. */
async function playSynthBeep() {
  const ctx =
    audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
  audioCtx = ctx;
  if (ctx.state === 'suspended') await ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(659, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

/** Toca o bipe de nova notificação (arquivo baixado; sintetiza se indisponível). */
export async function playNotificationSound() {
  try {
    if (!beepAudio) {
      beepAudio = new Audio(BEEP_URL);
      beepAudio.volume = 0.5;
    }

    try {
      beepAudio.currentTime = 0;
      await beepAudio.play();
      return; // arquivo tocou — pronto
    } catch {
      // play() bloqueado ou arquivo indisponível → bipe sintetizado
    }

    await playSynthBeep();
  } catch {
    /* som é opcional — nunca deve quebrar a aplicação */
  }
}
