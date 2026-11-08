import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Eu } from './api';
import { type Pagina, Shell } from './componentes/Shell';
import { Acessibilidade } from './paginas/Acessibilidade';
import { ConfigurarTotp } from './paginas/ConfigurarTotp';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { TrocarSenha } from './paginas/TrocarSenha';
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
  const [prefs, setPrefs] = useState<Preferencias>(() => carregarPreferencias());

  const atualizarEu = useCallback(async () => {
    try {
      setEu(await api.eu());
    } catch (x) {
      if (!(x instanceof ErroApi)) throw x;
      setEu(null);
    }
  }, []);

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
    <Shell eu={eu} pagina={pagina} aoIr={setPagina} aoSair={sair}>
      {etapa ??
        (pagina === 'usuarios' ? (
          <Usuarios />
        ) : pagina === 'acessibilidade' ? (
          <Acessibilidade valor={prefs} aoMudar={mudarPrefs} />
        ) : (
          <Inicio eu={eu} aoIr={setPagina} />
        ))}
    </Shell>
  );
}
