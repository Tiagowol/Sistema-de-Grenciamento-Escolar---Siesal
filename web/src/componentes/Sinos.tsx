import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  api,
  apiOperacao,
  type Caixa,
  type ItemCaixa,
  type MeuDia,
  type ResumoTarefa,
} from '../api';
import { paraTexto, somarDias } from '../datas';
import { Icone, type NomeIcone } from '../icones';
import { Carregando } from './Basicos';
import { EstadoDoPedido, fraseDoEstado, nota1, ROTULO_PERFIL } from './NotasComuns';
import { AtenderAjuda, AtenderSuporte, FRASE_MOTIVO } from './PedirAjuda';
import type { Pagina } from './Shell';
import { TempoVisual } from './TempoVisual';

// Dois sinos no topo (L16), diferentes por ícone, rótulo e cor: "Mensagens" (amarelo) e "Prazos" (azul).
// A cor nunca é a única diferença. Sem vermelho e sem "atrasado" como alerta.
// Teclado: Enter ou Espaço abre, Esc fecha e o foco volta ao botão; sair do sino com Tab também fecha.
type SinoProps = {
  classe: 'mensagens' | 'prazos';
  icone: NomeIcone;
  rotulo: string;
  nome: string; // nome para o leitor de tela, com a contagem
  contagem: number;
  titulo: string;
  aoAbrir: () => void;
  children: ReactNode;
};

function Sino({ classe, icone, rotulo, nome, contagem, titulo, aoAbrir, children }: SinoProps) {
  const [aberto, setAberto] = useState(false);
  const idPainel = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAberto(false);
      botao.current?.focus();
    };
    const aoClicarFora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    // Sair do sino com Tab também fecha o painel
    const aoSairDoFoco = (e: FocusEvent) => {
      if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
    };
    const el = raiz.current;
    document.addEventListener('keydown', aoTecla);
    document.addEventListener('mousedown', aoClicarFora);
    el?.addEventListener('focusout', aoSairDoFoco);
    return () => {
      document.removeEventListener('keydown', aoTecla);
      document.removeEventListener('mousedown', aoClicarFora);
      el?.removeEventListener('focusout', aoSairDoFoco);
    };
  }, [aberto]);

  return (
    <div className={`sino sino-${classe}`} ref={raiz}>
      <button
        type="button"
        ref={botao}
        className="sino-botao"
        aria-label={nome}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        onClick={() => {
          if (!aberto) aoAbrir();
          setAberto(!aberto);
        }}
      >
        <Icone nome={icone} />
        <span className="sino-rotulo" aria-hidden="true">
          {rotulo}
        </span>
        {contagem > 0 ? (
          <span className="sino-contagem" aria-hidden="true">
            {contagem}
          </span>
        ) : null}
      </button>
      {/* Anuncia a mudança da contagem sem mover o foco */}
      <span className="sr-only" role="status">
        {nome}
      </span>
      {aberto ? (
        <section className="sino-painel" id={idPainel} aria-label={titulo}>
          <h2 className="sino-titulo">{titulo}</h2>
          {children}
        </section>
      ) : null}
    </div>
  );
}

const nomeMensagens = (n: number) =>
  `Mensagens, ${n === 0 ? 'nenhuma não vista' : n === 1 ? '1 não vista' : `${n} não vistas`}`;
const nomePrazos = (n: number) =>
  `Prazos, ${n === 0 ? 'nenhuma atividade' : n === 1 ? '1 atividade' : `${n} atividades`} para hoje ou amanhã`;

function ItemDaCaixa({
  item,
  hoje,
  ir,
}: {
  item: ItemCaixa;
  hoje: string;
  ir: (p: Pagina) => void;
}) {
  const novo = !item.visto ? <span className="sino-novo">Novo</span> : null;
  const data = (
    <div className="sino-data">
      <TempoVisual prazo={item.dia} hoje={hoje} passado />
    </div>
  );
  if (item.tipo === 'pedido_aberto') {
    return (
      <li className="sino-item">
        <h3>Pedido de revisão {novo}</h3>
        <p>
          {ROTULO_PERFIL[item.perfil_pedinte]}: {item.pedinte_nome}
        </p>
        <p>
          {item.aluno_nome} · {item.disciplina_nome} · {item.nota_descricao || 'Nota'}
        </p>
        <p>Nota atual: {nota1(item.valor_atual)} de 10</p>
        <blockquote>{item.texto}</blockquote>
        {data}
        {item.pode_responder ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => ir('notasprof')}>
            Responder
          </button>
        ) : null}
      </li>
    );
  }
  if (item.tipo === 'resposta') {
    return (
      <li className="sino-item">
        <h3>Resposta ao seu pedido {novo}</h3>
        <p>
          <EstadoDoPedido estado={item.estado} /> {fraseDoEstado(item.estado)}
        </p>
        <p>
          {item.aluno_nome} · {item.disciplina_nome} · {item.nota_descricao || 'Nota'}
        </p>
        <p>Nota atual: {nota1(item.valor_atual)} de 10</p>
        {item.estado === 'mantida' && item.motivo ? (
          <p>Motivo do professor: {item.motivo}</p>
        ) : null}
        {data}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => ir('notasoficiais')}
        >
          Ver notas oficiais
        </button>
      </li>
    );
  }
  if (item.tipo === 'suporte_aberto') {
    // Pedido de suporte (L17c): chega ao Admin e ao Pedagógico
    return (
      <li className="sino-item">
        <h3>Pedido de suporte {novo}</h3>
        <p>
          {ROTULO_PERFIL[item.autor_perfil]}: {item.autor_nome}
        </p>
        <p>Assunto: {item.assunto_rotulo}</p>
        <blockquote>{item.texto}</blockquote>
        {data}
        <AtenderSuporte id={item.id} />
      </li>
    );
  }
  if (item.tipo === 'ajuda_aberta' || item.tipo === 'ajuda_minha') {
    // Pedido de ajuda (L17): atividade e etapa só aparecem se o aluno escolheu ligar o pedido a elas
    const sobre = (
      <>
        <p>O que aconteceu: {FRASE_MOTIVO[item.motivo]}</p>
        {item.tarefa_titulo ? <p>Atividade: {item.tarefa_titulo}</p> : null}
        {item.etapa_texto ? <p>Etapa: {item.etapa_texto}</p> : null}
        {item.texto ? <blockquote>{item.texto}</blockquote> : null}
      </>
    );
    if (item.tipo === 'ajuda_aberta')
      return (
        <li className="sino-item">
          <h3>Pedido de ajuda {novo}</h3>
          <p>
            {item.aluno_nome}
            {item.turma_nome ? ` · ${item.turma_nome}` : ''}
            {item.disciplina_nome ? ` · ${item.disciplina_nome}` : ''}
          </p>
          {item.destino === 'pedagogico' ? <p>Para a equipe pedagógica</p> : null}
          {sobre}
          {data}
          <AtenderAjuda id={item.id} />
        </li>
      );
    return (
      <li className="sino-item">
        <h3>Seu pedido de ajuda {novo}</h3>
        <p>
          Para:{' '}
          {item.destino === 'pedagogico'
            ? 'equipe pedagógica'
            : `${item.professor_nome ?? 'professor'}${item.disciplina_nome ? ` (${item.disciplina_nome})` : ''}`}
        </p>
        {item.estado === 'aberto' ? (
          <p>Esperando resposta.</p>
        ) : (
          <>
            <p>Atendido por {item.atendido_por_nome ?? 'a escola'}.</p>
            {item.resposta ? <p>Resposta: {item.resposta}</p> : null}
          </>
        )}
        {sobre}
        {data}
      </li>
    );
  }
  return (
    <li className="sino-item">
      <h3>
        {item.escopo === 'turma' ? `Aviso da turma ${item.turma_nome ?? ''}` : 'Aviso da escola'}{' '}
        {novo}
      </h3>
      <blockquote>{item.texto}</blockquote>
      <p>Publicado por {item.autor_nome}</p>
      {data}
    </li>
  );
}

// Sino de mensagens: pedidos (professor), respostas e avisos curtos. Abrir a caixa marca como visto.
export function SinoMensagens({ aoIr }: { aoIr: (p: Pagina) => void }) {
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [naoVistos, setNaoVistos] = useState(0);
  const [erro, setErro] = useState(false);
  const hoje = paraTexto(new Date());

  const contar = useCallback(async () => {
    try {
      const c = await api.caixa();
      setCaixa(c);
      setNaoVistos(c.nao_vistos);
    } catch {
      // Sem caixa a contagem fica em zero; o painel avisa se for aberto
    }
  }, []);
  useEffect(() => {
    void contar();
    window.addEventListener('focus', contar);
    return () => window.removeEventListener('focus', contar);
  }, [contar]);

  async function abrir() {
    try {
      const c = await api.caixa();
      setCaixa(c); // guarda quem era "Novo" enquanto o painel está aberto
      setErro(false);
      if (c.nao_vistos > 0) await api.marcarVistos();
      setNaoVistos(0);
    } catch {
      setErro(true);
    }
  }

  return (
    <Sino
      classe="mensagens"
      icone="message"
      rotulo="Mensagens"
      nome={nomeMensagens(naoVistos)}
      contagem={naoVistos}
      titulo="Mensagens"
      aoAbrir={() => void abrir()}
    >
      {erro ? (
        <p>Não foi possível carregar as mensagens. Tente de novo.</p>
      ) : !caixa ? (
        <Carregando />
      ) : !caixa.itens || caixa.itens.length === 0 ? (
        <p>Nenhuma mensagem por enquanto.</p>
      ) : (
        <ul className="sino-lista">
          {caixa.itens.map((i) => (
            <ItemDaCaixa key={`${i.tipo}-${i.id}`} item={i} hoje={hoje} ir={aoIr} />
          ))}
        </ul>
      )}
    </Sino>
  );
}

// Quantas atividades têm prazo hoje ou amanhã (tarefas sem prazo não entram)
export function contarPrazos(d: Pick<MeuDia, 'hoje' | 'para_hoje' | 'proximas'>): number {
  const amanha = somarDias(d.hoje, 1);
  return d.para_hoje.length + d.proximas.filter((t) => t.prazo === amanha).length;
}

function GrupoDePrazos({
  titulo,
  tarefas,
  hoje,
  passado = false,
}: {
  titulo: string;
  tarefas: ResumoTarefa[];
  hoje: string;
  passado?: boolean;
}) {
  if (tarefas.length === 0) return null;
  return (
    <>
      <h3 className="sino-grupo">{titulo}</h3>
      <ul className="sino-lista">
        {tarefas.map((t) => (
          <li key={t.id} className="sino-item">
            <strong>{t.titulo}</strong>
            <p>{t.disciplina || 'Sem disciplina'}</p>
            <div className="sino-data">
              <TempoVisual prazo={t.prazo} hoje={hoje} passado={passado} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// Sino de prazos (só o aluno): atividades de hoje, de amanhã e das próximas datas
export function SinoPrazos({ aoIr }: { aoIr: (p: Pagina) => void }) {
  const [dia, setDia] = useState<MeuDia | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDia(await api.meuDia());
      setErro(false);
    } catch {
      setErro(true);
    }
  }, []);
  useEffect(() => {
    void carregar();
    window.addEventListener('focus', carregar);
    return () => window.removeEventListener('focus', carregar);
  }, [carregar]);

  const hoje = dia?.hoje ?? paraTexto(new Date());
  const amanha = somarDias(hoje, 1);
  const comPrazo = (dia?.proximas ?? []).filter((t) => t.prazo);
  const vazio = !dia || dia.atrasadas.length + dia.para_hoje.length + comPrazo.length === 0;

  return (
    <Sino
      classe="prazos"
      icone="calendar"
      rotulo="Prazos"
      nome={nomePrazos(dia ? contarPrazos(dia) : 0)}
      contagem={dia ? contarPrazos(dia) : 0}
      titulo="Prazos das atividades"
      aoAbrir={() => void carregar()}
    >
      {erro ? (
        <p>Não foi possível carregar os prazos. Tente de novo.</p>
      ) : !dia ? (
        <Carregando />
      ) : vazio ? (
        <p>Nenhuma atividade com prazo por enquanto.</p>
      ) : (
        <>
          <GrupoDePrazos titulo="Hoje" tarefas={dia?.para_hoje ?? []} hoje={hoje} />
          <GrupoDePrazos
            titulo="Amanhã"
            tarefas={comPrazo.filter((t) => t.prazo === amanha)}
            hoje={hoje}
          />
          <GrupoDePrazos
            titulo="Próximos dias"
            tarefas={comPrazo.filter((t) => t.prazo !== amanha)}
            hoje={hoje}
          />
          <GrupoDePrazos
            titulo="Ainda abertas, com prazo anterior"
            tarefas={dia?.atrasadas ?? []}
            hoje={hoje}
            passado
          />
        </>
      )}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => aoIr('atividades')}>
        Ver todas as atividades
      </button>
    </Sino>
  );
}

// L22d: sino "Avisos da plataforma" do Master. Só o que o Master já pode ler (números e nomes de instituição):
// trilha com problema, convites de instituição esperando uso e instituições em implantação. Nunca dado escolar.
export function SinoPlataforma({ aoIr }: { aoIr: (p: Pagina) => void }) {
  const [avisos, setAvisos] = useState<{ chave: string; texto: string; ir: Pagina }[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [painel, convites, trilha] = await Promise.all([
        apiOperacao.painel(),
        apiOperacao.resumoConvites(),
        apiOperacao.trilha(),
      ]);
      const lista: { chave: string; texto: string; ir: Pagina }[] = [];
      if (!trilha.integra)
        lista.push({
          chave: 'trilha',
          texto: 'A conferência achou registro alterado na trilha do Master.',
          ir: 'm_auditoria',
        });
      const esperando = convites.instituicao?.pendentes ?? 0;
      if (esperando > 0)
        lista.push({
          chave: 'convites',
          texto: `${esperando} ${esperando === 1 ? 'convite de instituição esperando' : 'convites de instituição esperando'} uso.`,
          ir: 'm_instituicoes',
        });
      for (const i of painel.instituicoes.filter((x) => x.situacao === 'em_implantacao'))
        lista.push({
          chave: `impl-${i.id}`,
          texto: `${i.nome} está em implantação.`,
          ir: 'm_instituicoes',
        });
      setAvisos(lista);
      setErro(false);
    } catch {
      setErro(true);
    }
  }, []);
  useEffect(() => {
    void carregar();
    window.addEventListener('focus', carregar);
    return () => window.removeEventListener('focus', carregar);
  }, [carregar]);

  const n = avisos?.length ?? 0;
  return (
    <Sino
      classe="mensagens"
      icone="bell"
      rotulo="Avisos"
      nome={`Avisos da plataforma, ${n === 0 ? 'nenhum' : n === 1 ? '1 aviso' : `${n} avisos`}`}
      contagem={n}
      titulo="Avisos da plataforma"
      aoAbrir={() => void carregar()}
    >
      {erro ? (
        <p>Não foi possível carregar os avisos. Tente de novo.</p>
      ) : !avisos ? (
        <Carregando />
      ) : avisos.length === 0 ? (
        <p>Nenhum aviso por enquanto.</p>
      ) : (
        <ul className="sino-lista">
          {avisos.map((a) => (
            <li key={a.chave} className="sino-item">
              <p>{a.texto}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => aoIr(a.ir)}>
                Abrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sino>
  );
}
