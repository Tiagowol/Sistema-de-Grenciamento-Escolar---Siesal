import { useId, useRef, useState } from 'react';
import { Vazio } from '../componentes/Basicos';
import { MANUAL_DATA, MANUAL_VERSAO, type Topico, topicosDoPerfil } from '../manual';
import { normalizar } from '../menu';

// Ajuda e manual por perfil: passos curtos, exemplos fictícios, busca sem acento, versão e data visíveis.
export function Ajuda({ perfil }: { perfil: string }) {
  const [busca, setBusca] = useState('');
  const idBusca = useId();
  const refs = useRef<Record<string, HTMLHeadingElement | null>>({});
  const todos = topicosDoPerfil(perfil);
  const t = normalizar(busca);
  const achados = t
    ? todos.filter((x) =>
        [x.titulo, x.resumo, ...x.palavras, ...x.passos].some((c) => normalizar(c).includes(t)),
      )
    : todos;

  const ir = (id: string) => {
    const alvo = refs.current[id];
    alvo?.scrollIntoView?.({ block: 'start' });
    alvo?.focus();
  };

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Ajuda</div>
          <h1>Ajuda e manual</h1>
          <p>
            Passos curtos para cada tarefa. Manual versão {MANUAL_VERSAO}, atualizado em{' '}
            {MANUAL_DATA}.
          </p>
        </div>
      </div>

      <div className="card ajuda-busca">
        <label htmlFor={idBusca}>
          <b>Buscar no manual</b>
        </label>
        <input
          id={idBusca}
          type="search"
          value={busca}
          autoComplete="off"
          placeholder="Ex.: senha, nota, prazo, fonte"
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setBusca('');
          }}
        />
        <p className="sr-only" role="status">
          {t
            ? achados.length === 0
              ? 'Nenhum tópico encontrado.'
              : `${achados.length} ${achados.length === 1 ? 'tópico' : 'tópicos'}.`
            : ''}
        </p>
      </div>

      {achados.length === 0 ? (
        <div className="card">
          <Vazio>
            Nenhum tópico para “{busca.trim()}”. Tente outra palavra, como senha, nota, prazo ou
            fonte.
          </Vazio>
        </div>
      ) : (
        <>
          <nav className="card ajuda-indice" aria-label="Tópicos do manual">
            <h2>Tópicos</h2>
            <ul>
              {achados.map((x) => (
                <li key={x.id}>
                  <button type="button" className="btn btn-ghost" onClick={() => ir(x.id)}>
                    {x.titulo}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {achados.map((x: Topico) => (
            <section key={x.id} className="card ajuda-topico" aria-labelledby={`t-${x.id}`}>
              <h2
                id={`t-${x.id}`}
                tabIndex={-1}
                ref={(el) => {
                  refs.current[x.id] = el;
                }}
              >
                {x.titulo}
              </h2>
              <p>{x.resumo}</p>
              <ol>
                {x.passos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {x.exemplo ? <p className="muted small">{x.exemplo}</p> : null}
            </section>
          ))}
        </>
      )}
    </>
  );
}
