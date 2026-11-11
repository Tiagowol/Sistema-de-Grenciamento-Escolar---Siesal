import type { FormEvent } from 'react';
import { useState } from 'react';
import { type Arredondamento, api, ErroApi, type PeriodoRegra, type RegraNota } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto } from '../datas';

// Regras de notas (L19): períodos, pesos e arredondamento. Cada gravação é uma versão nova, com data de vigência;
// nada se apaga. O lançamento de nota cita a versão que valia no dia da nota.
export const ARREDONDAMENTOS: { valor: Arredondamento; rotulo: string; exemplo: string }[] = [
  { valor: 'nenhum', rotulo: 'Não arredondar', exemplo: '7,46 fica 7,46' },
  { valor: 'decimo', rotulo: 'Uma casa depois da vírgula', exemplo: '7,46 fica 7,5' },
  { valor: 'meio', rotulo: 'Meio ponto', exemplo: '7,2 fica 7,0 e 7,3 fica 7,5' },
];
const PESOS = Array.from({ length: 10 }, (_, i) => i + 1);
const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);
// Cada período do formulário tem uma chave estável só para a tela (não vai para a API)
type PeriodoNaTela = PeriodoRegra & { chave: number };
let proximaChave = 0;
const comChave = (p: PeriodoRegra): PeriodoNaTela => ({ ...p, chave: proximaChave++ });
const novoPeriodo = (n: number): PeriodoNaTela =>
  comChave({ nome: `${n}º período`, inicio: '', fim: '', peso: 1 });

// Resumo de uma versão da regra em texto literal
export function ResumoRegra({ regra }: { regra: RegraNota }) {
  const arr = ARREDONDAMENTOS.find((a) => a.valor === regra.arredondamento);
  return (
    <div className="resumo-regra">
      <p className="small">
        Versão {regra.numero}, vale desde {formatar(regra.vigente_desde)}. Arredondamento:{' '}
        {arr?.rotulo.toLowerCase()} ({arr?.exemplo}).
      </p>
      <ul className="lista-periodos">
        {regra.periodos.map((p) => (
          <li key={p.nome}>
            <strong>{p.nome}</strong>: de {formatar(p.inicio)} a {formatar(p.fim)} · peso {p.peso}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegrasNotas() {
  const hoje = paraTexto(new Date());
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.regrasNotas());
  const [vigencia, setVigencia] = useState(hoje);
  const [arredondamento, setArredondamento] = useState<Arredondamento>('decimo');
  const [periodos, setPeriodos] = useState<PeriodoNaTela[]>(() => [novoPeriodo(1)]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  const mudar = (i: number, p: Partial<PeriodoRegra>) =>
    setPeriodos(periodos.map((x, j) => (j === i ? { ...x, ...p } : x)));

  // Começa a nova versão a partir da regra que vale hoje
  function copiarVigente() {
    if (!dados?.vigente) return;
    setArredondamento(dados.vigente.arredondamento);
    setPeriodos(dados.vigente.periodos.map(comChave));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk('');
    if (periodos.some((p) => !p.nome.trim() || !p.inicio || !p.fim))
      return setMsg('Preencha o nome, o primeiro dia e o último dia de cada período.');
    if (
      periodos.some(
        (p, i) => p.fim < p.inicio || (i > 0 && p.inicio <= (periodos[i - 1] as PeriodoNaTela).fim),
      )
    )
      return setMsg('Os períodos precisam estar em ordem, sem um dia em dois períodos.');
    try {
      const r = await api.criarRegraNota({
        vigente_desde: vigencia,
        arredondamento,
        periodos: periodos.map(({ chave: _, ...p }) => ({ ...p, nome: p.nome.trim() })),
      });
      setOk(`Versão ${r.numero} gravada. As versões anteriores continuam guardadas.`);
      await recarregar();
    } catch (x) {
      setMsg(mensagem(x, 'Não foi possível gravar. Confira os períodos e tente de novo.'));
    }
  }

  return (
    <div className="pag-regras-notas">
      <Titulo
        olho="Administração"
        titulo="Regras de notas"
        sub="Períodos, pesos e arredondamento da escola. Cada mudança vira uma versão nova; nada é apagado."
      />
      {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}

      <div className="grid cols-2">
        <section className="card" aria-labelledby="regra-vigente">
          <div className="card-head">
            <h2 id="regra-vigente">Regra que vale hoje</h2>
          </div>
          {carregando ? (
            <Carregando />
          ) : dados?.vigente ? (
            <ResumoRegra regra={dados.vigente} />
          ) : (
            <Vazio>A escola ainda não tem regra de notas.</Vazio>
          )}
          <h3 className="mt-sm">Versões guardadas</h3>
          {dados?.versoes.length ? (
            <ol className="lista-versoes">
              {dados.versoes.map((v) => (
                <li key={v.numero}>
                  Versão {v.numero}: vale desde {formatar(v.vigente_desde)} · gravada em{' '}
                  {formatar(v.criada_em)} por {v.autor_nome}
                </li>
              ))}
            </ol>
          ) : (
            <Vazio>Nenhuma versão ainda.</Vazio>
          )}
        </section>

        <form className="card" onSubmit={salvar} noValidate aria-labelledby="regra-nova">
          <div className="card-head">
            <h2 id="regra-nova">Nova versão</h2>
            {dados?.vigente ? (
              <button type="button" className="btn btn-outline" onClick={copiarVigente}>
                Começar pela regra de hoje
              </button>
            ) : null}
          </div>
          <div className="form-grid">
            <Campo
              rotulo="Vale a partir de"
              dica="Notas deste dia em diante citam esta versão"
              cheio
            >
              {({ id, descricao }) => (
                <input
                  id={id}
                  type="date"
                  aria-describedby={descricao}
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                />
              )}
            </Campo>
          </div>
          <fieldset className="mt-sm">
            <legend>Arredondamento da média</legend>
            {ARREDONDAMENTOS.map((a) => (
              <label key={a.valor} className="opcao-radio">
                <input
                  type="radio"
                  name="arredondamento"
                  value={a.valor}
                  checked={arredondamento === a.valor}
                  onChange={() => setArredondamento(a.valor)}
                />
                <span>
                  {a.rotulo} <small className="muted">({a.exemplo})</small>
                </span>
              </label>
            ))}
          </fieldset>
          {periodos.map((p, i) => (
            <fieldset key={p.chave} className="mt-sm periodo-regra">
              <legend>Período {i + 1}</legend>
              <div className="form-grid">
                <Campo rotulo="Nome" cheio>
                  {({ id }) => (
                    <input
                      id={id}
                      value={p.nome}
                      maxLength={40}
                      onChange={(e) => mudar(i, { nome: e.target.value })}
                    />
                  )}
                </Campo>
                <Campo rotulo="Primeiro dia">
                  {({ id }) => (
                    <input
                      id={id}
                      type="date"
                      value={p.inicio}
                      onChange={(e) => mudar(i, { inicio: e.target.value })}
                    />
                  )}
                </Campo>
                <Campo rotulo="Último dia">
                  {({ id }) => (
                    <input
                      id={id}
                      type="date"
                      value={p.fim}
                      min={p.inicio}
                      onChange={(e) => mudar(i, { fim: e.target.value })}
                    />
                  )}
                </Campo>
                <Campo rotulo="Peso" dica="De 1 a 10">
                  {({ id, descricao }) => (
                    <select
                      id={id}
                      aria-describedby={descricao}
                      value={p.peso}
                      onChange={(e) => mudar(i, { peso: Number(e.target.value) })}
                    >
                      {PESOS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
              </div>
              {periodos.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-outline mt-sm"
                  onClick={() => setPeriodos(periodos.filter((_, j) => j !== i))}
                >
                  Tirar o período {i + 1}
                </button>
              ) : null}
            </fieldset>
          ))}
          <div className="actions mt-sm">
            {periodos.length < 8 ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPeriodos([...periodos, novoPeriodo(periodos.length + 1)])}
              >
                Mais um período
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary">
              Gravar nova versão
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
