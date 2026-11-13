import type { ItemAcompanhado } from '../api';
import { blocoDe } from '../blocos';
import { paraTexto, parteDoDia, relativo } from '../datas';
import { nomeDoTipo } from '../eventos';
import { Icone, type NomeIcone } from '../icones';
import { Vazio } from './Basicos';

// Leitura de UM item de UM aluno, só leitura. Usada por quem acompanha (e-mail ou código da instituição) e pelo representante legal.
// Tempo concreto: prazo e dia em palavra e data, parte do dia com nome e ícone, duração em bloco. Texto literal, sem pressão.
// Não há lista de alunos, média, ordem por dificuldade nem comparação. A dificuldade é a percepção do aluno, não diagnóstico.
const texto = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const ehData = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
// Palavra e data (hoje, amanhã, em 3 dias), nunca só o número
const prazo = (v: unknown) =>
  ehData(v)
    ? `${relativo(v.slice(0, 10), paraTexto(new Date()))} (${v.slice(8, 10)}/${v.slice(5, 7)})`
    : '—';
const dia = (v: unknown) => (ehData(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : texto(v));
const PARTES: Record<string, { nome: string; icone: NomeIcone }> = {
  manha: { nome: 'Manhã', icone: 'sun' },
  tarde: { nome: 'Tarde', icone: 'sunset' },
  noite: { nome: 'Noite', icone: 'moon' },
};

function Compromisso({ d }: { d: Record<string, unknown> }) {
  const hora = typeof d.hora_inicio === 'string' ? d.hora_inicio : null;
  const parte = PARTES[parteDoDia(hora) ?? ''];
  const minutos = typeof d.minutos === 'number' ? d.minutos : null;
  return (
    <>
      <strong>{texto(d.titulo)}</strong> ({nomeDoTipo(d.tipo as never)}). {prazo(d.dia)}.{' '}
      {parte ? (
        <span>
          <Icone nome={parte.icone} /> {parte.nome}
          {hora ? <small> ({hora})</small> : null}.{' '}
        </span>
      ) : null}
      {minutos ? (
        <span>
          Duração: {blocoDe(minutos).nome} <small>({minutos} min)</small>.
        </span>
      ) : null}
    </>
  );
}

export function LeituraAluno({
  item,
  dados,
}: {
  item: ItemAcompanhado;
  dados: Record<string, unknown>[];
}) {
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
          {item === 'agenda' ? <Compromisso d={d} /> : null}
          {item === 'disciplinas' ? <strong>{texto(d.nome)}</strong> : null}
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
