import type { FormEvent } from 'react';
import { useState } from 'react';
import {
  api,
  ErroApi,
  type ItemAcompanhado,
  type PedidoFila,
  type VinculoInstituicao,
} from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { paraTexto, relativo } from '../datas';

// L22a-2b: acompanhamento por código da instituição (Admin e Pedagógico). Texto literal, sem pressão.
// A fila mostra só o nome do aluno e as caixas pedidas. Leitura: um aluno e um item por vez, só o que o aluno liberou.
const CAIXAS: {
  campo: 'ver_tarefas' | 'ver_dificuldade' | 'ver_notas' | 'ver_mensagens';
  item: ItemAcompanhado;
  rotulo: string;
}[] = [
  { campo: 'ver_tarefas', item: 'tarefas', rotulo: 'Tarefas e plano' },
  { campo: 'ver_dificuldade', item: 'dificuldade', rotulo: 'Nível de dificuldade' },
  { campo: 'ver_notas', item: 'notas', rotulo: 'Notas' },
  { campo: 'ver_mensagens', item: 'mensagens', rotulo: 'Mensagens' },
];
const AVISO: Record<string, string> = {
  trinta: 'Falta cerca de 1 mês para vencer.',
  quinze: 'Faltam cerca de 15 dias para vencer.',
  um: 'Vence amanhã ou hoje.',
  vencido: 'Venceu. O Pedagógico não vê nada até renovar.',
};
const texto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
// Prazo em palavra e data (hoje, amanhã, em 3 dias), nunca só o número
const prazo = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
    ? `${relativo(v.slice(0, 10), paraTexto(new Date()))} (${v.slice(8, 10)}/${v.slice(5, 7)})`
    : '—';
const dia = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
    ? `${v.slice(8, 10)}/${v.slice(5, 7)}`
    : texto(v);
const listaDeCaixas = (c: Record<string, boolean>) =>
  CAIXAS.filter((i) => c[i.campo])
    .map((i) => i.rotulo)
    .join(', ') || 'nada marcado';

// Barra de validade: quanto falta de 12 meses (forma visual; a palavra e a data ficam ao lado)
function Validade({ v }: { v: VinculoInstituicao }) {
  if (v.fim_em === null) return <p className="small">Sem data de fim ainda.</p>;
  const [ano, mes, d] = v.fim_em.split('-');
  const resta = Math.max(0, Math.min(365, v.dias_restantes ?? 0));
  return (
    <div>
      <p className="small">
        Vale até{' '}
        <strong>
          {d}/{mes}/{ano}
        </strong>
        . {v.aviso ? AVISO[v.aviso] : ''}
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

function Motivo({
  rotulo,
  botao,
  aoEnviar,
  aoCancelar,
}: {
  rotulo: string;
  botao: string;
  aoEnviar: (m: string) => void;
  aoCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        aoEnviar(motivo);
      }}
    >
      <Campo rotulo={rotulo} dica="Escreva uma frase curta. Ela fica registrada.">
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
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ minHeight: 44 }}
          disabled={motivo.trim().length < 3}
        >
          {botao}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          style={{ minHeight: 44 }}
          onClick={aoCancelar}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CodigoDoAdmin() {
  const { dados, erro, recarregar } = useCarregar(api.instCodigo);
  const [novo, setNovo] = useState('');
  const [falha, setFalha] = useState('');
  async function agir(acao: 'gerar' | 'ligar' | 'desligar') {
    setFalha('');
    try {
      const r = await api.instCodigoAcao(acao);
      setNovo(acao === 'gerar' ? (r.codigo ?? '') : '');
      await recarregar();
    } catch (x) {
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível.');
    }
  }
  return (
    <section className="stack" aria-label="Código da instituição">
      <h2 style={{ fontSize: 18 }}>Código da instituição</h2>
      <p className="muted small">
        Com o código, um aluno (ou o representante legal) pede o acompanhamento da instituição. O
        pedido vai para a fila do Pedagógico. O aluno não vê lista de profissionais.
      </p>
      {erro || falha ? <Aviso tipo="warn">{erro || falha}</Aviso> : null}
      {novo ? (
        <Aviso tipo="info">
          Código novo: <strong>{novo}</strong>. Ele aparece só agora. Copie e envie por um canal
          seguro. O código antigo deixou de valer.
        </Aviso>
      ) : null}
      <p className="small">
        Situação:{' '}
        <strong>
          {dados?.ativo ? 'ligado' : dados?.tem_codigo ? 'desligado' : 'ainda sem código'}
        </strong>
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44 }}
          onClick={() => void agir('gerar')}
        >
          {dados?.tem_codigo ? 'Gerar código novo' : 'Gerar código'}
        </button>
        {dados?.tem_codigo && !dados.ativo ? (
          <button
            type="button"
            className="btn btn-soft"
            style={{ minHeight: 44 }}
            onClick={() => void agir('ligar')}
          >
            Ligar
          </button>
        ) : null}
        {dados?.ativo ? (
          <button
            type="button"
            className="btn btn-outline"
            style={{ minHeight: 44 }}
            onClick={() => void agir('desligar')}
          >
            Desligar
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FilaDoPedagogico({ aoMudar }: { aoMudar: () => void }) {
  const { dados, erro, recarregar } = useCarregar(api.instFila);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [falha, setFalha] = useState('');
  async function agir(fn: () => Promise<unknown>) {
    setFalha('');
    try {
      await fn();
      setRecusando(null);
      await recarregar();
      aoMudar();
    } catch (x) {
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível.');
    }
  }
  const pedidos: PedidoFila[] = dados?.pedidos ?? [];
  return (
    <section className="stack" aria-label="Pedidos esperando">
      <h2 style={{ fontSize: 18 }}>Pedidos esperando</h2>
      <p className="muted small">
        Você vê só o nome do aluno e o que ele pediu para liberar. Quem aceita passa a acompanhar o
        aluno, e o acesso fica no seu nome.
      </p>
      {erro || falha ? <Aviso tipo="warn">{erro || falha}</Aviso> : null}
      {pedidos.length === 0 ? (
        <Vazio>Nenhum pedido esperando.</Vazio>
      ) : (
        <ul className="stack" style={{ padding: 0, listStyle: 'none' }}>
          {pedidos.map((p) => (
            <li key={p.acompanhamento_id} className="card stack">
              <h3 style={{ fontSize: 16 }}>{p.aluno_nome}</h3>
              <p className="small">
                Pediu para liberar: {listaDeCaixas(p as unknown as Record<string, boolean>)}.
              </p>
              {!p.aprovado ? (
                <p className="small">
                  O representante legal ainda precisa aprovar. Até lá, nada é liberado.
                </p>
              ) : null}
              {recusando === p.acompanhamento_id ? (
                <Motivo
                  rotulo="Por que você recusa?"
                  botao="Confirmar a recusa"
                  aoEnviar={(m) => void agir(() => api.instRecusar(p.acompanhamento_id, m))}
                  aoCancelar={() => setRecusando(null)}
                />
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ minHeight: 44 }}
                    onClick={() => void agir(() => api.instAceitar(p.acompanhamento_id))}
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ minHeight: 44 }}
                    onClick={() => setRecusando(p.acompanhamento_id)}
                  >
                    Recusar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Leitura({ item, dados }: { item: ItemAcompanhado; dados: Record<string, unknown>[] }) {
  if (dados.length === 0) return <Vazio>Nada para mostrar neste item.</Vazio>;
  return (
    <ul className="stack" style={{ padding: 0, listStyle: 'none' }}>
      {dados.map((d, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista só de leitura, sem identificador
        <li key={i} className="card small">
          {item === 'tarefas' ? (
            <>
              <strong>{texto(d.titulo)}</strong>
              {d.disciplina ? ` — ${String(d.disciplina)}` : ''}. Prazo: {prazo(d.prazo)}. Situação:{' '}
              {texto(d.situacao)}.
            </>
          ) : null}
          {item === 'dificuldade' ? (
            <>
              <strong>{texto(d.nome)}</strong> ({d.origem === 'tarefa' ? 'tarefa' : 'disciplina'}):
              nível {texto(d.dificuldade)} de 10. É a percepção do aluno.
            </>
          ) : null}
          {item === 'notas' ? (
            <>
              <strong>{texto(d.disciplina)}</strong>: {texto(d.valor)} em {dia(d.dia)}.{' '}
              {texto(d.descricao) === '—' ? '' : texto(d.descricao)}
            </>
          ) : null}
          {item === 'mensagens' ? (
            <>
              Pedido de ajuda ({texto(d.motivo)}), {dia(d.criado_em)}: {texto(d.texto)}
              {d.resposta ? <> Resposta: {texto(d.resposta)}</> : null}
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Vinculos({ ehAdmin, ehPedagogico }: { ehAdmin: boolean; ehPedagogico: boolean }) {
  const { dados, erro, recarregar } = useCarregar(api.instVinculos);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [encerrando, setEncerrando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<{
    id: string;
    item: ItemAcompanhado;
    dados: Record<string, unknown>[];
  } | null>(null);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');

  async function agir(fn: () => Promise<unknown>, msg: string) {
    setFalha('');
    try {
      await fn();
      setAviso(msg);
      setEncerrando(null);
      setMarcados([]);
      await recarregar();
    } catch (x) {
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível.');
    }
  }
  async function ler(v: VinculoInstituicao, item: ItemAcompanhado) {
    setFalha('');
    try {
      setAberto({ id: v.id, item, dados: (await api.instLer(v.id, item)).dados });
    } catch (x) {
      setAberto(null);
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível abrir.');
    }
  }
  const lista = dados?.vinculos ?? [];
  return (
    <section className="stack" aria-label="Alunos acompanhados pela instituição">
      <h2 style={{ fontSize: 18 }}>Alunos acompanhados pela instituição</h2>
      <p className="muted small">
        Cada Pedagógico lê só os alunos que aceitou, um aluno e um item por vez. Cada leitura fica
        registrada.
      </p>
      {erro || falha ? <Aviso tipo="warn">{erro || falha}</Aviso> : null}
      {aviso ? <Aviso tipo="info">{aviso}</Aviso> : null}
      {lista.length === 0 ? (
        <Vazio>Nenhum aluno acompanhado ainda.</Vazio>
      ) : (
        <>
          <ul className="stack" style={{ padding: 0, listStyle: 'none' }}>
            {lista.map((v) => (
              <li key={v.id} className="card stack">
                <label className="check" style={{ display: 'block', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={marcados.includes(v.id)}
                    onChange={(e) =>
                      setMarcados(
                        e.target.checked ? [...marcados, v.id] : marcados.filter((x) => x !== v.id),
                      )
                    }
                  />{' '}
                  <strong>{v.aluno_nome}</strong> — acompanhado por {v.acompanhante_nome}
                </label>
                <p className="small">
                  Liberado: {listaDeCaixas(v as unknown as Record<string, boolean>)}.
                </p>
                {v.situacao === 'aguardando_representante' ? (
                  <p className="small">
                    Esperando o representante legal aprovar. Até lá, nada é liberado.
                  </p>
                ) : (
                  <Validade v={v} />
                )}
                {v.meu && v.aviso_pendente ? (
                  <Aviso tipo="info">
                    Quem controla o acesso é o aluno e, se for menor de idade, o representante
                    legal. Eles podem mudar o que você vê ou encerrar quando quiserem.{' '}
                    <button
                      type="button"
                      className="btn btn-soft"
                      style={{ minHeight: 44 }}
                      onClick={() => void agir(() => api.instAviso(v.id), 'Aviso lido.')}
                    >
                      Li o aviso
                    </button>
                  </Aviso>
                ) : null}
                {ehPedagogico && v.meu && v.situacao === 'ativo' && !v.vencido ? (
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {CAIXAS.filter((i) => v[i.campo]).map((i) => (
                      <button
                        key={i.item}
                        type="button"
                        className="btn btn-soft"
                        style={{ minHeight: 44 }}
                        onClick={() => void ler(v, i.item)}
                      >
                        {i.rotulo}
                      </button>
                    ))}
                  </div>
                ) : null}
                {aberto && aberto.id === v.id ? (
                  <Leitura item={aberto.item} dados={aberto.dados} />
                ) : null}
                {encerrando === v.id ? (
                  <Motivo
                    rotulo="Por que você quer encerrar?"
                    botao="Confirmar o encerramento"
                    aoEnviar={(m) =>
                      void agir(() => api.instEncerrar(v.id, m), 'Vínculo encerrado.')
                    }
                    aoCancelar={() => setEncerrando(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ minHeight: 44 }}
                    onClick={() => setEncerrando(v.id)}
                  >
                    Encerrar o acesso
                  </button>
                )}
              </li>
            ))}
          </ul>
          {ehAdmin || ehPedagogico ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 44 }}
              disabled={marcados.length === 0}
              onClick={() => void agir(() => api.instRenovar(marcados), 'Vínculos renovados.')}
            >
              Renovar os marcados
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

export function AcompanhamentoInstituicao({ perfil }: { perfil: string }) {
  const [versao, setVersao] = useState(0);
  const ehAdmin = perfil === 'admin';
  const ehPedagogico = perfil === 'pedagogico';
  return (
    <>
      <Titulo
        olho="Apoio"
        titulo="Pedidos de acompanhamento"
        sub="Alunos que pediram o acompanhamento da instituição, pelo código. O aluno controla o que cada pessoa vê."
      />
      <Aviso tipo="info">
        Ninguém vê nada até o aluno liberar, e o aluno pode encerrar quando quiser. A instituição
        também pode encerrar, com um motivo registrado.
      </Aviso>
      {ehAdmin ? <CodigoDoAdmin /> : null}
      {ehPedagogico ? <FilaDoPedagogico aoMudar={() => setVersao(versao + 1)} /> : null}
      <Vinculos key={versao} ehAdmin={ehAdmin} ehPedagogico={ehPedagogico} />
    </>
  );
}
