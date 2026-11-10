import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import type { Eu } from '../api';
import { Icone, type NomeIcone } from '../icones';
import { buscarNoMenu } from '../menu';
import { SinoMensagens, SinoPrazos } from './Sinos';

export type Pagina =
  | 'inicio'
  | 'usuarios'
  | 'turmas'
  | 'notasprof'
  | 'notasoficiais'
  | 'avisosescola'
  | 'acessibilidade'
  | 'ajuda'
  | 'meudia'
  | 'atividades'
  | 'agenda'
  | 'calendario'
  | 'personalizar'
  | 'conta'
  | 'foco'
  | 'notas'
  | 'avisos';

const ROTULO_PERFIL: Record<string, string> = {
  admin: 'Administração',
  professor: 'Professor',
  aluno: 'Aluno',
  pedagogico: 'Pedagógico e apoio',
  responsavel: 'Responsável',
};

type Item = { id: Pagina; rotulo: string; icone: NomeIcone; so?: string[]; palavras?: string[] };
const ALUNO = ['aluno'];
const ITENS: Item[] = [
  {
    id: 'meudia',
    rotulo: 'Meu dia',
    icone: 'home',
    so: ALUNO,
    palavras: ['hoje', 'dia', 'resumo', 'inicio'],
  },
  {
    id: 'atividades',
    rotulo: 'Atividades',
    icone: 'tasks',
    so: ALUNO,
    palavras: ['tarefa', 'tarefas', 'licao', 'dever', 'trabalho', 'prazo', 'plano', 'etapas'],
  },
  {
    id: 'agenda',
    rotulo: 'Agenda',
    icone: 'calendar',
    so: ALUNO,
    palavras: ['calendario', 'compromisso', 'horario', 'semana'],
  },
  {
    id: 'calendario',
    rotulo: 'Calendário',
    icone: 'calendar',
    so: ALUNO,
    palavras: ['mes', 'ano', 'semana', 'dia', 'prova', 'lembrete', 'data', 'compromisso'],
  },
  {
    id: 'personalizar',
    rotulo: 'Personalizar',
    icone: 'spark',
    so: ALUNO,
    palavras: ['cor', 'tema', 'apelido', 'letra', 'tipos', 'aparencia', 'tela inicial'],
  },
  {
    id: 'foco',
    rotulo: 'Modo foco',
    icone: 'focus',
    so: ALUNO,
    palavras: ['concentrar', 'concentracao', 'estudar', 'estudo', 'sessao', 'cronometro'],
  },
  {
    id: 'notas',
    rotulo: 'Notas',
    icone: 'chart',
    so: ALUNO,
    palavras: ['minhas notas', 'desempenho', 'media'],
  },
  {
    id: 'notasoficiais',
    rotulo: 'Notas oficiais',
    icone: 'book',
    so: ['aluno'],
    palavras: ['boletim', 'prova', 'revisao', 'pedir revisao', 'resultado'],
  },
  {
    id: 'avisos',
    rotulo: 'Avisos',
    icone: 'bell',
    so: ALUNO,
    palavras: ['lembrete', 'notificacao', 'mensagem'],
  },
  {
    id: 'inicio',
    rotulo: 'Início',
    icone: 'home',
    so: ['admin', 'professor', 'pedagogico', 'responsavel'],
    palavras: ['home', 'principal', 'comeco'],
  },
  {
    id: 'notasprof',
    rotulo: 'Notas da turma',
    icone: 'book',
    so: ['professor'],
    palavras: ['lancar nota', 'revisar', 'turma', 'pedidos de revisao'],
  },
  {
    id: 'notasoficiais',
    rotulo: 'Notas oficiais',
    icone: 'book',
    so: ['admin', 'pedagogico', 'responsavel'],
    palavras: ['boletim', 'prova', 'revisao', 'resultado'],
  },
  {
    id: 'avisosescola',
    rotulo: 'Avisos da escola',
    icone: 'file',
    so: ['admin', 'pedagogico'],
    palavras: ['comunicado', 'mensagem', 'publicar', 'aviso curto'],
  },
  {
    id: 'usuarios',
    rotulo: 'Usuários',
    icone: 'users',
    so: ['admin'],
    palavras: ['contas', 'senha', 'cadastro', 'pessoas'],
  },
  {
    id: 'turmas',
    rotulo: 'Turmas e vínculos',
    icone: 'school',
    so: ['admin'],
    palavras: ['vinculo', 'disciplina', 'classe', 'professor da turma'],
  },
  {
    id: 'acessibilidade',
    rotulo: 'Acessibilidade',
    icone: 'access',
    palavras: ['configuracao', 'configuracoes', 'ajustes', 'preferencias', 'opcoes'],
  },
  {
    id: 'conta',
    rotulo: 'Minha conta',
    icone: 'lock',
    palavras: ['senha', 'email', 'e-mail', 'encerrar', 'suporte', 'conta', 'perfil'],
  },
  {
    id: 'ajuda',
    rotulo: 'Ajuda',
    icone: 'help',
    palavras: ['manual', 'como usar', 'duvida', 'suporte', 'tutorial', 'passo a passo'],
  },
];

const CHAVE_MENU = 'siesal-menu-recolhido-v1';

type Props = {
  eu: Eu;
  pagina: Pagina;
  aoIr: (p: Pagina) => void;
  aoSair: () => void;
  naoLidas?: number;
  children: ReactNode;
};

// Estrutura do protótipo: menu lateral, barra superior e conteúdo
export function Shell({ eu, pagina, aoIr, aoSair, naoLidas = 0, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const idBusca = useId();
  // Menu recolhido (só computador): lembrado neste aparelho; o celular usa o botão Menu de sempre
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MENU) === 'sim';
    } catch {
      return false;
    }
  });
  const alternarMenu = () => {
    const novo = !recolhido;
    setRecolhido(novo);
    try {
      localStorage.setItem(CHAVE_MENU, novo ? 'sim' : 'nao');
    } catch {
      // Armazenamento bloqueado: vale só nesta visita
    }
  };
  const itens = ITENS.filter((i) => !i.so || i.so.includes(eu.usuario.perfil));
  const atual = itens.find((i) => i.id === pagina);
  const achados = buscarNoMenu(itens, busca, 'acessibilidade');
  const iniciais = eu.usuario.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <div className={`app${recolhido ? ' menu-recolhido' : ''}`}>
        <aside
          id="menu-principal"
          className={`sidebar${aberto ? ' show' : ''}`}
          aria-label="Menu principal"
        >
          <div className="brand">
            <div className="brandmark" aria-hidden="true">
              S
            </div>
            <div>
              <strong>SIESAL</strong>
              <small>Educação e inclusão</small>
            </div>
          </div>
          <div className="nav-section">Navegação</div>
          <div className="busca-menu">
            <label htmlFor={idBusca}>Buscar no menu</label>
            <input
              id={idBusca}
              type="search"
              value={busca}
              autoComplete="off"
              placeholder="Ex.: notas, fonte, prazo"
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setBusca('');
              }}
            />
            <p className="sr-only" role="status">
              {busca.trim()
                ? achados.length === 0
                  ? 'Nenhum resultado.'
                  : `${achados.length} ${achados.length === 1 ? 'resultado' : 'resultados'}.`
                : ''}
            </p>
          </div>
          {busca.trim() && achados.length === 0 ? (
            <p className="busca-vazia">
              Nada encontrado para “{busca.trim()}”. Tente outra palavra, como notas, prazo ou
              fonte.
            </p>
          ) : null}
          <nav className="nav" aria-label="Telas do sistema">
            {achados.map((a) => {
              const i = itens.find((x) => x.id === a.id);
              if (!i) return null;
              const atualAqui = !a.dentroDe && i.id === pagina;
              return (
                <button
                  key={`${a.id}-${a.rotulo}`}
                  type="button"
                  className={atualAqui ? 'active' : ''}
                  aria-current={atualAqui ? 'page' : undefined}
                  onClick={() => {
                    aoIr(i.id);
                    setAberto(false);
                    setBusca('');
                  }}
                >
                  <span className="inlineicon">
                    <Icone nome={i.icone} />
                  </span>
                  <span>
                    {a.rotulo}
                    {a.dentroDe ? <small className="busca-dentro"> · em {a.dentroDe}</small> : null}
                  </span>
                  {i.id === 'avisos' && !a.dentroDe && naoLidas > 0 ? (
                    <span className="counter">
                      {naoLidas}
                      <span className="sr-only"> não lidos</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="tip">
              <b>Uma coisa de cada vez</b>
              <span>Cada tela mostra só o que importa agora.</span>
            </div>
          </div>
        </aside>
        <div
          className={`mobile-veil${aberto ? ' show' : ''}`}
          aria-hidden="true"
          onClick={() => setAberto(false)}
        />
        <div className="main">
          <header className="topbar">
            <button
              type="button"
              className="top-button recolher-menu"
              aria-expanded={!recolhido}
              aria-controls="menu-principal"
              onClick={alternarMenu}
            >
              {recolhido ? 'Mostrar menu' : 'Recolher menu'}
            </button>
            <button type="button" className="top-button ajuda-topo" onClick={() => aoIr('ajuda')}>
              Ajuda
            </button>
            <button
              type="button"
              className="top-button mob-menu"
              aria-expanded={aberto}
              onClick={() => setAberto(!aberto)}
            >
              Menu
            </button>
            <div className="breadcrumb">
              SIESAL / <b>{atual?.rotulo ?? ''}</b>
            </div>
            <div className="top-actions">
              {eu.nivel === 'completo' ? (
                <div className="sinos">
                  <SinoMensagens aoIr={aoIr} />
                  {eu.usuario.perfil === 'aluno' ? <SinoPrazos aoIr={aoIr} /> : null}
                </div>
              ) : null}
              <div className="rolebox">
                <span className="avatar" aria-hidden="true">
                  {iniciais}
                </span>
                <span>
                  <b>{eu.usuario.nome}</b>
                  <br />
                  <small className="muted">
                    {ROTULO_PERFIL[eu.usuario.perfil] ?? eu.usuario.perfil}
                  </small>
                </span>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={aoSair}>
                Sair
              </button>
            </div>
          </header>
          <main className="content" id="conteudo" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
