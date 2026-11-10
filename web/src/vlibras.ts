// VLibras (A-037): widget oficial do governo federal (versão 7). Só é carregado depois que a pessoa aceita o aviso.
// Ao carregar, o navegador fala com vlibras.gov.br; o texto clicado vai para traducao2.vlibras.gov.br.
export const ENDERECO_VLIBRAS = 'https://vlibras.gov.br/app';
const ID_SCRIPT = 'siesal-vlibras-script';
// Elementos que o widget cria no fim da página (conferido no navegador em 10/11/2026, versão 7.12.2)
const IDS_DO_WIDGET = ['vlibras-access-wrapper', 'vlibras-app-root'];

type JanelaComVLibras = Window & { VLibrasWidget?: { open?: () => void } };

let carregando: Promise<void> | null = null;

// Carrega o script uma vez só; ele monta o widget sozinho. Depois, mostra o widget (pode ter sido escondido).
export function carregarVLibras(doc: Document = document): Promise<void> {
  mostrarVLibras(true, doc);
  if (carregando) return carregando;
  carregando = new Promise<void>((resolver, rejeitar) => {
    const s = doc.createElement('script');
    s.id = ID_SCRIPT;
    s.src = `${ENDERECO_VLIBRAS}/vlibras-plugin.js`;
    s.async = true;
    s.onload = () => resolver();
    s.onerror = () => {
      carregando = null;
      s.remove();
      rejeitar(new Error('vlibras_indisponivel'));
    };
    doc.head.append(s);
  });
  return carregando;
}

// Abre o painel do VLibras. O widget termina de montar um pouco depois do script: tenta por até 5 segundos.
export function abrirVLibras(doc: Document = document, tentativas = 25): void {
  const w = doc.defaultView as JanelaComVLibras | null;
  if (w?.VLibrasWidget?.open) {
    w.VLibrasWidget.open();
    return;
  }
  if (tentativas > 0) w?.setTimeout(() => abrirVLibras(doc, tentativas - 1), 200);
}

// Desligar não descarrega o script (o navegador não permite): o widget só fica escondido
export function mostrarVLibras(mostrar: boolean, doc: Document = document): void {
  for (const id of IDS_DO_WIDGET) {
    const el = doc.getElementById(id);
    if (el) el.style.display = mostrar ? '' : 'none';
  }
}
