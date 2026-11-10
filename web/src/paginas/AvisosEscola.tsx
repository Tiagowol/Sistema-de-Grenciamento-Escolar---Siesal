import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi, type Perfil } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Pill, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { paraTexto } from '../datas';

const LIMITE = 300;

// Avisos curtos (L16): o Pedagógico escolhe uma turma, o Admin fala com a escola inteira.
// Só leitura para quem recebe: sem resposta, sem link, sem anexo. Nada se apaga: o aviso é desativado.
export function AvisosEscola({ perfil }: { perfil: Perfil }) {
  const pedagogico = perfil === 'pedagogico';
  const publicados = useCarregar(api.avisosPublicados);
  const turmas = useCarregar(async () => (pedagogico ? api.turmasParaAviso() : { turmas: [] }));
  const [texto, setTexto] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const hoje = paraTexto(new Date());

  async function agir(acao: () => Promise<unknown>, feito: string) {
    setErro('');
    setOk('');
    try {
      await acao();
      setOk(feito);
      await publicados.recarregar();
      return true;
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível concluir. Tente de novo.');
      return false;
    }
  }

  async function publicar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return setErro('Escreva o aviso.');
    if (pedagogico && !turmaId) return setErro('Escolha a turma do aviso.');
    const feito = await agir(
      () => api.publicarAviso(pedagogico ? { texto, turma_id: turmaId } : { texto }),
      'Aviso publicado.',
    );
    if (feito) setTexto('');
  }

  return (
    <>
      <Titulo
        olho="Avisos"
        titulo="Avisos da escola"
        sub={
          pedagogico
            ? 'Escreva um aviso curto para uma turma. Alunos e responsáveis da turma recebem no sino Mensagens.'
            : 'Escreva um aviso curto para a escola inteira. Alunos e responsáveis recebem no sino Mensagens.'
        }
      />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}

      <form className="card" onSubmit={publicar} style={{ marginBottom: 18 }}>
        <h2>Novo aviso</h2>
        <p className="muted small">
          O aviso é só de leitura: quem recebe não responde. Não use links nem anexos.
        </p>
        {pedagogico ? (
          <Campo rotulo="Turma">
            {({ id, descricao }) => (
              <select
                id={id}
                aria-describedby={descricao}
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
              >
                <option value="">Escolha a turma</option>
                {(turmas.dados?.turmas ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.ano_letivo})
                  </option>
                ))}
              </select>
            )}
          </Campo>
        ) : null}
        <Campo
          rotulo="Texto do aviso"
          dica={`${texto.length} de ${LIMITE} caracteres. Escreva de forma curta e direta.`}
          cheio
        >
          {({ id, descricao }) => (
            <textarea
              id={id}
              aria-describedby={descricao}
              rows={3}
              maxLength={LIMITE}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          )}
        </Campo>
        <button type="submit" className="btn btn-primary">
          Publicar aviso
        </button>
      </form>

      <section className="card" aria-label="Avisos publicados">
        <h2>Avisos publicados</h2>
        {publicados.carregando ? (
          <Carregando />
        ) : publicados.erro ? (
          <Aviso tipo="warn">{publicados.erro}</Aviso>
        ) : (publicados.dados?.avisos ?? []).length === 0 ? (
          <Vazio>Nenhum aviso publicado ainda.</Vazio>
        ) : (
          <ul className="sino-lista">
            {(publicados.dados?.avisos ?? []).map((a) => (
              <li key={a.id} className="sino-item">
                <h3>
                  {a.escopo === 'turma' ? `Turma ${a.turma_nome ?? ''}` : 'Escola inteira'}{' '}
                  <Pill tom={a.ativo ? 'teal' : 'blue'}>{a.ativo ? 'Ativo' : 'Desativado'}</Pill>
                </h3>
                <blockquote>{a.texto}</blockquote>
                <p>Publicado por {a.autor_nome}</p>
                <div className="sino-data">
                  <TempoVisual prazo={a.dia} hoje={hoje} passado />
                </div>
                {a.ativo ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      agir(() => api.desativarAviso(a.id), 'Aviso desativado. Ele não é apagado.')
                    }
                  >
                    Desativar aviso
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
