import { useState } from 'react';
import { api, type DificuldadesDoAluno, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { NotaDeDificuldade } from '../componentes/Dificuldade';
import { useCarregar } from '../componentes/useCarregar';
import { formatar } from '../datas';

// Acompanhamento (20d): o Apoio Pedagógico/NAPNE vê a dificuldade de 0 a 10 que o aluno marcou, UM aluno por vez.
// A nota é a percepção do aluno, pedida pelo NAPNE para ajudar o aluno. Não é prova, não é diagnóstico.
// Não há lista com notas de vários alunos, média, ordem por dificuldade nem comparação. Cada leitura fica registrada.
export function Acompanhamento() {
  const { dados, erro } = useCarregar(api.apoioAlunos);
  const [aberto, setAberto] = useState<DificuldadesDoAluno | null>(null);
  const [aviso, setAviso] = useState('');
  const [abrindo, setAbrindo] = useState(false);

  async function abrir(id: string) {
    setAviso('');
    setAbrindo(true);
    try {
      setAberto(await api.apoioDificuldades(id));
    } catch (x) {
      setAberto(null);
      setAviso(x instanceof ErroApi ? x.message : 'Não foi possível abrir este aluno.');
    } finally {
      setAbrindo(false);
    }
  }

  const alunos = dados?.alunos ?? [];
  return (
    <>
      <Titulo
        olho="Apoio pedagógico"
        titulo="Acompanhamento"
        sub="A dificuldade que cada aluno marcou, para ajudar o aluno. Um aluno por vez."
      />
      <Aviso tipo="info">
        A nota de dificuldade é a percepção do aluno. Ela não é nota de prova nem diagnóstico, e não
        serve para comparar alunos. Cada vez que você abre um aluno, o sistema registra a leitura.
      </Aviso>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {aviso ? <Aviso tipo="warn">{aviso}</Aviso> : null}

      <section className="card mt" aria-labelledby="ac-alunos">
        <h2 id="ac-alunos">Escolha um aluno</h2>
        {dados && alunos.length === 0 ? <Vazio>Não há alunos ativos nesta escola.</Vazio> : null}
        <ul className="cal-lista">
          {alunos.map((a) => (
            <li key={a.id} className="cal-evento">
              <div className="cal-parte">
                <strong>{a.nome}</strong>
              </div>
              <div className="cal-acoes">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={abrindo}
                  aria-label={`Ver as dificuldades de ${a.nome}`}
                  onClick={() => void abrir(a.id)}
                >
                  Ver dificuldades
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {aberto ? (
        <section className="card mt" aria-labelledby="ac-aluno" aria-live="polite">
          <h2 id="ac-aluno">{aberto.aluno.nome}</h2>
          <h3>Disciplinas</h3>
          {aberto.disciplinas.length === 0 ? (
            <p className="muted">O aluno ainda não marcou dificuldade em nenhuma disciplina.</p>
          ) : (
            <ul className="cal-lista">
              {aberto.disciplinas.map((d) => (
                <li key={d.id} className="cal-evento">
                  <div className="cal-parte">
                    <strong>{d.nome}</strong>
                  </div>
                  <NotaDeDificuldade valor={d.dificuldade} />
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-sm">Atividades</h3>
          {aberto.tarefas.length === 0 ? (
            <p className="muted">O aluno ainda não marcou dificuldade em nenhuma atividade.</p>
          ) : (
            <ul className="cal-lista">
              {aberto.tarefas.map((t) => (
                <li key={t.id} className="cal-evento">
                  <div className="cal-parte">
                    <strong>{t.titulo}</strong>
                    <div className="small muted">
                      {t.disciplina ? `${t.disciplina} · ` : ''}
                      {t.prazo ? `prazo ${formatar(t.prazo)}` : 'sem prazo'}
                      {t.situacao === 'concluida' ? ' · concluída' : ''}
                    </div>
                  </div>
                  <NotaDeDificuldade valor={t.dificuldade} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
