import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Eu } from './api';
import { type Pagina, Shell } from './componentes/Shell';
import { BotaoVLibras } from './componentes/VLibras';
import { carregarInterface, INTERFACE_PADRAO, type Interface, salvarInterface } from './interface';
import { Acessibilidade } from './paginas/Acessibilidade';
import { Agenda } from './paginas/Agenda';
import { Ajuda } from './paginas/Ajuda';
import { Atividades } from './paginas/Atividades';
import { Avisos } from './paginas/Avisos';
import { AvisosEscola } from './paginas/AvisosEscola';
import { Calendario } from './paginas/Calendario';
import { ConfigurarTotp } from './paginas/ConfigurarTotp';
import { Conta } from './paginas/Conta';
import { Foco } from './paginas/Foco';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { MeuDia } from './paginas/MeuDia';
import { Notas } from './paginas/Notas';
import { NotasOficiais } from './paginas/NotasOficiais';
import { NotasProfessor } from './paginas/NotasProfessor';
import { Personalizar } from './paginas/Personalizar';
import { TrocarSenha } from './paginas/TrocarSenha';
import { Turmas } from './paginas/Turmas';
import { Usuarios } from './paginas/Usuarios';
import {
  aplicarPreferencias,
  carregarPreferencias,
  doServidor,
  PREFERENCIAS_PADRAO,
  type Preferencias,
  paraServidor,
  salvarPreferencias,
} from './preferencias';

export function App() {
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState<Eu | null>(null);
  const [padrao, setPadrao] = useState<string | null>(null);
  const [pagina, setPagina] = useState<Pagina>('inicio');
  const [naoLidas, setNaoLidas] = useState(0);
  const [prefs, setPrefs] = useState<Preferencias>(() => carregarPreferencias());
  // L17d: rótulos do topo e VLibras. Com sessão, vem do banco; sem sessão, a cópia deste aparelho.
  const [interfaceAtual, setInterfaceAtual] = useState<Interface>(() => carregarInterface());
  // Atividade escolhida no cartão "Escolha o que fazer agora" (L17): o Foco abre com ela marcada
  const [focoTarefa, setFocoTarefa] = useState('');
  const comecar = (id: string) => {
    setFocoTarefa(id);
    setPagina('foco');
  };
  // Pelo menu, o Foco abre sem atividade marcada
  const ir = (p: Pagina) => {
    setFocoTarefa('');
    setPagina(p);
  };

  const atualizarEu = useCallback(async () => {
    try {
      setEu(await api.eu());
    } catch (x) {
      if (!(x instanceof ErroApi)) throw x;
      setEu(null);
    }
  }, []);

  // Contador de avisos no menu (só para o aluno, com sessão completa)
  const contarAvisos = useCallback(async () => {
    try {
      setNaoLidas((await api.notificacoes()).nao_lidas);
    } catch {
      setNaoLidas(0);
    }
  }, []);
  const ehAluno = eu?.usuario.perfil === 'aluno' && eu.nivel === 'completo';
  useEffect(() => {
    if (ehAluno) {
      setPagina((p) => (p === 'inicio' ? 'meudia' : p));
      void contarAvisos();
      // Preferências por usuário (L17b): valem em qualquer computador. Sem linha no banco, vale o padrão.
      api
        .preferenciasServidor()
        .then(({ preferencias }) => {
          if (!preferencias) return;
          const p = doServidor(preferencias);
          setPrefs(p);
          salvarPreferencias(p);
          aplicarPreferencias(p);
          setPagina((atual) => (atual === 'meudia' ? p.telaInicial : atual));
        })
        .catch(() => undefined);
    }
  }, [ehAluno, contarAvisos]);

  const completo = eu?.nivel === 'completo';
  useEffect(() => {
    if (!completo) return;
    api
      .interfaceServidor()
      .then(({ interface: i }) => {
        if (!i) return;
        setInterfaceAtual(i);
        salvarInterface(i);
      })
      .catch(() => undefined);
  }, [completo]);

  // Grava neste aparelho e, com sessão completa, na conta. Se o banco falhar, vale neste aparelho.
  function mudarInterface(i: Interface) {
    setInterfaceAtual(i);
    salvarInterface(i);
    if (completo)
      void api
        .salvarInterfaceServidor(i)
        .then(({ interface: s }) => {
          if (s) setInterfaceAtual(s);
        })
        .catch(() => undefined);
  }
  const aceitarAvisoVLibras = () =>
    mudarInterface({ ...interfaceAtual, vlibras: true, vlibras_aviso_aceito: true });
  const vlibras = (
    <BotaoVLibras
      ligado={interfaceAtual.vlibras}
      avisoAceito={interfaceAtual.vlibras_aviso_aceito}
      aoAceitar={aceitarAvisoVLibras}
    />
  );

  useEffect(() => {
    (async () => {
      try {
        setPadrao((await api.config()).instituicao_padrao);
      } catch {
        // Sem /config o login pede o código da instituição
      }
      await atualizarEu();
      setPronto(true);
    })();
  }, [atualizarEu]);

  function mudarPrefs(p: Preferencias) {
    setPrefs(p);
    salvarPreferencias(p);
    aplicarPreferencias(p);
    // O aluno guarda também no banco; se falhar, a mudança vale neste aparelho
    if (ehAluno) void api.salvarPreferenciasServidor(paraServidor(p)).catch(() => undefined);
  }

  // "Voltar ao padrão": local e no banco (grava os valores padrão e registra na auditoria)
  function voltarAoPadrao() {
    const p = { ...PREFERENCIAS_PADRAO };
    setPrefs(p);
    salvarPreferencias(p);
    aplicarPreferencias(p);
    if (ehAluno) void api.preferenciasPadrao().catch(() => undefined);
    // Rótulos e VLibras também voltam ao padrão; o aceite do aviso continua (é um fato, não uma preferência)
    mudarInterface({
      ...INTERFACE_PADRAO,
      vlibras_aviso_aceito: interfaceAtual.vlibras_aviso_aceito,
    });
  }

  async function sair() {
    await api.logout().catch(() => undefined);
    setEu(null);
    setPagina('inicio');
  }

  if (!pronto)
    return (
      <p role="status" style={{ padding: 24 }}>
        Carregando…
      </p>
    );
  if (!eu)
    return (
      <>
        <Login instituicaoPadrao={padrao} aoEntrar={setEu} />
        {vlibras}
      </>
    );

  const etapa =
    eu.nivel === 'trocar_senha' ? (
      <TrocarSenha aoConcluir={atualizarEu} />
    ) : eu.nivel === 'configurar_totp' ? (
      <ConfigurarTotp aoConcluir={atualizarEu} />
    ) : null;

  return (
    <Shell
      eu={eu}
      pagina={pagina}
      aoIr={ir}
      aoSair={sair}
      naoLidas={naoLidas}
      rotulos={interfaceAtual.rotulos}
      vlibras={vlibras}
    >
      {etapa ??
        (pagina === 'conta' && eu.nivel === 'completo' ? (
          <Conta aoSair={sair} />
        ) : pagina === 'ajuda' ? (
          <Ajuda perfil={eu.usuario.perfil} />
        ) : pagina === 'acessibilidade' ? (
          <Acessibilidade
            valor={prefs}
            aoMudar={mudarPrefs}
            interfaceAtual={interfaceAtual}
            aoMudarInterface={mudarInterface}
          />
        ) : ehAluno && pagina === 'meudia' ? (
          <MeuDia nome={prefs.apelido ?? eu.usuario.nome} aoIr={ir} aoComecar={comecar} />
        ) : ehAluno && pagina === 'atividades' ? (
          <Atividades />
        ) : ehAluno && pagina === 'agenda' ? (
          <Agenda />
        ) : ehAluno && pagina === 'personalizar' ? (
          <Personalizar
            valor={prefs}
            aoMudar={mudarPrefs}
            aoPadrao={voltarAoPadrao}
            interfaceAtual={interfaceAtual}
            aoMudarInterface={mudarInterface}
          />
        ) : ehAluno && pagina === 'calendario' ? (
          <Calendario />
        ) : ehAluno && pagina === 'foco' ? (
          <Foco key={focoTarefa} tarefaInicial={focoTarefa} />
        ) : ehAluno && pagina === 'notas' ? (
          <Notas />
        ) : eu.nivel === 'completo' &&
          pagina === 'notasoficiais' &&
          ['aluno', 'responsavel', 'admin', 'pedagogico'].includes(eu.usuario.perfil) ? (
          <NotasOficiais perfil={eu.usuario.perfil} />
        ) : eu.nivel === 'completo' &&
          pagina === 'notasprof' &&
          eu.usuario.perfil === 'professor' ? (
          <NotasProfessor />
        ) : eu.nivel === 'completo' &&
          pagina === 'avisosescola' &&
          ['admin', 'pedagogico'].includes(eu.usuario.perfil) ? (
          <AvisosEscola perfil={eu.usuario.perfil} />
        ) : ehAluno && pagina === 'avisos' ? (
          <Avisos aoMudar={() => void contarAvisos()} />
        ) : pagina === 'usuarios' && eu.usuario.perfil === 'admin' ? (
          <Usuarios />
        ) : pagina === 'turmas' && eu.usuario.perfil === 'admin' ? (
          <Turmas />
        ) : ehAluno ? (
          <MeuDia nome={prefs.apelido ?? eu.usuario.nome} aoIr={ir} aoComecar={comecar} />
        ) : (
          <Inicio eu={eu} aoIr={setPagina} />
        ))}
    </Shell>
  );
}
