import type { FormEvent } from 'react';
import { useState } from 'react';
import {
  type Acompanhante,
  api,
  ErroApi,
  type ItensAcompanhamento,
  type PapelAcompanhante,
} from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';

// L22a-2: "Quem pode ver meus dados" (aluno e representante legal). Texto literal, sem pressão.
// O pedido nasce sempre aqui, do lado do aluno; ninguém procura aluno. Padrão: nada marcado.
const PAPEL: Record<PapelAcompanhante, string> = {
  professor: 'Professor',
  pedagogico: 'Pedagógico (pedagogo, psicopedagogo, terapeuta ou outro da área)',
  responsavel: 'Representante indicado',
};
const ITENS: { chave: keyof ItensAcompanhamento; rotulo: string; dica: string }[] = [
  {
    chave: 'tarefas',
    rotulo: 'Tarefas, plano e agenda',
    dica: 'As tarefas, os prazos, as etapas, a agenda e as disciplinas.',
  },
  {
    chave: 'dificuldade',
    rotulo: 'Nível de dificuldade',
    dica: 'Os níveis de 0 a 10 que o aluno marcou.',
  },
  { chave: 'notas', rotulo: 'Notas', dica: 'As notas que o aluno anotou.' },
  { chave: 'mensagens', rotulo: 'Mensagens', dica: 'Os pedidos de ajuda e as respostas.' },
];
const SITUACAO: Record<string, string> = {
  aguardando_aceite: 'Esperando a pessoa aceitar o convite',
  aguardando_representante: 'Esperando o representante legal aprovar',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
};
const AVISO_VALIDADE: Record<string, string> = {
  trinta: 'Falta cerca de 1 mês para vencer.',
  quinze: 'Faltam cerca de 15 dias para vencer.',
  um: 'Vence amanhã ou hoje.',
  vencido: 'Venceu. A pessoa não vê nada até renovar.',
};
const itensDe = (a: Acompanhante): ItensAcompanhamento => ({
  tarefas: a.ver_tarefas,
  dificuldade: a.ver_dificuldade,
  notas: a.ver_notas,
  mensagens: a.ver_mensagens,
});

// Validade em palavra, data e barra (a barra mostra quanto falta de 12 meses)
function Validade({ a }: { a: Acompanhante }) {
  if (a.fim_em === null)
    return <p className="muted small">Sem data de fim. Só acaba se o aluno pedir.</p>;
  const resta = Math.max(0, Math.min(365, a.dias_restantes ?? 0));
  const [ano, mes, dia] = a.fim_em.split('-');
  return (
    <div>
      <p className="small">
        Vale até{' '}
        <strong>
          {dia}/{mes}/{ano}
        </strong>
        .{a.aviso ? ` ${AVISO_VALIDADE[a.aviso]}` : ''}
      </p>
      <div
        role="img"
        aria-label={`Barra de validade: ${Math.round((resta / 365) * 100)} por cento do ano ainda vale.`}
        style={{ background: 'var(--line, #ddd)', borderRadius: 6, height: 10, maxWidth: 320 }}
      >
        <div
          style={{
            width: `${(resta / 365) * 100}%`,
            height: '100%',
            borderRadius: 6,
            background: 'var(--primary, #2557a7)',
          }}
        />
      </div>
    </div>
  );
}

function Cartao({
  a,
  podeGerir,
  ehRepresentante,
  menor,
  aoMudar,
}: {
  a: Acompanhante;
  podeGerir: boolean;
  ehRepresentante: boolean;
  menor: boolean;
  aoMudar: (msg: string) => void;
}) {
  const [itens, setItens] = useState<ItensAcompanhamento>(itensDe(a));
  const [encerrando, setEncerrando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const aberto = a.situacao !== 'encerrado';

  async function agir(fn: () => Promise<unknown>, msg: string) {
    setErro('');
    setOcupado(true);
    try {
      await fn();
      aoMudar(msg);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }
  // Renovação: aluno menor, o representante; aluno maior, o próprio aluno
  const podeRenovar =
    aberto &&
    a.situacao === 'ativo' &&
    a.papel !== 'responsavel' &&
    a.origem === 'email' &&
    (menor ? ehRepresentante : !ehRepresentante);
  // Vínculo de instituição: a instituição renova em lote; o aluno prorroga por 30 dias, perto da data
  const podeProrrogar =
    aberto && a.situacao === 'ativo' && a.origem === 'codigo' && (a.dias_restantes ?? 999) <= 30;
  const precisaAprovar = a.situacao === 'aguardando_representante' || (!a.aprovado && aberto);

  return (
    <li className="card stack" style={{ listStyle: 'none' }}>
      <h3 style={{ fontSize: 17 }}>
        {a.origem === 'codigo' ? `Instituição: ${a.instituicao_nome ?? ''}` : PAPEL[a.papel]}
      </h3>
      {a.origem === 'codigo' ? (
        <p className="small">Pedagógico da instituição (a instituição escolhe quem acompanha).</p>
      ) : (
        <p className="small">{a.email_convidado}</p>
      )}
      <p className="small">
        <strong>{SITUACAO[a.situacao]}</strong>
      </p>
      {aberto && a.situacao === 'ativo' ? <Validade a={a} /> : null}
      {!aberto && a.justificativa ? (
        <p className="small">Motivo registrado: {a.justificativa}</p>
      ) : null}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {aberto ? (
        <fieldset disabled={!podeGerir || ocupado} style={{ border: 0, padding: 0 }}>
          <legend className="small">O que esta pessoa pode ver</legend>
          {ITENS.map((i) => (
            <label key={i.chave} className="check" style={{ display: 'block', minHeight: 44 }}>
              <input
                type="checkbox"
                checked={itens[i.chave]}
                onChange={(e) => setItens({ ...itens, [i.chave]: e.target.checked })}
              />{' '}
              {i.rotulo} <span className="muted small">— {i.dica}</span>
            </label>
          ))}
          {podeGerir ? (
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 44 }}
              onClick={() =>
                void agir(
                  () => api.acompanhamentoItens(a.id, itens),
                  'Escolhas salvas. A pessoa vê o aviso da mudança.',
                )
              }
            >
              Salvar o que a pessoa pode ver
            </button>
          ) : null}
        </fieldset>
      ) : null}
      {aberto && podeGerir ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {ehRepresentante && menor && precisaAprovar ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 44 }}
              disabled={ocupado}
              onClick={() => void agir(() => api.acompanhamentoAprovar(a.id), 'Pedido aprovado.')}
            >
              Aprovar este pedido
            </button>
          ) : null}
          {podeRenovar ? (
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 44 }}
              disabled={ocupado}
              onClick={() =>
                void agir(() => api.acompanhamentoRenovar(a.id), 'Renovado por mais 12 meses.')
              }
            >
              Renovar por 12 meses
            </button>
          ) : null}
          {podeProrrogar ? (
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 44 }}
              disabled={ocupado}
              onClick={() =>
                void agir(() => api.acompanhamentoProrrogar(a.id), 'Prorrogado por mais 30 dias.')
              }
            >
              Prorrogar por 30 dias
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            style={{ minHeight: 44 }}
            onClick={() => setEncerrando(!encerrando)}
          >
            Encerrar o acesso
          </button>
        </div>
      ) : null}
      {encerrando ? (
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void agir(() => api.acompanhamentoEncerrar(a.id, motivo), 'Acesso encerrado.');
          }}
        >
          <Campo
            rotulo="Por que você quer encerrar?"
            dica="Escreva uma frase curta. Ela fica registrada."
          >
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                value={motivo}
                minLength={3}
                maxLength={300}
                required
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </Campo>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ minHeight: 44 }}
            disabled={ocupado || motivo.trim().length < 3}
          >
            Confirmar o encerramento
          </button>
        </form>
      ) : null}
    </li>
  );
}

export function QuemPodeVer() {
  const { dados, erro, recarregar } = useCarregar(api.acompanhamentoLista);
  const [aviso, setAviso] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<PapelAcompanhante>('professor');
  const [itens, setItens] = useState<ItensAcompanhamento>({
    tarefas: false,
    dificuldade: false,
    notas: false,
    mensagens: false,
  });
  const [falha, setFalha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function convidar(e: FormEvent) {
    e.preventDefault();
    setFalha('');
    setAviso('');
    setEnviando(true);
    try {
      const r = await api.acompanhamentoCriar({ email, papel, itens });
      setAviso(
        r.aguarda_aprovacao
          ? 'Convite enviado. Como o aluno é menor de idade, o representante legal precisa aprovar antes de a pessoa ver algo.'
          : 'Convite enviado. A pessoa precisa aceitar pelo link do e-mail.',
      );
      setEmail('');
      await recarregar();
    } catch (x) {
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível enviar o convite.');
    } finally {
      setEnviando(false);
    }
  }

  if (erro)
    return (
      <>
        <Titulo
          olho="Privacidade"
          titulo="Quem pode ver meus dados"
          sub="Você escolhe quem acompanha e o que cada pessoa vê."
        />
        <Aviso tipo="warn">{erro}</Aviso>
      </>
    );
  const lista = dados?.acompanhantes ?? [];
  const abertos = lista.filter((a) => a.situacao !== 'encerrado').length;
  const ehRepresentante = dados?.ator === 'representante';
  const podeGerir = dados?.pode_gerir ?? false;
  const maior = dados ? !dados.menor : false;

  return (
    <>
      <Titulo
        olho="Privacidade"
        titulo="Quem pode ver meus dados"
        sub="Você escolhe quem acompanha e o que cada pessoa vê. Você pode encerrar quando quiser."
      />
      <Aviso tipo="info">
        Ninguém vê nada até você aceitar e marcar.{' '}
        {dados?.menor
          ? 'Como o aluno é menor de idade, o representante legal aprova cada pedido.'
          : ''}{' '}
        Cada vez que alguém lê os dados, isso fica registrado.
      </Aviso>
      {aviso ? <Aviso tipo="info">{aviso}</Aviso> : null}
      <section className="stack" aria-label="Convidar uma pessoa">
        <h2 style={{ fontSize: 18 }}>Convidar uma pessoa</h2>
        <p className="muted small">
          Você tem {abertos} de {dados?.limite ?? 5} pessoas.
        </p>
        {podeGerir && abertos < (dados?.limite ?? 5) ? (
          <form className="stack" onSubmit={convidar}>
            {falha ? <Aviso tipo="warn">{falha}</Aviso> : null}
            <Campo
              rotulo="E-mail da pessoa"
              dica="Ela recebe um link para aceitar. Se não tiver conta, faz o cadastro com este e-mail."
            >
              {({ id, descricao }) => (
                <input
                  id={id}
                  aria-describedby={descricao}
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Quem é">
              {({ id }) => (
                <select
                  id={id}
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as PapelAcompanhante)}
                >
                  <option value="professor">{PAPEL.professor}</option>
                  <option value="pedagogico">{PAPEL.pedagogico}</option>
                  {maior && !ehRepresentante ? (
                    <option value="responsavel">{PAPEL.responsavel}</option>
                  ) : null}
                </select>
              )}
            </Campo>
            <fieldset style={{ border: 0, padding: 0 }}>
              <legend className="small">O que a pessoa pode ver (nada marcado no começo)</legend>
              {ITENS.map((i) => (
                <label key={i.chave} className="check" style={{ display: 'block', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={itens[i.chave]}
                    onChange={(e) => setItens({ ...itens, [i.chave]: e.target.checked })}
                  />{' '}
                  {i.rotulo} <span className="muted small">— {i.dica}</span>
                </label>
              ))}
            </fieldset>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ minHeight: 44 }}
              disabled={enviando}
            >
              {enviando ? 'Enviando…' : 'Enviar convite'}
            </button>
          </form>
        ) : (
          <Aviso tipo="info">
            {podeGerir
              ? 'Você chegou ao limite de pessoas. Encerre uma para convidar outra.'
              : 'Só o aluno pode convidar. O representante legal só gerencia quando o aluno é menor de idade.'}
          </Aviso>
        )}
      </section>
      {podeGerir && abertos < (dados?.limite ?? 5) ? (
        <PedirPorCodigo
          aoEnviar={(m) => {
            setAviso(m);
            void recarregar();
          }}
        />
      ) : null}
      <section className="stack" aria-label="Pessoas com acesso">
        <h2 style={{ fontSize: 18 }}>Pessoas e pedidos</h2>
        {lista.length === 0 ? (
          <Vazio>Ninguém acompanha ainda.</Vazio>
        ) : (
          <ul className="stack" style={{ padding: 0 }}>
            {lista.map((a) => (
              <Cartao
                key={`${a.id}-${a.situacao}-${a.ver_tarefas}${a.ver_dificuldade}${a.ver_notas}${a.ver_mensagens}`}
                a={a}
                podeGerir={podeGerir}
                ehRepresentante={ehRepresentante}
                menor={dados?.menor ?? true}
                aoMudar={(m) => {
                  setAviso(m);
                  void recarregar();
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// L22a-2b: o aluno (ou o representante legal) digita o código de uma instituição. O pedido cai na fila do Pedagógico dela.
function PedirPorCodigo({ aoEnviar }: { aoEnviar: (mensagem: string) => void }) {
  const [codigo, setCodigo] = useState('');
  const [itens, setItens] = useState<ItensAcompanhamento>({
    tarefas: false,
    dificuldade: false,
    notas: false,
    mensagens: false,
  });
  const [falha, setFalha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setFalha('');
    setEnviando(true);
    try {
      const r = await api.acompanhamentoPorCodigo({ codigo, itens });
      setCodigo('');
      aoEnviar(
        r.aguarda_aprovacao
          ? 'Pedido enviado. Como o aluno é menor de idade, o representante legal precisa aprovar. Depois, o Pedagógico da instituição aceita ou recusa.'
          : 'Pedido enviado. O Pedagógico da instituição aceita ou recusa.',
      );
    } catch (x) {
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="stack" aria-label="Falar com uma instituição">
      <h2 style={{ fontSize: 18 }}>Falar com uma instituição</h2>
      <p className="muted small">
        Se uma instituição deu um código para você, digite aqui. Você não vê lista de profissionais:
        a instituição escolhe quem acompanha.
      </p>
      <form className="stack" onSubmit={enviar}>
        {falha ? <Aviso tipo="warn">{falha}</Aviso> : null}
        <Campo rotulo="Código da instituição" dica="Exemplo: ABCD-EFGH-JKLM-NPQR">
          {({ id, descricao }) => (
            <input
              id={id}
              aria-describedby={descricao}
              value={codigo}
              required
              minLength={8}
              maxLength={64}
              autoComplete="off"
              onChange={(e) => setCodigo(e.target.value)}
            />
          )}
        </Campo>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="small">O que a instituição pode ver (nada marcado no começo)</legend>
          {ITENS.map((i) => (
            <label key={i.chave} className="check" style={{ display: 'block', minHeight: 44 }}>
              <input
                type="checkbox"
                checked={itens[i.chave]}
                onChange={(e) => setItens({ ...itens, [i.chave]: e.target.checked })}
              />{' '}
              {i.rotulo} <span className="muted small">— {i.dica}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ minHeight: 44 }}
          disabled={enviando}
        >
          {enviando ? 'Enviando…' : 'Enviar pedido'}
        </button>
      </form>
    </section>
  );
}
