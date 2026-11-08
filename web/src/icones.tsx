// Ícones do protótipo (mesmos traçados), desenhados em SVG simples e decorativos (aria-hidden)
const TRACADOS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 9 2 2 4-4M8 16h8"/>',
  focus:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
  chart: '<path d="M4 20V5M4 20h17M8 17v-5M13 17V8M18 17V4"/>',
  shield: '<path d="m12 2 9 4v6c0 5-3 8-9 10-6-2-9-5-9-10V6z"/><path d="m9 12 2 2 4-4"/>',
  access: '<circle cx="12" cy="4" r="2"/><path d="M4 9h16M12 9v5M12 14l-4 8M12 14l4 8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12 5 5 11-11"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  school: '<path d="M3 21h18M6 21V9l6-6 6 6v12M9 14h6M10 21v-5h4v5"/>',
  heart: '<path d="M20 8c0 5-8 11-8 11S4 13 4 8a4 4 0 0 1 8-1 4 4 0 0 1 8 1z"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M20 14v6H4V4h6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  book: '<path d="M12 7C9 5 5 5 2 6v14c3-1 7-1 10 1 3-2 7-2 10-1V6c-3-1-7-1-10 1zM12 7v14"/>',
  file: '<path d="M6 2h8l4 4v16H6zM14 2v5h4M9 12h6M9 16h6"/>',
} as const;

export type NomeIcone = keyof typeof TRACADOS;

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: traçados fixos do protótipo, sem dado do usuário
      dangerouslySetInnerHTML={{ __html: TRACADOS[nome] }}
    />
  );
}
