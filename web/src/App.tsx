import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Eu } from './api';
import { type Pagina, Shell } from './componentes/Shell';
import { Acessibilidade } from './paginas/Acessibilidade';
import { Agenda } from './paginas/Agenda';
import { Ajuda } from './paginas/Ajuda';
import { Atividades } from './paginas/Atividades';
import { Avisos } from './paginas/Avisos';
import { AvisosEscola } from './paginas/AvisosEscola';
import { ConfigurarTotp } from './paginas/ConfigurarTotp';
import { Foco } from './paginas/Foco';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { MeuDia } from './paginas/MeuDia';
import { Notas } from './paginas/Notas';
import { NotasOficiais } from './paginas/NotasOficiais';
import { NotasProfessor } from './paginas/NotasProfessor';
import { TrocarSenha } from './paginas/TrocarSenha';
import { Turmas } from './paginas/Turmas';
import { Usuarios } from './paginas/Usuarios';
import {
  aplicarPreferencias,
  carregarPreferencias,
  type Preferencias,
  salvarPreferencias,
} from './preferencias';

export function App() {
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState<Eu | null>(null);
  const [padrao, setPadrao] = useState<string | null>(null);
  const [pagina, setPagina] = useState<Pagina>('inicio');
  const [naoLidas, setNaoLidas] = useState(0);
  const [prefs, setPrefs] = useState<Preferencias>(() => carregarPreferencias());
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
    }
  }, [ehAluno, contarAvisos]);

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
  if (!eu) return <Login instituicaoPadrao={padrao} aoEntrar={setEu} />;

  const etapa =
    eu.nivel === 'trocar_senha' ? (
      <TrocarSenha aoConcluir={atualizarEu} />
    ) : eu.nivel === 'configurar_totp' ? (
      <ConfigurarTotp aoConcluir={atualizarEu} />
    ) : null;

  return (
    <Shell eu={eu} pagina={pagina} aoIr={ir} aoSair={sair} naoLidas={naoLidas}>
      {etapa ??
        (pagina === 'ajuda' ? (
          <Ajuda perfil={eu.usuario.perfil} />
        ) : pagina === 'acessibilidade' ? (
          <Acessibilidade valor={prefs} aoMudar={mudarPrefs} />
        ) : ehAluno && pagina === 'meudia' ? (
          <MeuDia nome={eu.usuario.nome} aoIr={ir} aoComecar={comecar} />
        ) : ehAluno && pagina === 'atividades' ? (
          <Atividades />
        ) : ehAluno && pagina === 'agenda' ? (
          <Agenda />
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
          <MeuDia nome={eu.usuario.nome} aoIr={ir} aoComecar={comecar} />
        ) : (
          <Inicio eu={eu} aoIr={setPagina} />
        ))}
    </Shell>
  );
}
