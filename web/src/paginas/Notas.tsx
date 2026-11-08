import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto } from '../datas';

const nota = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Notas que o aluno anota para acompanhar a si mesmo. Não substituem o boletim. Sem ranking e sem comparação.
export function Notas() {
  const { dados, erro, recarregar } = useCarregar(api.notas);
  const [disciplina, setDisciplina] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState(paraTexto(new Date()));
  const [msg, setMsg] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    const n = Number(valor.replace(',', '.'));
    if (!disciplina.trim() || valor === '' || Number.isNaN(n) || n < 0 || n > 10) {
      return setMsg('Informe a disciplina e uma nota de 0 a 10.');
    }
    try {
      await api.criarNota({
        disciplina: disciplina.trim(),
        descricao: descricao.trim(),
        valor: n,
        dia,
      });
      setDisciplina('');
      setDescricao('');
      setValor('');
      await recarregar();
    } catch (x) {
      setMsg(x instanceof ErroApi ? x.message : 'Não foi possível salvar.');
    }
  }

  return (
    <>
      <Titulo
        olho="Seu acompanhamento"
        titulo="Minhas notas"
        sub="Anote suas notas para ver como está indo em cada disciplina."
      />
      <Aviso>
        Estas notas são anotadas por você. Elas não substituem o boletim oficial da escola.
      </Aviso>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="layout mt">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2>Média por disciplina</h2>
            </div>
            {dados?.medias.length ? (
              dados.medias.map((m) => (
                <div className="stat-item" key={m.disciplina}>
                  <div className="flex-between">
                    <strong>{m.disciplina}</strong>
                    <span>
                      Média {nota(m.media)}{' '}
                      <span className="muted small">
                        ({m.quantidade} {m.quantidade === 1 ? 'nota' : 'notas'})
                      </span>
                    </span>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={`Média de ${m.disciplina}`}
                    aria-valuenow={m.media}
                    aria-valuemin={0}
                    aria-valuemax={10}
                  >
                    <span style={{ width: `${m.media * 10}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <Vazio>Nenhuma nota anotada ainda.</Vazio>
            )}
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Notas anotadas</h2>
            </div>
            {dados?.notas.length ? (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Notas anotadas por você</caption>
                  <thead>
                    <tr>
                      <th scope="col">Data</th>
                      <th scope="col">Disciplina</th>
                      <th scope="col">Descrição</th>
                      <th scope="col">Nota</th>
                      <th scope="col">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.notas.map((n) => (
                      <tr key={n.id}>
                        <td>{formatar(n.dia)}</td>
                        <td>{n.disciplina}</td>
                        <td>{n.descricao || '—'}</td>
                        <td>{nota(n.valor)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              await api.removerNota(n.id);
                              await recarregar();
                            }}
                          >
                            Remover
                            <span className="sr-only">
                              {' '}
                              nota de {n.disciplina} em {formatar(n.dia)}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio>Quando você anotar uma nota, ela aparece aqui.</Vazio>
            )}
          </div>
        </div>
        <form className="card" onSubmit={salvar} noValidate aria-labelledby="nova-nota">
          <h2 id="nova-nota">Anotar uma nota</h2>
          {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
          <div className="stack mt-sm">
            <Campo rotulo="Disciplina">
              {({ id }) => (
                <input
                  id={id}
                  value={disciplina}
                  maxLength={80}
                  onChange={(e) => setDisciplina(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Descrição (opcional)" dica="Exemplo: Prova 2">
              {({ id, descricao: d }) => (
                <input
                  id={id}
                  aria-describedby={d}
                  value={descricao}
                  maxLength={200}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Nota (0 a 10)">
              {({ id }) => (
                <input
                  id={id}
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Data">
              {({ id }) => (
                <input id={id} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
              )}
            </Campo>
            <button type="submit" className="btn btn-primary">
              Salvar nota
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
