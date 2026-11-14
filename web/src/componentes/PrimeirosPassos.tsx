import { useState } from 'react';
import { type Topico, topicosDoPerfil } from '../manual';
import type { Pagina } from './Shell';

// L22c: "Primeiros passos" no primeiro acesso de cada perfil. Usa os tópicos do manual daquele perfil (o mesmo texto da Ajuda).
// "Já vi" fica neste aparelho (sem banco); a pessoa reabre pela Ajuda. Texto literal, sem pressão.
const CHAVE = (perfil: string) => `siesal-primeiros-passos-v1-${perfil}`;
const MAXIMO = 5;

export function topicosDosPrimeirosPassos(perfil: string): Topico[] {
  const todos = topicosDoPerfil(perfil);
  const proprios = todos.filter((t) => t.perfis.includes(perfil)).slice(0, 3);
  const comuns = ['entrar', 'acessibilidade', 'menu-busca']
    .map((id) => todos.find((t) => t.id === id))
    .filter((t): t is Topico => Boolean(t));
  return [...proprios, ...comuns].slice(0, MAXIMO);
}

function jaViu(perfil: string): boolean {
  try {
    return localStorage.getItem(CHAVE(perfil)) === 'sim';
  } catch {
    return false;
  }
}

export function PrimeirosPassos({ perfil, aoIr }: { perfil: string; aoIr: (p: Pagina) => void }) {
  const [visto, setVisto] = useState(() => jaViu(perfil));
  const topicos = topicosDosPrimeirosPassos(perfil);
  if (visto || topicos.length === 0) return null;
  const entendi = () => {
    setVisto(true);
    try {
      localStorage.setItem(CHAVE(perfil), 'sim');
    } catch {
      // Armazenamento bloqueado: vale só nesta visita
    }
  };
  return (
    <section className="card primeiros-passos" aria-labelledby="pp-titulo">
      <div className="card-head">
        <h2 id="pp-titulo">Primeiros passos</h2>
      </div>
      <p className="muted small">
        Um resumo do que você pode fazer. Você pode ver tudo de novo na Ajuda.
      </p>
      <ul className="pp-lista">
        {topicos.map((t) => (
          <li key={t.id}>
            <strong>{t.titulo}</strong>
            <p>{t.resumo}</p>
          </li>
        ))}
      </ul>
      <div className="cal-acoes">
        <button type="button" className="btn btn-outline" onClick={() => aoIr('ajuda')}>
          Ver o passo a passo na Ajuda
        </button>
        <button type="button" className="btn btn-primary" onClick={entendi}>
          Entendi
        </button>
      </div>
    </section>
  );
}
