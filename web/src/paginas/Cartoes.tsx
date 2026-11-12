import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, type Cartao, ErroApi, type ModeloCartao } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { useCarregar } from '../componentes/useCarregar';
import { carregarPreferencias } from '../preferencias';

// Cards de resumo (20d): título, frente e verso, só texto (sem link, e-mail nem HTML). Só o aluno vê.
// Ajuda para criar, sem IA: assistente em 3 passos com 4 modelos. Modo Revisar: um card por vez.
const MODELOS: {
  id: ModeloCartao;
  nome: string;
  frente: string;
  verso: string;
  dica: string;
}[] = [
  {
    id: 'conceito',
    nome: 'Conceito',
    frente: 'O que é? Para que serve?',
    verso: 'Um exemplo',
    dica: 'Escreva o que é a ideia e para que ela serve. No verso, um exemplo.',
  },
  {
    id: 'passo_a_passo',
    nome: 'Passo a passo',
    frente: 'O que eu quero fazer?',
    verso: 'Os passos, em ordem',
    dica: 'Na frente, o objetivo. No verso, os passos em ordem, um por linha.',
  },
  {
    id: 'formula',
    nome: 'Fórmula',
    frente: 'Qual é a fórmula?',
    verso: 'Quando usar e um exemplo',
    dica: 'Na frente, a fórmula. No verso, quando usar e um exemplo com números.',
  },
  {
    id: 'pergunta_resposta',
    nome: 'Pergunta e resposta',
    frente: 'A pergunta',
    verso: 'A resposta',
    dica: 'Na frente, uma pergunta. No verso, a resposta curta.',
  },
];
const LIMITE_FRENTE = 500;
const LIMITE_TITULO = 80;
const TEM_LINK = /(https?:|www\.|:\/\/|@|[<>])/i;
const DICA_FRASE_CURTA = 'Dica: frases curtas ajudam a lembrar.';

type Alvo = { tipo: 'tarefa' | 'disciplina'; id: string; nome: string };

function Contador({ texto, limite }: { texto: string; limite: number }) {
  return (
    <span className="contador-letras" aria-live="polite">
      {texto.length} de {limite} letras
    </span>
  );
}

// Assistente de 3 passos: 1 escolher o modelo, 2 escrever, 3 conferir e salvar
function Assistente({
  alvos,
  aoSalvar,
  aoFechar,
}: {
  alvos: Alvo[];
  aoSalvar: () => void;
  aoFechar: () => void;
}) {
  const [passo, setPasso] = useState(1);
  const [modelo, setModelo] = useState<ModeloCartao>('conceito');
  const [alvo, setAlvo] = useState(alvos[0] ? `${alvos[0].tipo}:${alvos[0].id}` : '');
  const [titulo, setTitulo] = useState('');
  const [frente, setFrente] = useState('');
  const [verso, setVerso] = useState('');
  const [erro, setErro] = useState('');
  const m = MODELOS.find((x) => x.id === modelo) as (typeof MODELOS)[number];

  const proximo = () => {
    setErro('');
    if (passo === 1 && !alvo) return setErro('Escolha a atividade ou a disciplina do card.');
    if (passo === 2) {
      if (!titulo.trim() || !frente.trim() || !verso.trim())
        return setErro('Preencha o título, a frente e o verso.');
      if ([titulo, frente, verso].some((t) => TEM_LINK.test(t)))
        return setErro('O texto não pode ter links, e-mail nem HTML.');
    }
    setPasso(passo + 1);
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    const [tipo, id] = alvo.split(':') as ['tarefa' | 'disciplina', string];
    try {
      await api.criarCartao({
        modelo,
        titulo: titulo.trim(),
        frente: frente.trim(),
        verso: verso.trim(),
        ...(tipo === 'tarefa' ? { tarefa_id: id } : { disciplina_id: id }),
      });
      aoSalvar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível salvar o card.');
    }
  }

  return (
    <form className="card mt" onSubmit={salvar} noValidate aria-labelledby="ca-novo">
      <h2 id="ca-novo">Novo card</h2>
      <ol className="passos-assistente" aria-label="Passos">
        {['Escolher', 'Escrever', 'Conferir'].map((nome, i) => (
          <li
            key={nome}
            className="passo-assistente"
            aria-current={passo === i + 1 ? 'step' : undefined}
          >
            Passo {i + 1} de 3: {nome}
          </li>
        ))}
      </ol>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}

      {passo === 1 ? (
        <div className="stack">
          <fieldset className="setting">
            <legend>
              <b>Qual modelo de card?</b>
            </legend>
            {MODELOS.map((x) => (
              <label key={x.id} className="opcao">
                <input
                  type="radio"
                  name="ca-modelo"
                  checked={modelo === x.id}
                  onChange={() => setModelo(x.id)}
                />{' '}
                {x.nome}
                <small className="muted"> · {x.dica}</small>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="ca-alvo">De qual atividade ou disciplina é o card?</label>
            <select id="ca-alvo" value={alvo} onChange={(e) => setAlvo(e.target.value)}>
              {alvos.length === 0 ? <option value="">Nenhuma ainda</option> : null}
              {alvos.map((a) => (
                <option key={`${a.tipo}:${a.id}`} value={`${a.tipo}:${a.id}`}>
                  {a.tipo === 'tarefa' ? 'Atividade' : 'Disciplina'}: {a.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="stack">
          <p className="muted small">
            {m.dica} {DICA_FRASE_CURTA}
          </p>
          <div className="field">
            <label htmlFor="ca-titulo">Título</label>
            <input
              id="ca-titulo"
              value={titulo}
              maxLength={LIMITE_TITULO}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <Contador texto={titulo} limite={LIMITE_TITULO} />
          </div>
          <div className="field">
            <label htmlFor="ca-frente">Frente: {m.frente}</label>
            <textarea
              id="ca-frente"
              rows={3}
              value={frente}
              maxLength={LIMITE_FRENTE}
              onChange={(e) => setFrente(e.target.value)}
            />
            <Contador texto={frente} limite={LIMITE_FRENTE} />
          </div>
          <div className="field">
            <label htmlFor="ca-verso">Verso: {m.verso}</label>
            <textarea
              id="ca-verso"
              rows={3}
              value={verso}
              maxLength={LIMITE_FRENTE}
              onChange={(e) => setVerso(e.target.value)}
            />
            <Contador texto={verso} limite={LIMITE_FRENTE} />
          </div>
        </div>
      ) : null}

      {passo === 3 ? (
        <div className="stack">
          <p>Confira o card. Se estiver bom, salve.</p>
          <div className="cartao">
            <strong>{titulo}</strong>
            <p>{frente}</p>
            <p className="cartao-verso">{verso}</p>
          </div>
        </div>
      ) : null}

      <div className="chip-row mt-sm">
        {passo > 1 ? (
          <button type="button" className="btn btn-outline" onClick={() => setPasso(passo - 1)}>
            Voltar
          </button>
        ) : null}
        {passo < 3 ? (
          <button type="button" className="btn btn-primary" onClick={proximo}>
            Continuar
          </button>
        ) : (
          <button type="submit" className="btn btn-primary">
            Salvar card
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Modo Revisar: um card por vez; "Ver o resumo" mostra o verso. Sem animação com "Reduzir movimento".
function Revisar({ cartoes, aoSair }: { cartoes: Cartao[]; aoSair: () => void }) {
  const [i, setI] = useState(0);
  const [viu, setViu] = useState(false);
  const reduzir = carregarPreferencias().movimento;
  const c = cartoes[i];
  const irPara = (n: number) => {
    setI(n);
    setViu(false);
  };
  if (!c) return null;
  return (
    <section
      className={`card mt${reduzir ? ' sem-animacao' : ''}`}
      aria-labelledby="ca-revisar"
      aria-live="polite"
    >
      <h2 id="ca-revisar">Revisar</h2>
      <p className="muted small">
        Card {i + 1} de {cartoes.length}
      </p>
      <div className="cartao cartao-revisar">
        <strong>{c.titulo}</strong>
        <p>{c.frente}</p>
        {viu ? <p className="cartao-verso">{c.verso}</p> : null}
      </div>
      <div className="chip-row mt-sm">
        {viu ? null : (
          <button type="button" className="btn btn-primary" onClick={() => setViu(true)}>
            Ver o resumo
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline"
          disabled={i === 0}
          onClick={() => irPara(i - 1)}
        >
          Card anterior
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={i >= cartoes.length - 1}
          onClick={() => irPara(i + 1)}
        >
          Próximo card
        </button>
        <button type="button" className="btn btn-ghost" onClick={aoSair}>
          Parar por agora
        </button>
      </div>
    </section>
  );
}

export function Cartoes() {
  const lista = useCarregar(api.cartoes);
  const tarefas = useCarregar(api.tarefas);
  const disciplinas = useCarregar(api.minhasDisciplinas);
  const [criando, setCriando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [msg, setMsg] = useState('');
  const cartoes = lista.dados?.cartoes ?? [];
  const alvos: Alvo[] = [
    ...(tarefas.dados?.tarefas ?? [])
      .filter((t) => t.situacao !== 'concluida')
      .map((t) => ({ tipo: 'tarefa' as const, id: t.id, nome: t.titulo })),
    ...(disciplinas.dados?.minhas ?? []).map((d) => ({
      tipo: 'disciplina' as const,
      id: d.id,
      nome: d.nome,
    })),
  ];

  async function remover(c: Cartao) {
    setMsg('');
    try {
      await api.removerCartao(c.id);
      await lista.recarregar();
      setMsg('O card saiu da lista.');
    } catch (x) {
      setMsg(x instanceof ErroApi ? x.message : 'Não foi possível tirar o card.');
    }
  }

  return (
    <>
      <Titulo
        olho="Estudo"
        titulo="Cards de resumo"
        sub="Resumos curtos para estudar. Só você vê os seus cards."
        acoes={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCriando(true);
                setRevisando(false);
              }}
            >
              Criar card
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={cartoes.length === 0}
              onClick={() => {
                setRevisando(true);
                setCriando(false);
              }}
            >
              Revisar
            </button>
          </>
        }
      />
      {lista.erro ? <Aviso tipo="warn">{lista.erro}</Aviso> : null}
      {msg ? <Aviso tipo="info">{msg}</Aviso> : null}
      {criando ? (
        <Assistente
          alvos={alvos}
          aoFechar={() => setCriando(false)}
          aoSalvar={() => {
            setCriando(false);
            setMsg('Card salvo.');
            void lista.recarregar();
          }}
        />
      ) : null}
      {revisando ? <Revisar cartoes={cartoes} aoSair={() => setRevisando(false)} /> : null}

      <section className="card mt" aria-labelledby="ca-lista">
        <h2 id="ca-lista">Seus cards ({cartoes.length})</h2>
        {lista.dados && cartoes.length === 0 ? (
          <Vazio>Você ainda não tem cards. Escolha "Criar card" para começar.</Vazio>
        ) : null}
        <ul className="cal-lista">
          {cartoes.map((c) => (
            <li key={c.id} className="cal-evento">
              <div className="cal-parte">
                <strong>{c.titulo}</strong>
                <div className="small muted">
                  {c.tarefa_titulo
                    ? `Atividade: ${c.tarefa_titulo}`
                    : `Disciplina: ${c.disciplina_nome}`}
                </div>
              </div>
              <div className="cal-acoes">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  aria-label={`Tirar o card ${c.titulo}`}
                  onClick={() => void remover(c)}
                >
                  Tirar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
