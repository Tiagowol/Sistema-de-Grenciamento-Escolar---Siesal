import { api } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Pill, Titulo, Vazio } from '../componentes/Basicos';
import { useCarregar } from '../componentes/useCarregar';

// Sem vermelho de alarme: o prazo que passou usa a mesma cor calma dos outros avisos (a palavra diz o estado)
const TIPOS: Record<string, { nome: string; tom: 'amber' | 'blue' | 'teal' }> = {
  atrasada: { nome: 'Prazo passou', tom: 'blue' },
  prazo_hoje: { nome: 'Prazo hoje', tom: 'amber' },
  prazo_amanha: { nome: 'Prazo amanhã', tom: 'blue' },
  evento_hoje: { nome: 'Compromisso', tom: 'teal' },
  sistema: { nome: 'Aviso', tom: 'blue' },
};

// Avisos dentro do sistema. Push e e-mail ficam para a Parte 2.
export function Avisos({ aoMudar }: { aoMudar: () => void }) {
  const { dados, erro, carregando, recarregar } = useCarregar(api.notificacoes);
  const agir = async (f: () => Promise<unknown>) => {
    await f();
    await recarregar();
    aoMudar();
  };
  return (
    <>
      <Titulo
        olho="Lembretes"
        titulo="Avisos"
        sub="Lembretes de prazos e compromissos, em linguagem simples."
        acoes={
          <button
            type="button"
            className="btn btn-outline"
            disabled={!dados?.nao_lidas}
            onClick={() => void agir(api.lerTodas)}
          >
            Marcar todos como lidos
          </button>
        }
      />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <div className="card">
        {dados?.notificacoes.length ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Lista de avisos">
            {dados.notificacoes.map((n) => {
              const t = TIPOS[n.tipo] ?? TIPOS.sistema;
              return (
                <li key={n.id} className="task-row" style={{ opacity: n.lida ? 0.75 : 1 }}>
                  <div className="task-data">
                    <div className="flex" style={{ flexWrap: 'wrap', gap: 7 }}>
                      <Pill tom={t?.tom ?? 'blue'}>{t?.nome ?? 'Aviso'}</Pill>
                      {n.lida ? (
                        <span className="muted small">Lido</span>
                      ) : (
                        <strong className="small">Novo</strong>
                      )}
                    </div>
                    <div style={{ marginTop: 6 }}>{n.titulo}</div>
                    <div className="task-meta">{n.quando}</div>
                  </div>
                  {n.lida ? null : (
                    <div className="task-actions">
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => void agir(() => api.lerNotificacao(n.id))}
                      >
                        Marcar como lido<span className="sr-only">: {n.titulo}</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : carregando ? (
          <Carregando />
        ) : erro ? null : (
          <Vazio>Sem avisos por enquanto. Quando houver prazo perto, ele aparece aqui.</Vazio>
        )}
      </div>
    </>
  );
}
