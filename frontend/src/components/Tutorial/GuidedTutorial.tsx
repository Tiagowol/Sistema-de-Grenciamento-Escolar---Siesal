import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles, MousePointerClick } from 'lucide-react';

/**
 * Tour guiado do SIESAL — ensina NA PRÁTICA cada função do sistema:
 * um "spotlight" (véu escuro com um buraco) destaca o recurso real da tela,
 * uma SETA aponta para ele e o cartão explica o que a função faz e como usar,
 * passo a passo. Navega automaticamente pelas abas conforme o passo.
 *
 * Os alvos são marcados nos componentes com atributos `data-tutorial="..."`.
 * O tour abre sozinho no primeiro login (controlado pelo App via localStorage)
 * e pode ser reaberto a qualquer momento pelo botão AJUDA da Sidebar.
 */

interface GuidedTutorialProps {
  isOpen: boolean;
  /** Marca como concluído e fecha o tour. */
  onClose: () => void;
  /** Navega para a aba necessária antes de destacar o recurso. */
  onNavigateTab: (tab: any) => void;
}

type Tab = 'inicio' | 'demandas' | 'agenda' | 'materias' | 'configuracoes';

interface TutorialStep {
  title: string;
  description: React.ReactNode;
  /** Aba que precisa estar aberta para o recurso existir na tela. */
  tab?: Tab;
  /** Seletor do elemento-alvo (atributo data-tutorial). Sem seletor = cartão central. */
  selector?: string;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Bem-vindo ao SIESAL! 🎓',
    description: (
      <>
        Vou te guiar <strong className="text-cyan-300">na prática</strong> pelas funções do
        sistema: uma <strong className="text-cyan-300">seta apontará para cada recurso</strong> na
        tela, com a explicação do que ele faz e como usar. É rapidinho — e você pode pular
        quando quiser.
      </>
    ),
  },
  {
    title: 'Gráfico de Prioridades',
    description: (
      <>
        O anel colorido resume <strong className="text-white">todas as suas demandas</strong>:
        laranja = <strong className="text-orange-400">Urgente</strong>, azul ={' '}
        <strong className="text-sky-400">Próximo</strong>, verde ={' '}
        <strong className="text-emerald-400">Longe</strong> e ciano ={' '}
        <strong className="text-cyan-300">Concluídas</strong>. O número no centro é o total.
        A proporção é recalculada <strong className="text-white">sozinha</strong> conforme os
        prazos se aproximam.
      </>
    ),
    tab: 'inicio',
    selector: '[data-tutorial="grafico-prazos"]',
  },
  {
    title: 'Avisos do Sistema',
    description: (
      <>
        Aqui ficam os alertas de atividades que <strong className="text-white">vencem hoje</strong>{' '}
        e as <strong className="text-white">prioritárias</strong>.{' '}
        <span className="text-cyan-300 font-semibold">Como usar:</span> clique sobre um aviso
        para marcá-lo como lido — os não lidos ficam destacados.
      </>
    ),
    tab: 'inicio',
    selector: '[data-tutorial="avisos-sistema"]',
  },
  {
    title: 'Botão "Nova Demanda"',
    description: (
      <>
        Tudo começa por este botão!{' '}
        <span className="text-cyan-300 font-semibold">Como usar:</span> 1) clique nele; 2) escreva
        o título; 3) escolha a matéria e o prazo; 4) marque a dificuldade. A prioridade
        (Urgente/Próximo/Longe) é calculada <strong className="text-white">automaticamente</strong>{' '}
        pelo prazo + dificuldade — e você ainda pode ativar um lembrete 24h antes.
      </>
    ),
    tab: 'inicio',
    selector: '[data-tutorial="btn-nova-demanda"]',
  },
  {
    title: 'Filtro por Matéria',
    description: (
      <>
        As bolinhas coloridas são seus <strong className="text-white">filtros rápidos</strong>:
        clique numa matéria para ver só as demandas dela (clique de novo para ver todas). Abaixo
        há filtros de <strong className="text-white">prioridade, dificuldade e tipo</strong>, e um
        campo de <strong className="text-white">busca</strong> por título, professor ou descrição.
      </>
    ),
    tab: 'demandas',
    selector: '[data-tutorial="filtros-materia"]',
  },
  {
    title: 'Lista de Demandas',
    description: (
      <>
        Suas tarefas agrupadas por matéria.{' '}
        <span className="text-cyan-300 font-semibold">Como usar:</span> clique no{' '}
        <strong className="text-white">CÍRCULO</strong> à esquerda de uma tarefa para marcá-la
        como concluída (ela fica riscada); clique no card para selecioná-la e ver tudo ao lado.
      </>
    ),
    tab: 'demandas',
    selector: '[data-tutorial="lista-demandas"]',
  },
  {
    title: 'Painel de Detalhes',
    description: (
      <>
        Tudo sobre a tarefa selecionada: professor, prazo com hora, matéria, dificuldade e
        descrição. Daqui você pode{' '}
        <strong className="text-white">EDITAR</strong> a demanda (botão do lápis — abre o formulário
        preenchido), <strong className="text-white">marcar como concluída</strong>, reabrir ou{' '}
        <strong className="text-white">excluir</strong> (lixeira).
      </>
    ),
    tab: 'demandas',
    selector: '[data-tutorial="painel-detalhes"]',
  },
  {
    title: 'Linha do Tempo do Dia',
    description: (
      <>
        A agenda do dia selecionado, <strong className="text-white">hora por hora</strong>{' '}
        (00:00–23:00): blocos <strong className="text-sky-400">azuis</strong> = eventos escolares
        (com o local); blocos <strong className="text-orange-400">laranjas</strong> = entregas de
        demandas.
      </>
    ),
    tab: 'agenda',
    selector: '[data-tutorial="linha-do-tempo"]',
  },
  {
    title: 'Calendário Mensal',
    description: (
      <>
        <span className="text-cyan-300 font-semibold">Como usar:</span> navegue pelos meses pelas
        setas e clique em qualquer dia para ver a linha do tempo dele ao lado. Os pontinhos
        indicam dias com <strong className="text-cyan-300">evento</strong> ou{' '}
        <strong className="text-orange-400">entrega</strong>. Abaixo, dois atalhos: adicionar{' '}
        <strong className="text-white">Evento</strong> ou{' '}
        <strong className="text-white">Demanda</strong>.
      </>
    ),
    tab: 'agenda',
    selector: '[data-tutorial="calendario"]',
  },
  {
    title: 'Matérias e Disciplinas',
    description: (
      <>
        Cada matéria tem uma <strong className="text-white">cor</strong> que se repete na agenda,
        nos filtros e nos gráficos.{' '}
        <span className="text-cyan-300 font-semibold">Como usar:</span> crie matérias pelo botão
        "Nova Matéria" (escolha a cor na paleta) e use{' '}
        <strong className="text-white">"Ver Demandas"</strong> para ir direto às tarefas daquela
        matéria — já filtradas!
      </>
    ),
    tab: 'materias',
    selector: '[data-tutorial="lista-materias"]',
  },
  {
    title: 'Sino de Notificações',
    description: (
      <>
        Sua <strong className="text-white">central de avisos</strong>: o número vermelho mostra
        quantas não lidas você tem. Dentro, marque como lidas (uma a uma ou todas de uma vez) e
        acompanhe recados do sistema e da administração escolar.
      </>
    ),
    selector: '[data-tutorial="btn-notificacoes"]',
  },
  {
    title: 'Perfil Escolar',
    description: (
      <>
        Atualize seu <strong className="text-white">nome, escola e turma</strong> quando mudar de
        ano letivo.{' '}
        <span className="text-cyan-300 font-semibold">Como usar:</span> edite os campos e clique
        em "Salvar Informações" — os dados vão direto para o MySQL.
      </>
    ),
    tab: 'configuracoes',
    selector: '[data-tutorial="perfil-escolar"]',
  },
  {
    title: 'Alterar Senha e Segurança',
    description: (
      <>
        Mantenha sua conta segura: informe a <strong className="text-white">senha atual</strong>,
        digite a nova (mínimo 6 caracteres) e confirme. Mais abaixo você também encontra o{' '}
        <strong className="text-white">backup em JSON</strong> e a{' '}
        <strong className="text-white">exclusão definitiva da conta</strong> (LGPD).
      </>
    ),
    tab: 'configuracoes',
    selector: '[data-tutorial="alterar-senha"]',
  },
  {
    title: 'Personalize o SIESAL',
    description: (
      <>
        Deixe o sistema com a sua cara: escolha entre{' '}
        <strong className="text-white">6 cores de destaque</strong> (aplicadas na hora),{' '}
        <strong className="text-white">reduza as animações</strong> e defina som de notificação e
        lembretes automáticos. As matérias também aceitam{' '}
        <strong className="text-white">qualquer cor personalizada</strong> no seletor. Se mudar de
        ideia, use <strong className="text-white">"Restaurar Padrões"</strong>.
      </>
    ),
    tab: 'configuracoes',
    selector: '[data-tutorial="aparencia"]',
  },
  {
    title: 'Tudo pronto! 🚀',
    description: (
      <>
        Você conheceu as principais funções do SIESAL. Para rever este tour a qualquer momento,
        use o botão <strong className="text-cyan-300">AJUDA</strong> na barra lateral. Bons
        estudos!
      </>
    ),
  },
];

const TOOLTIP_MAX_W = 360;
const ESTIMATED_H = 270;

interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

type Placement = 'top' | 'bottom' | 'left' | 'right';

export const GuidedTutorial: React.FC<GuidedTutorialProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [box, setBox] = useState<RectBox | null>(null);
  const [placement, setPlacement] = useState<Placement>('bottom');
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  // Referência estável de navegação (evita reexecutar o efeito a cada render do App)
  const navigateRef = useRef(onNavigateTab);
  useEffect(() => {
    navigateRef.current = onNavigateTab;
  }, [onNavigateTab]);

  const finish = useCallback(() => {
    navigateRef.current('inicio');
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    setStepIndex((i) => (i < STEPS.length - 1 ? i + 1 : i));
  }, []);

  const prev = useCallback(() => {
    setStepIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  // Reinicia o tour sempre que abre
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setBox(null);
      setTooltipPos(null);
    }
  }, [isOpen]);

  // Fecha com ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, finish, next, prev]);

  /** Mede o elemento-alvo e calcula onde ficam o buraco, a seta e o cartão. */
  const applyMeasure = useCallback((el: Element) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = Math.min(TOOLTIP_MAX_W, vw - 32);

    // Escolhe o lado do cartão com base no espaço disponível
    let p: Placement;
    if (r.left < 110 && r.width < 320) {
      p = 'right'; // elementos da Sidebar (borda esquerda)
    } else if (r.bottom + ESTIMATED_H + 28 < vh) {
      p = 'bottom';
    } else if (r.top - ESTIMATED_H - 28 > 0) {
      p = 'top';
    } else {
      p = r.left > vw / 2 ? 'left' : 'right';
    }

    let top: number;
    let left: number;
    if (p === 'bottom') {
      left = r.left + r.width / 2 - tw / 2;
      top = r.bottom + 18;
    } else if (p === 'top') {
      left = r.left + r.width / 2 - tw / 2;
      top = r.top - ESTIMATED_H - 18;
    } else if (p === 'right') {
      left = r.right + 18;
      top = r.top + r.height / 2 - ESTIMATED_H / 2;
    } else {
      left = r.left - tw - 18;
      top = r.top + r.height / 2 - ESTIMATED_H / 2;
    }

    left = Math.max(16, Math.min(left, vw - tw - 16));
    top = Math.max(12, Math.min(top, vh - 120));

    const newBox: RectBox = {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    };

    setBox((prevBox) => {
      const same =
        prevBox &&
        prevBox.top === newBox.top &&
        prevBox.left === newBox.left &&
        prevBox.width === newBox.width &&
        prevBox.height === newBox.height;
      return same ? prevBox : newBox;
    });
    setPlacement(p);
    setTooltipPos({ top, left });
  }, []);

  /**
   * CORREÇÃO DO BUG "TUTORIAL FORA DA TELA" (v2):
   * após renderizar, mede o cartão REAL (ref) e o reposiciona para dentro do
   * viewport — cobre cartões mais altos que a estimativa, telas pequenas e
   * elementos colados nas bordas. Executa em useLayoutEffect para corrigir
   * antes da pintura (sem "pulo" visível) e converge sem loop.
   */
  useLayoutEffect(() => {
    if (!isOpen || !step.selector || !tooltipPos) return;
    const el = tooltipRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const PAD = 12;

    let { top, left } = tooltipPos;
    let changed = false;

    if (left < PAD) { left = PAD; changed = true; }
    if (left + r.width > vw - PAD) { left = vw - r.width - PAD; changed = true; }
    if (top < PAD) { top = PAD; changed = true; }
    if (top + r.height > vh - PAD) { top = Math.max(PAD, vh - r.height - PAD); changed = true; }

    if (changed) setTooltipPos({ top, left });
  }, [isOpen, tooltipPos, step.selector]);

  // Navega para a aba do passo e mede o alvo (com retentativas e re-medida periódica)
  useEffect(() => {
    if (!isOpen) return;

    const s = STEPS[stepIndex];

    // Passo central (sem alvo)
    if (!s.selector) {
      setBox(null);
      setTooltipPos(null);
      return;
    }

    if (s.tab) navigateRef.current(s.tab);

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const tryMeasure = (attempt: number) => {
      if (cancelled) return;
      const el = document.querySelector(s.selector!);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        timers.push(
          setTimeout(() => {
            if (!cancelled) applyMeasure(el);
          }, 350)
        );
      } else if (attempt < 12) {
        // A aba ainda está renderizando — tenta de novo
        timers.push(setTimeout(() => tryMeasure(attempt + 1), 150));
      } else {
        // Alvo não encontrado: mostra o cartão centralizado
        setBox(null);
        setTooltipPos(null);
      }
    };
    tryMeasure(0);

    // Mantém o destaque sincronizado com rolagem/redimensionamento
    const interval = setInterval(() => {
      const el = document.querySelector(s.selector!);
      if (el) applyMeasure(el);
    }, 600);

    const onResize = () => {
      const el = document.querySelector(s.selector!);
      if (el) applyMeasure(el);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearInterval(interval);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, stepIndex, applyMeasure]);

  if (!isOpen) return null;

  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;
  const isCenterStep = !step.selector || !box || !tooltipPos;

  // Posição da seta (losango) apontando do cartão para o recurso
  let arrowX = 0;
  let arrowY = 0;
  if (box) {
    if (placement === 'bottom') {
      arrowX = box.left + box.width / 2;
      arrowY = box.bottom + 11;
    } else if (placement === 'top') {
      arrowX = box.left + box.width / 2;
      arrowY = box.top - 11;
    } else if (placement === 'right') {
      arrowX = box.right + 11;
      arrowY = box.top + box.height / 2;
    } else {
      arrowX = box.left - 11;
      arrowY = box.top + box.height / 2;
    }
  }

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Camada 1: bloqueia interação com a página enquanto o passo é explicado */}
      <div className="absolute inset-0 animate-fade-in" style={{ background: isCenterStep ? 'rgba(2,6,23,0.82)' : 'transparent' }} />

      {/* Camada 2: véu escuro com o "buraco" no recurso destacado (via box-shadow) */}
      {!isCenterStep && box && (
        <div
          className="fixed rounded-2xl transition-all duration-300 ease-out"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
            boxShadow:
              '0 0 0 3px rgb(var(--c400) / 0.45), 0 0 18px rgb(var(--c400) / 0.25), 0 0 0 99999px rgba(2,6,23,0.82)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Seta apontando para o recurso */}
      {!isCenterStep && box && (
        <div
          className="fixed w-3.5 h-3.5 z-[81] bg-[#0d1b3f]"
          style={{
            left: arrowX,
            top: arrowY,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            borderLeft: '2px solid rgb(var(--c400) / 0.6)',
            borderTop: '2px solid rgb(var(--c400) / 0.6)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Ícone de clique flutuando no canto do destaque */}
      {!isCenterStep && box && (
        <div
          className="fixed z-[81] animate-float-slow"
          style={{ left: box.right - 26, top: box.bottom - 26, pointerEvents: 'none' }}
        >
          <div className="p-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-lg shadow-cyan-500/30">
            <MousePointerClick className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Cartão de explicação */}
      <div
        ref={tooltipRef}
        className={`fixed z-[82] siesal-card rounded-2xl border border-cyan-500/50 p-5 shadow-2xl animate-fade-in ${
          isCenterStep
            ? 'max-w-md'
            : 'w-[min(360px,calc(100vw-32px))]'
        }`}
        style={
          isCenterStep
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : { top: tooltipPos!.top, left: tooltipPos!.left }
        }
      >
        {/* Cabeçalho: passo atual + fechar */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
            Passo {stepIndex + 1} de {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            title="Encerrar tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="h-1 rounded-full bg-white/[0.07] mb-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Título e explicação */}
        {isFirst && (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
        )}
        <h3 className="text-sm font-bold text-white leading-snug">{step.title}</h3>
        <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">{step.description}</p>

        {/* Rodapé de navegação */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={prev}
              disabled={isFirst}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            {!isLast && (
              <button
                onClick={finish}
                className="text-[10px] font-semibold text-slate-500 hover:text-rose-300 transition-colors"
              >
                Pular tour
              </button>
            )}
          </div>

          <button
            onClick={() => (isLast ? finish() : next())}
            className="siesal-button-primary text-white font-bold px-4 py-2 rounded-xl text-[11px] shadow-md flex items-center gap-1.5"
          >
            <span>{isLast ? 'Concluir tour' : 'Próximo'}</span>
            {isLast ? <Sparkles className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
