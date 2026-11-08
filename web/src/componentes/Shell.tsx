import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Eu } from '../api';
import { Icone, type NomeIcone } from '../icones';

export type Pagina = 'inicio' | 'usuarios' | 'acessibilidade';

const ROTULO_PERFIL: Record<string, string> = {
  admin: 'Administração',
  professor: 'Professor',
  aluno: 'Aluno',
  pedagogico: 'Pedagógico e apoio',
  responsavel: 'Responsável',
};

type Item = { id: Pagina; rotulo: string; icone: NomeIcone; so?: string[] };
const ITENS: Item[] = [
  { id: 'inicio', rotulo: 'Início', icone: 'home' },
  { id: 'usuarios', rotulo: 'Usuários', icone: 'users', so: ['admin'] },
  { id: 'acessibilidade', rotulo: 'Acessibilidade', icone: 'access' },
];

type Props = {
  eu: Eu;
  pagina: Pagina;
  aoIr: (p: Pagina) => void;
  aoSair: () => void;
  children: ReactNode;
};

// Estrutura do protótipo: menu lateral, barra superior e conteúdo
export function Shell({ eu, pagina, aoIr, aoSair, children }: Props) {
  const [aberto, setAberto] = useState(false);
  const itens = ITENS.filter((i) => !i.so || i.so.includes(eu.usuario.perfil));
  const atual = itens.find((i) => i.id === pagina);
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
      <div className="app">
        <aside className={`sidebar${aberto ? ' show' : ''}`} aria-label="Menu principal">
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
          <nav className="nav">
            {itens.map((i) => (
              <button
                key={i.id}
                type="button"
                className={i.id === pagina ? 'active' : ''}
                aria-current={i.id === pagina ? 'page' : undefined}
                onClick={() => {
                  aoIr(i.id);
                  setAberto(false);
                }}
              >
                <span className="inlineicon">
                  <Icone nome={i.icone} />
                </span>
                {i.rotulo}
              </button>
            ))}
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
