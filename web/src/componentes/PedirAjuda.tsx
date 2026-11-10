import { type FormEvent, useEffect, useState } from 'react';
import { api, type DestinoProfessor, ErroApi, type Microetapa, type MotivoAjuda } from '../api';
import { texto } from '../linguagem-curta';
import { Aviso } from './Aviso';
import { Carregando } from './Basicos';
import { Campo } from './Campo';

// Pedido de ajuda (L17): o aluno escolhe para quem (professor da turma ou equipe pedagógica / NAPNE)
// e o que aconteceu. Explicar mais é opcional. Sem pressa, sem contagem e sem cobrança.
export const FRASE_MOTIVO: Record<MotivoAjuda, string> = {
  nao_entendi: 'Não entendi',
  nao_sei_comecar: 'Não sei por onde começar',
  preciso_tempo: 'Preciso de mais tempo',
  outro: 'Outro motivo',
};
const MOTIVOS = Object.keys(FRASE_MOTIVO) as MotivoAjuda[];
const EQUIPE = 'equipe';
const chaveDe = (p: DestinoProfessor) => `${p.professor_id}|${p.turma_id}|${p.disciplina_id}`;

type Props = {
  tarefa?: { id: string; titulo: string; microetapas: Microetapa[] };
  etapaInicial?: string;
  aoFechar: () => void;
};

export function PedirAjuda({ tarefa, etapaInicial, aoFechar }: Props) {
  const [destinos, setDestinos] = useState<{
    professores: DestinoProfessor[];
    equipe_pedagogica: boolean;
  } | null>(null);
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState<MotivoAjuda | ''>('');
  const [etapa, setEtapa] = useState(etapaInicial ?? '');
  const [explicacao, setExplicacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .destinosAjuda()
      .then(setDestinos)
      .catch(() => setErro('Não foi possível carregar para quem pedir ajuda. Tente de novo.'));
  }, []);

  const nomeDoDestino = (chave: string) => {
    if (chave === EQUIPE) return 'a equipe pedagógica';
    const p = destinos?.professores.find((x) => chaveDe(x) === chave);
    return p ? `${p.professor_nome} (${p.disciplina_nome})` : '';
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!destino) return setErro('Escolha para quem pedir ajuda.');
    if (!motivo) return setErro('Escolha o que aconteceu.');
    const p = destinos?.professores.find((x) => chaveDe(x) === destino);
    const comum = {
      motivo,
      ...(explicacao.trim() ? { texto: explicacao.trim() } : {}),
      ...(tarefa ? { tarefa_id: tarefa.id } : {}),
      ...(tarefa && etapa ? { microetapa_id: etapa } : {}),
    };
    setEnviando(true);
    try {
      await api.pedirAjuda(
        p
          ? {
              ...comum,
              destino: 'professor',
              professor_id: p.professor_id,
              turma_id: p.turma_id,
              disciplina_id: p.disciplina_id,
            }
          : { ...comum, destino: 'pedagogico' },
      );
      setEnviado(nomeDoDestino(destino));
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado)
    return (
      <div className="card slim pedir-ajuda">
        <Aviso>
          Pedido enviado para {enviado}. A resposta aparece no sino Mensagens, no topo da tela.
        </Aviso>
        <button type="button" className="btn btn-outline btn-sm" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    );

  const semDestino = destinos && destinos.professores.length === 0 && !destinos.equipe_pedagogica;

  return (
    <form className="card slim pedir-ajuda" onSubmit={enviar} aria-labelledby="pedir-ajuda-titulo">
      <h3 id="pedir-ajuda-titulo">{texto('ajudaTitulo')}</h3>
      {tarefa ? <p className="small">Atividade: {tarefa.titulo}</p> : null}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {!destinos && !erro ? <Carregando /> : null}
      {semDestino ? (
        <Aviso>
          Ainda não há professor nem equipe pedagógica ligados à sua turma no sistema. Fale com a
          escola.
        </Aviso>
      ) : null}
      {destinos && !semDestino ? (
        <>
          <fieldset className="blocos">
            <legend>Para quem?</legend>
            {destinos.professores.map((p) => (
              <button
                key={chaveDe(p)}
                type="button"
                aria-pressed={destino === chaveDe(p)}
                className={`btn btn-sm btn-bloco ${destino === chaveDe(p) ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setDestino(chaveDe(p))}
              >
                {p.professor_nome}
                <small>
                  {p.disciplina_nome} · {p.turma_nome}
                </small>
              </button>
            ))}
            {destinos.equipe_pedagogica ? (
              <button
                type="button"
                aria-pressed={destino === EQUIPE}
                className={`btn btn-sm btn-bloco ${destino === EQUIPE ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setDestino(EQUIPE)}
              >
                Equipe pedagógica
                <small>NAPNE</small>
              </button>
            ) : null}
          </fieldset>
          <fieldset className="blocos">
            <legend>O que aconteceu?</legend>
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={motivo === m}
                className={`btn btn-sm btn-bloco ${motivo === m ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setMotivo(m)}
              >
                {FRASE_MOTIVO[m]}
              </button>
            ))}
          </fieldset>
          {tarefa?.microetapas.length ? (
            <Campo rotulo="Sobre qual etapa? (opcional)">
              {({ id }) => (
                <select id={id} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                  <option value="">Nenhuma etapa em especial</option>
                  {tarefa.microetapas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.texto}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          ) : null}
          <Campo rotulo="Quer explicar mais? (opcional)" dica="Até 300 letras. Sem links.">
            {({ id, descricao }) => (
              <textarea
                id={id}
                aria-describedby={descricao}
                rows={3}
                maxLength={300}
                value={explicacao}
                onChange={(e) => setExplicacao(e.target.value)}
              />
            )}
          </Campo>
          <div className="chip-row mt-sm">
            <button type="submit" className="btn btn-primary btn-sm" disabled={enviando}>
              Enviar pedido
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={aoFechar}>
              Cancelar
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
}

// Professor ou Pedagógico marca o pedido como atendido, com resposta curta opcional (dentro do sino)
export function AtenderAjuda({ id }: { id: string }) {
  const [resposta, setResposta] = useState('');
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState('');
  if (feito)
    return <p role="status">Pedido marcado como atendido. O aluno vê no sino Mensagens.</p>;
  return (
    <form
      className="atender-ajuda"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro('');
        try {
          await api.atenderAjuda(id, resposta.trim() || undefined);
          setFeito(true);
        } catch (x) {
          setErro(x instanceof ErroApi ? x.message : 'Não foi possível concluir. Tente de novo.');
        }
      }}
    >
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      <Campo rotulo="Resposta para o aluno (opcional)" dica="Até 300 letras. Sem links.">
        {({ id: idCampo, descricao }) => (
          <textarea
            id={idCampo}
            aria-describedby={descricao}
            rows={2}
            maxLength={300}
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
          />
        )}
      </Campo>
      <button type="submit" className="btn btn-outline btn-sm">
        Marcar como atendido
      </button>
    </form>
  );
}
