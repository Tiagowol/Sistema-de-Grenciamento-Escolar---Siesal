import { useState } from 'react';
import { api, type DisciplinaAluno, ErroApi, type EtapaDisciplinas } from '../api';
import { Aviso } from './Aviso';
import { Vazio } from './Basicos';
import { CaixaDeDisciplina } from './CaixaDeDisciplina';
import { Dificuldade } from './Dificuldade';
import { useCarregar } from './useCarregar';

// Minhas disciplinas (L20b), em Personalizar: escolher a etapa (marca as gerais), acrescentar do catálogo,
// criar as próprias (10 campos; até 20), corrigir o nome e tirar da lista. Nada é apagado de verdade.
const ETAPAS: { id: EtapaDisciplinas; nome: string }[] = [
  { id: 'fundamental', nome: 'Ensino Fundamental (anos finais)' },
  { id: 'medio', nome: 'Ensino Médio' },
  { id: 'tecnico', nome: 'Técnico integrado ao Ensino Médio (IFRN)' },
];
const CAMPOS_VISIVEIS = 10;
const ROTULO_ORIGEM: Record<DisciplinaAluno['origem'], string> = {
  catalogo: 'da lista',
  propria: 'minha',
  escola: 'da escola',
  suap: 'do SUAP',
};

export function MinhasDisciplinas() {
  const { dados, erro, recarregar } = useCarregar(api.minhasDisciplinas);
  const [msg, setMsg] = useState('');
  const [busca, setBusca] = useState('');
  const [novas, setNovas] = useState<string[]>(() => Array(CAMPOS_VISIVEIS).fill(''));
  const [edicoes, setEdicoes] = useState<Record<string, string>>({});

  const minhas = dados?.minhas ?? [];
  const proprias = minhas.filter((d) => d.origem === 'propria');
  const limite = dados?.limite_proprias ?? 20;
  // 10 campos no total; passando disso, sempre sobra um campo em branco até o limite
  const vazios = proprias.length >= limite ? 0 : Math.max(1, CAMPOS_VISIVEIS - proprias.length);

  async function acao(fazer: () => Promise<unknown>, ok?: string) {
    setMsg('');
    try {
      await fazer();
      await recarregar();
      if (ok) setMsg(ok);
    } catch (x) {
      setMsg(x instanceof ErroApi ? x.message : 'Não foi possível salvar. Tente de novo.');
    }
  }

  const criarPropria = (i: number) =>
    acao(async () => {
      await api.criarMinhaDisciplina({ nome: (novas[i] ?? '').trim() });
      setNovas((v) => v.map((t, j) => (j === i ? '' : t)));
    }, 'Disciplina salva.');

  return (
    <section className="card mt" aria-labelledby="pz-disc">
      <h2 id="pz-disc">Minhas disciplinas</h2>
      <p className="muted small">
        Estas são as disciplinas que aparecem quando você cria uma atividade ou anota uma nota. Só
        você vê a sua lista de disciplinas. Você pode tirar da lista as que não tem e criar as suas.
      </p>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {msg ? <Aviso tipo="info">{msg}</Aviso> : null}

      <fieldset className="setting">
        <legend>
          <b>Em que etapa você está?</b>
        </legend>
        {ETAPAS.map((e) => (
          <label key={e.id} className="opcao">
            <input
              type="radio"
              name="pz-etapa"
              checked={dados?.etapa === e.id}
              onChange={() =>
                acao(async () => {
                  await api.escolherEtapaDisciplinas(e.id);
                }, 'Pronto. As disciplinas gerais da sua etapa foram marcadas. Tire as que você não tem.')
              }
            />{' '}
            {e.nome}
          </label>
        ))}
        <p>As disciplinas gerais da etapa já vêm marcadas. Você tira as que não tem.</p>
      </fieldset>

      <h3 className="mt-sm">Sua lista ({minhas.length})</h3>
      {dados && minhas.length === 0 ? (
        <Vazio>Sua lista está vazia. Escolha a etapa acima ou crie uma disciplina.</Vazio>
      ) : null}
      <ul className="cal-lista mt-sm">
        {minhas.map((d) => (
          <li key={d.id} className="cal-evento">
            <div className="cal-parte">
              <strong>{d.nome}</strong>{' '}
              <span className="small muted">({ROTULO_ORIGEM[d.origem]})</span>
              <Dificuldade
                rotulo={`Dificuldade de ${d.nome} (opcional)`}
                nome={`dif-disc-${d.id}`}
                valor={d.dificuldade}
                aoMudar={(v) =>
                  acao(() => api.dificuldadeDaDisciplina(d.id, v), 'Dificuldade salva.')
                }
              />
            </div>
            <div className="cal-acoes">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                aria-label={`Tirar ${d.nome} da lista`}
                onClick={() =>
                  acao(() => api.removerMinhaDisciplina(d.id), `${d.nome} saiu da lista.`)
                }
              >
                Tirar da lista
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="field mt">
        <label htmlFor="pz-disc-busca">Acrescentar uma disciplina da lista</label>
        <CaixaDeDisciplina
          id="pz-disc-busca"
          valor={busca}
          aoDigitar={setBusca}
          aoEscolher={() => {
            setBusca('');
            void recarregar();
          }}
        />
        <div className="field-hint">
          Digite as primeiras letras. Se não achar, escolha "Criar a disciplina".
        </div>
      </div>

      <fieldset className="setting mt">
        <legend>
          <b>
            Disciplinas que eu criei ({proprias.length} de {limite})
          </b>
        </legend>
        <p>Corrija o nome ou crie uma nova. Cada campo guarda uma disciplina.</p>
        {proprias.map((d, i) => {
          const texto = edicoes[d.id] ?? d.nome;
          return (
            <div className="disc-campo" key={d.id}>
              <label htmlFor={`pz-propria-${d.id}`} className="sr-only">
                Disciplina própria {i + 1}
              </label>
              <input
                id={`pz-propria-${d.id}`}
                value={texto}
                maxLength={80}
                onChange={(e) => setEdicoes((v) => ({ ...v, [d.id]: e.target.value }))}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!texto.trim() || texto.trim() === d.nome}
                aria-label={`Salvar o novo nome de ${d.nome}`}
                onClick={() =>
                  acao(async () => {
                    await api.corrigirMinhaDisciplina(d.id, texto.trim());
                    setEdicoes((v) => {
                      const { [d.id]: _, ...resto } = v;
                      return resto;
                    });
                  }, 'Nome corrigido.')
                }
              >
                Salvar
              </button>
            </div>
          );
        })}
        {/* Campos em branco: até completar 10 campos no total; depois, um de cada vez até o limite */}
        {novas.slice(0, vazios).map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: campos em branco fixos, sem reordenar
          <div className="disc-campo" key={`nova-${i}`}>
            <label htmlFor={`pz-nova-${i}`} className="sr-only">
              Nova disciplina própria {proprias.length + i + 1}
            </label>
            <input
              id={`pz-nova-${i}`}
              value={t}
              maxLength={80}
              placeholder="Nome da disciplina"
              disabled={proprias.length >= limite}
              onChange={(e) => {
                const v = e.target.value;
                if (/(https?:|www\.|:\/\/|@)/i.test(v)) return;
                setNovas((a) => a.map((x, j) => (j === i ? v : x)));
              }}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={!t.trim() || proprias.length >= limite}
              aria-label={`Criar a disciplina do campo ${proprias.length + i + 1}`}
              onClick={() => criarPropria(i)}
            >
              Criar
            </button>
          </div>
        ))}
        {proprias.length >= limite ? (
          <p>Você chegou ao limite de {limite} disciplinas próprias. Tire uma para criar outra.</p>
        ) : null}
      </fieldset>

      <div className="mt-sm">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            acao(async () => {
              const r = await api.disciplinasDaEscola();
              setMsg(
                r.novas
                  ? `Pronto. ${r.novas} disciplina(s) da sua turma entraram na lista.`
                  : 'Não há disciplinas novas da sua turma.',
              );
            })
          }
        >
          Trazer as disciplinas da minha turma
        </button>
      </div>
    </section>
  );
}
