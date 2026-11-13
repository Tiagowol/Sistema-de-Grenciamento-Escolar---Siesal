import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Eu, type Identidade, URL_LOGOTIPO } from './api';
import { type Pagina, Shell } from './componentes/Shell';
import { BotaoVLibras } from './componentes/VLibras';
import { carregarInterface, INTERFACE_PADRAO, type Interface, salvarInterface } from './interface';
import { definirModulos } from './modulos';
import { Acessibilidade } from './paginas/Acessibilidade';
import { Acompanhamento } from './paginas/Acompanhamento';
import { AcompanhamentoInstituicao } from './paginas/AcompanhamentoInstituicao';
import { Agenda } from './paginas/Agenda';
import { Ajuda } from './paginas/Ajuda';
import { Atividades } from './paginas/Atividades';
import { Avisos } from './paginas/Avisos';
import { AvisosEscola } from './paginas/AvisosEscola';
import { Calendario } from './paginas/Calendario';
import { CalendarioEscola } from './paginas/CalendarioEscola';
import { Cartoes } from './paginas/Cartoes';
import { ConfigurarTotp } from './paginas/ConfigurarTotp';
import { Conta } from './paginas/Conta';
import { Foco } from './paginas/Foco';
import { IdentidadeEscola } from './paginas/IdentidadeEscola';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { MeuDia } from './paginas/MeuDia';
import { Notas } from './paginas/Notas';
import { NotasOficiais } from './paginas/NotasOficiais';
import { NotasProfessor } from './paginas/NotasProfessor';
import { Personalizar } from './paginas/Personalizar';
import { QuemPodeVer } from './paginas/QuemPodeVer';
import { RegrasNotas } from './paginas/RegrasNotas';
import { TrocarSenha } from './paginas/TrocarSenha';
import { Turmas } from './paginas/Turmas';
import { Usuarios } from './paginas/Usuarios';
import {
  aplicarPreferencias,
  carregarPreferencias,
  definirEscola,
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
      const novo = await api.eu();
      definirModulos(novo.modulos); // L20: o que o Master desligou some das telas
      setEu(novo);
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
    }
  }, [ehAluno, contarAvisos]);

  // Preferências por usuário (L17b, L20a): valem em qualquer computador, para os 5 perfis escolares.
  // Sem linha no banco, vale o padrão; se o banco falhar, vale o que está neste aparelho.
  const temPrefsNaConta = eu?.nivel === 'completo';
  useEffect(() => {
    if (!temPrefsNaConta) return;
    api
      .preferenciasServidor()
      .then(({ preferencias }) => {
        if (!preferencias) return;
        const p = doServidor(preferencias);
        setPrefs(p);
        salvarPreferencias(p);
        aplicarPreferencias(p);
        if (ehAluno) setPagina((atual) => (atual === 'meudia' ? p.telaInicial : atual));
      })
      .catch(() => undefined);
  }, [temPrefsNaConta, ehAluno]);

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

  // L19: identidade da escola (nome, logotipo e cor). A cor só vale se o aluno não escolheu a dele.
  const [escola, setEscola] = useState<Identidade | null>(null);
  const carregarEscola = useCallback(() => {
    api
      .identidade()
      .then(({ identidade }) => {
        setEscola(identidade);
        definirEscola(identidade);
        aplicarPreferencias(carregarPreferencias());
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (completo) carregarEscola();
    else {
      setEscola(null);
      definirEscola(null);
    }
  }, [completo, carregarEscola]);

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
    // Guarda também na conta; se falhar, a mudança vale neste aparelho
    if (temPrefsNaConta)
      void api.salvarPreferenciasServidor(paraServidor(p)).catch(() => undefined);
  }

  // "Voltar ao padrão": local e no banco (grava os valores padrão e registra na auditoria)
  function voltarAoPadrao() {
    const p = { ...PREFERENCIAS_PADRAO };
    setPrefs(p);
    salvarPreferencias(p);
    aplicarPreferencias(p);
    if (temPrefsNaConta) void api.preferenciasPadrao().catch(() => undefined);
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
        <Login
          instituicaoPadrao={padrao}
          aoEntrar={(novo) => {
            setEu(novo);
            void atualizarEu(); // L20: busca também os módulos ligados desta escola
          }}
        />
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
      escola={
        escola
          ? {
              nome: escola.nome_exibicao,
              logotipo: escola.tem_logotipo ? `${URL_LOGOTIPO}?v=${escola.numero}` : null,
            }
          : null
      }
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
        ) : ehAluno && pagina === 'cartoes' ? (
          <Cartoes />
        ) : eu.nivel === 'completo' &&
          pagina === 'acompanhamento' &&
          eu.usuario.perfil === 'pedagogico' ? (
          <Acompanhamento />
        ) : eu.nivel === 'completo' &&
          pagina === 'acompanhamentoinst' &&
          ['admin', 'pedagogico'].includes(eu.usuario.perfil) ? (
          <AcompanhamentoInstituicao perfil={eu.usuario.perfil} />
        ) : eu.nivel === 'completo' &&
          pagina === 'acompanhantes' &&
          ['aluno', 'responsavel'].includes(eu.usuario.perfil) ? (
          <QuemPodeVer />
        ) : ehAluno && pagina === 'agenda' ? (
          <Agenda />
        ) : ehAluno && pagina === 'personalizar' ? (
          <Personalizar valor={prefs} aoMudar={mudarPrefs} aoPadrao={voltarAoPadrao} />
        ) : ehAluno && pagina === 'calendario' ? (
          <Calendario
            forma={prefs.formaDia}
            aoMudarForma={(formaDia) => mudarPrefs({ ...prefs, formaDia })}
          />
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
        ) : eu.nivel === 'completo' &&
          pagina === 'calendarioescola' &&
          eu.usuario.perfil !== 'aluno' ? (
          <CalendarioEscola perfil={eu.usuario.perfil} />
        ) : eu.nivel === 'completo' && pagina === 'regrasnotas' && eu.usuario.perfil === 'admin' ? (
          <RegrasNotas />
        ) : eu.nivel === 'completo' && pagina === 'identidade' && eu.usuario.perfil === 'admin' ? (
          <IdentidadeEscola aoMudar={carregarEscola} />
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
