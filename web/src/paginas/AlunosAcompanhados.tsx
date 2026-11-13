import { useState } from 'react';
import { type AlunoAcompanhado, api, ErroApi, type ItemAcompanhado } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Vazio } from '../componentes/Basicos';
import { useCarregar } from '../componentes/useCarregar';
import { paraTexto, relativo } from '../datas';

// L22a-2: o que a pessoa acompanha. Um aluno por vez, um item por vez, só o que foi liberado.
// Não há lista com valores de vários alunos, média, ordem por dificuldade nem comparação. Não é diagnóstico.
const ITENS: { item: ItemAcompanhado; rotulo: string; campo: keyof AlunoAcompanhado }[] = [
  { item: 'tarefas', rotulo: 'Tarefas e plano', campo: 'ver_tarefas' },
  { item: 'dificuldade', rotulo: 'Nível de dificuldade', campo: 'ver_dificuldade' },
  { item: 'notas', rotulo: 'Notas', campo: 'ver_notas' },
  { item: 'mensagens', rotulo: 'Mensagens', campo: 'ver_mensagens' },
];
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

function Linhas({ item, dados }: { item: ItemAcompanhado; dados: Record<string, unknown>[] }) {
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

export function AlunosAcompanhados() {
  const { dados, recarregar } = useCarregar(api.pessoaAcompanhando);
  const [aberto, setAberto] = useState<{
    id: string;
    item: ItemAcompanhado;
    dados: Record<string, unknown>[];
  } | null>(null);
  const [aviso, setAviso] = useState('');

  async function ver(a: AlunoAcompanhado, item: ItemAcompanhado) {
    setAviso('');
    try {
      const r = await api.pessoaAcompanhandoLer(a.acompanhamento_id, item);
      setAberto({ id: a.acompanhamento_id, item, dados: r.dados });
    } catch (x) {
      setAberto(null);
      setAviso(x instanceof ErroApi ? x.message : 'Não foi possível abrir.');
    }
  }
  async function li(a: AlunoAcompanhado) {
    await api.pessoaAcompanhandoAviso(a.acompanhamento_id).catch(() => undefined);
    await recarregar();
  }

  const alunos = dados?.alunos ?? [];
  // Seção opcional: sem acompanhados (ou sem conseguir carregar) ela não aparece e não atrapalha a escolha do espaço
  if (alunos.length === 0) return null;
  return (
    <section className="stack" aria-label="Alunos que você acompanha">
      <h2 style={{ fontSize: 18 }}>Alunos que você acompanha</h2>
      <p className="muted small">
        Você vê só o que o aluno liberou, um aluno por vez. Cada leitura fica registrada.
      </p>
      {aviso ? <Aviso tipo="warn">{aviso}</Aviso> : null}
      <ul className="stack" style={{ padding: 0, listStyle: 'none' }}>
        {alunos.map((a) => (
          <li key={a.acompanhamento_id} className="card stack">
            <h3 style={{ fontSize: 16 }}>{a.aluno_nome}</h3>
            {a.aviso_pendente ? (
              <Aviso tipo="info">
                Quem controla o acesso é o aluno e, se ele for menor de idade, o representante
                legal. Eles podem mudar o que você vê ou encerrar quando quiserem.{' '}
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 44 }}
                  onClick={() => void li(a)}
                >
                  Li o aviso
                </button>
              </Aviso>
            ) : null}
            {a.situacao === 'aguardando_representante' ? (
              <p className="small">
                Esperando o representante legal aprovar. Até lá, nada é liberado.
              </p>
            ) : a.vencido ? (
              <p className="small">
                O acesso venceu. Peça ao aluno ou ao representante para renovar.
              </p>
            ) : (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {ITENS.filter((i) => a[i.campo]).map((i) => (
                  <button
                    key={i.item}
                    type="button"
                    className="btn btn-soft"
                    style={{ minHeight: 44 }}
                    onClick={() => void ver(a, i.item)}
                  >
                    {i.rotulo}
                  </button>
                ))}
                {ITENS.every((i) => !a[i.campo]) ? (
                  <p className="small">O aluno ainda não liberou nenhum item.</p>
                ) : null}
              </div>
            )}
            {aberto && aberto.id === a.acompanhamento_id ? (
              <Linhas item={aberto.item} dados={aberto.dados} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
