import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type EventoAuditoriaEscola } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo } from '../componentes/Basicos';
import { parteDoDia } from '../datas';

// L22e: Auditoria da escola para o Admin. Só leitura; só ações administrativas e entradas da equipe.
// Nada da vida do aluno aparece (a API já filtra). Tempo concreto: palavra, dia/mês e parte do dia; a hora é detalhe.
const PARTE: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' };
const doisDigitos = (n: number) => String(n).padStart(2, '0');
const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

// Exemplo: "hoje, 14/11 · tarde (14:32)"
export function quando(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  const palavra =
    diaLocal(d) === diaLocal(agora) ? 'hoje, ' : diaLocal(d) === diaLocal(ontem) ? 'ontem, ' : '';
  const hora = `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
  const parte = parteDoDia(hora);
  return `${palavra}${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} · ${parte ? PARTE[parte] : ''} (${hora})`;
}

export function AuditoriaEscola() {
  const [eventos, setEventos] = useState<EventoAuditoriaEscola[] | null>(null);
  const [integra, setIntegra] = useState<boolean | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);

  const carregar = useCallback(async (antes?: number) => {
    setErro('');
    setBuscando(true);
    try {
      const r = await api.auditoriaEscola(antes);
      setEventos((atual) => (antes === undefined ? r.eventos : [...(atual ?? []), ...r.eventos]));
      if (antes === undefined) setIntegra(r.integra);
      setTemMais(r.tem_mais);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível abrir a auditoria.');
    }
    setBuscando(false);
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ultimo = eventos?.[eventos.length - 1];
  return (
    <>
      <Titulo
        olho="Administração"
        titulo="Auditoria"
        sub="O que foi feito na sua instituição: contas, turmas, avisos e entradas da equipe. Só leitura."
      />
      <section className="card" aria-labelledby="aud-titulo">
        <div className="card-head">
          <h2 id="aud-titulo">Últimos registros</h2>
        </div>
        <p className="muted small">
          Não aparece nada da vida dos alunos: nem tarefas, nem notas, nem entradas de alunos.
        </p>
        {integra !== null ? (
          integra ? (
            <Aviso>Cadeia íntegra: sim. Nenhum registro foi alterado.</Aviso>
          ) : (
            <Aviso tipo="warn">
              Cadeia íntegra: não. Algum registro foi alterado fora do sistema. Avise o Master.
            </Aviso>
          )
        ) : null}
        {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
        {eventos === null ? (
          erro ? null : (
            <p role="status">Carregando…</p>
          )
        ) : eventos.length === 0 ? (
          <p>Nenhum registro ainda.</p>
        ) : (
          <ul className="aud-lista" aria-label="Registros, do mais novo para o mais velho">
            {eventos.map((e) => (
              <li key={e.seq} className="aud-item">
                <strong>{e.frase}</strong>
                <br />
                <span className="small muted">
                  {e.quem} ({e.perfil}) · {quando(e.quando)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {temMais && ultimo ? (
          <div className="cal-acoes">
            <button
              type="button"
              className="btn btn-outline"
              aria-disabled={buscando}
              onClick={() => {
                // Sem `disabled`: o botão desativado perderia o foco de quem usa o teclado
                if (!buscando) void carregar(ultimo.seq);
              }}
            >
              Ver registros mais antigos
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
