import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type NotaOficial, type PedidoRevisao } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import {
  CampoTexto,
  EstadoDoPedido,
  FormRevisao,
  fraseDoEstado,
  Historico,
  nota1,
  ROTULO_PERFIL,
  ValorDaNota,
} from '../componentes/NotasComuns';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto } from '../datas';
import { Icone } from '../icones';

const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);

// Tela do Professor: lançar notas por turma e disciplina, revisar o que lançou e responder pedidos de revisão.
// Só aparecem as turmas e disciplinas do vínculo do professor. Sem ranking e sem comparação.
export function NotasProfessor() {
  const turmas = useCarregar(api.turmasDoProfessor);
  const notas = useCarregar(api.notasOficiais);
  const pedidos = useCarregar(api.pedidosRevisao);
  const hoje = paraTexto(new Date());

  const [escolha, setEscolha] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState(hoje);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  // Qual formulário está aberto: revisão de uma nota, revisão ligada a um pedido ou "manter"
  const [aberto, setAberto] = useState<{ tipo: 'nota' | 'pedido' | 'manter'; id: string } | null>(
    null,
  );
  const [motivoManter, setMotivoManter] = useState('');

  const lista = turmas.dados?.turmas ?? [];
  const atual = lista.find((t) => `${t.turma_id}|${t.disciplina_id}` === escolha) ?? lista[0];
  const chave = atual ? `${atual.turma_id}|${atual.disciplina_id}` : '';
  const notasDaTurma = (notas.dados?.notas ?? []).filter(
    (n) => atual && n.turma_id === atual.turma_id && n.disciplina_id === atual.disciplina_id,
  );
  const todosPedidos = pedidos.dados?.pedidos ?? [];
  const abertos = todosPedidos.filter((p) => p.estado === 'aberto');
  const respondidos = todosPedidos.filter((p) => p.estado !== 'aberto');

  async function recarregar() {
    await Promise.all([notas.recarregar(), pedidos.recarregar()]);
  }
  async function agir(acao: () => Promise<unknown>, feito: string, padrao: string) {
    setErro('');
    setOk('');
    try {
      await acao();
      setOk(feito);
      setAberto(null);
      setMotivoManter('');
      await recarregar();
      return true;
    } catch (x) {
      setErro(mensagem(x, padrao));
      return false;
    }
  }

  async function lancar(e: FormEvent) {
    e.preventDefault();
    const n = Number(valor.replace(',', '.'));
    if (!atual || !alunoId || valor === '' || Number.isNaN(n) || n < 0 || n > 10 || !dia) {
      setErro('Escolha o aluno e informe uma nota de 0 a 10 e a data.');
      setOk('');
      return;
    }
    const feito = await agir(
      () =>
        api.lancarNotaOficial({
          aluno_id: alunoId,
          turma_id: atual.turma_id,
          disciplina_id: atual.disciplina_id,
          descricao: descricao.trim(),
          valor: n,
          dia,
        }),
      'Nota lançada.',
      'Não foi possível lançar a nota.',
    );
    if (feito) {
      setValor('');
      setDescricao('');
    }
  }

  const revisar = (notaId: string, pedidoId?: string) => async (v: number, motivo: string) => {
    await agir(
      () =>
        api.revisarNota(notaId, { valor: v, motivo, ...(pedidoId ? { pedido_id: pedidoId } : {}) }),
      pedidoId
        ? 'Nota revisada e pedido respondido.'
        : 'Nota revisada. A versão anterior continua registrada.',
      'Não foi possível revisar a nota.',
    );
  };

  function cartaoPedido(p: PedidoRevisao) {
    const emRevisao = aberto?.tipo === 'pedido' && aberto.id === p.id;
    const emManter = aberto?.tipo === 'manter' && aberto.id === p.id;
    return (
      <li key={p.id}>
        <div className="lista-adm-texto">
          <strong>{p.aluno_nome}</strong> · {p.disciplina_nome} · {p.turma_nome}
          <div className="small muted">
            Nota {nota1(p.valor_atual)}
            {p.nota_descricao ? ` (${p.nota_descricao})` : ''} · avaliação de {formatar(p.nota_dia)}
          </div>
          <p className="mt-sm">
            <strong>
              {p.pedinte_nome} ({ROTULO_PERFIL[p.perfil_pedinte]})
            </strong>{' '}
            pediu revisão em {formatar(p.criado_em)}:
            <br />“{p.texto}”
          </p>
          <div className="small muted">
            Pedir revisão não obriga a mudar a nota. A decisão é sua.
          </div>
          {p.estado !== 'aberto' ? (
            <div className="mt-sm">
              <EstadoDoPedido estado={p.estado} />{' '}
              <span className="small">
                {fraseDoEstado(p.estado)}
                {p.respondido_em ? ` Em ${formatar(p.respondido_em)}.` : ''}
              </span>
              {p.motivo_resposta ? (
                <div className="small muted">Motivo: {p.motivo_resposta}</div>
              ) : null}
            </div>
          ) : null}
          {emRevisao ? (
            <FormRevisao
              valorAtual={p.valor_atual}
              aoEnviar={revisar(p.nota_id, p.id)}
              aoCancelar={() => setAberto(null)}
            />
          ) : null}
          {emManter ? (
            <form
              className="form-inline"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!motivoManter.trim()) {
                  setOk('');
                  setErro('Escreva o motivo para manter a nota.');
                  return;
                }
                void agir(
                  () => api.manterNota(p.id, motivoManter.trim()),
                  'Pedido respondido: nota mantida.',
                  'Não foi possível responder.',
                );
              }}
            >
              <CampoTexto
                rotulo="Motivo para manter a nota"
                valor={motivoManter}
                aoMudar={setMotivoManter}
                limite={300}
              />
              <div className="blocos">
                <button type="submit" className="btn btn-primary">
                  Responder: manter a nota
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setAberto(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}
        </div>
        {p.pode_responder && !emRevisao && !emManter ? (
          <div className="blocos">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAberto({ tipo: 'pedido', id: p.id })}
            >
              Revisar a nota<span className="sr-only"> de {p.aluno_nome}</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setMotivoManter('');
                setAberto({ tipo: 'manter', id: p.id });
              }}
            >
              Manter a nota<span className="sr-only"> de {p.aluno_nome}</span>
            </button>
          </div>
        ) : !p.pode_responder && p.estado === 'aberto' ? (
          <span className="small muted">Outro professor lançou esta nota. Só ele responde.</span>
        ) : null}
      </li>
    );
  }

  function cartaoNota(n: NotaOficial) {
    const emRevisao = aberto?.tipo === 'nota' && aberto.id === n.id;
    return (
      <li key={n.id}>
        <div className="lista-adm-texto">
          <strong>{n.aluno_nome}</strong>
          {n.descricao ? ` · ${n.descricao}` : ''}
          <div className="small muted">
            <TempoVisual prazo={n.dia} hoje={hoje} passado />
          </div>
          <ValorDaNota valor={n.valor} rotulo={`Nota de ${n.aluno_nome}`} />
          <div className="small muted">
            {n.versao > 1
              ? `Versão ${n.versao}, revisada em ${formatar(n.atualizada_em)}.`
              : `Lançada em ${formatar(n.atualizada_em)}.`}
          </div>
          {n.versoes ? <Historico versoes={n.versoes} /> : null}
          {emRevisao ? (
            <FormRevisao
              valorAtual={n.valor}
              aoEnviar={revisar(n.id)}
              aoCancelar={() => setAberto(null)}
            />
          ) : null}
        </div>
        {n.pode_revisar && !emRevisao ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setAberto({ tipo: 'nota', id: n.id })}
          >
            Revisar<span className="sr-only"> nota de {n.aluno_nome}</span>
          </button>
        ) : null}
      </li>
    );
  }

  return (
    <div className="pag-notas">
      <Titulo
        olho="Professor"
        titulo="Notas da turma"
        sub="Lance notas nas turmas e disciplinas em que você leciona. Uma nota nunca é apagada: para mudar, faça uma revisão com motivo."
      />
      {turmas.erro ? <Aviso tipo="warn">{turmas.erro}</Aviso> : null}
      {notas.erro ? <Aviso tipo="warn">{notas.erro}</Aviso> : null}
      {pedidos.erro ? <Aviso tipo="warn">{pedidos.erro}</Aviso> : null}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}

      <section className="card mt" aria-labelledby="h-pedidos">
        <div className="card-head">
          <h2 id="h-pedidos">Pedidos de revisão abertos</h2>
        </div>
        {pedidos.carregando ? (
          <Carregando />
        ) : abertos.length === 0 ? (
          <Vazio>Nenhum pedido aberto nas suas turmas.</Vazio>
        ) : (
          <ul className="lista-adm">{abertos.map(cartaoPedido)}</ul>
        )}
        {respondidos.length ? (
          <details className="historico">
            <summary>Pedidos já respondidos ({respondidos.length})</summary>
            <ul className="lista-adm mt-sm">{respondidos.map(cartaoPedido)}</ul>
          </details>
        ) : null}
      </section>

      {turmas.dados && lista.length === 0 ? (
        <Aviso>
          Você ainda não está vinculado a nenhuma turma e disciplina. A administração faz o vínculo.
        </Aviso>
      ) : null}

      {atual ? (
        <>
          <form className="card mt" onSubmit={lancar} noValidate aria-labelledby="h-lancar">
            <div className="card-head">
              <h2 id="h-lancar">Lançar nota</h2>
            </div>
            <div className="form-grid">
              <Campo rotulo="Turma e disciplina" cheio>
                {({ id }) => (
                  <select
                    id={id}
                    value={chave}
                    onChange={(e) => {
                      setEscolha(e.target.value);
                      setAlunoId('');
                    }}
                  >
                    {lista.map((t) => (
                      <option
                        key={`${t.turma_id}|${t.disciplina_id}`}
                        value={`${t.turma_id}|${t.disciplina_id}`}
                      >
                        {t.turma_nome} · {t.disciplina_nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Aluno">
                {({ id }) => (
                  <select id={id} value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
                    <option value="">Escolha…</option>
                    {atual.alunos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Descrição (opcional)" dica="Exemplo: Prova 1">
                {({ id, descricao: d }) => (
                  <input
                    id={id}
                    aria-describedby={d}
                    value={descricao}
                    maxLength={120}
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
              <Campo rotulo="Data da avaliação">
                {({ id }) => (
                  <input id={id} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
                )}
              </Campo>
            </div>
            <button type="submit" className="btn btn-primary mt-sm">
              <Icone nome="plus" /> Lançar nota
            </button>
          </form>

          <section className="card mt" aria-labelledby="h-lancadas">
            <div className="card-head">
              <h2 id="h-lancadas">
                Notas lançadas · {atual.turma_nome} · {atual.disciplina_nome}
              </h2>
            </div>
            {notas.carregando ? (
              <Carregando />
            ) : notasDaTurma.length === 0 ? (
              <Vazio>Nenhuma nota lançada nesta turma e disciplina.</Vazio>
            ) : (
              <ul className="lista-adm">{notasDaTurma.map(cartaoNota)}</ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
