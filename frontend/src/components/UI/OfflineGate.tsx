import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ServerOff, RefreshCw, Wifi, WifiOff, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

/**
 * Monitor de disponibilidade do backend.
 *
 * "checking"  → primeira verificação (splash de conexão)
 * "online"   → sistema liberado
 * "offline"  → backend fora do ar: o sistema fica BLOQUEADO com a tela
 *              "Servidor fora do ar" (estilo a aba sem internet do navegador)
 *              até a conexão voltar — a reconexão é testada automaticamente
 *              a cada poucos segundos e ao clicar em "Tentar novamente".
 */
export function useBackendStatus(pollMs = 5000): { status: 'checking' | 'online' | 'offline'; recheck: () => Promise<void> } {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const failCountRef = useRef(0);

  const check = useCallback(async () => {
    const ok = await api.pingBackend();
    if (ok) {
      failCountRef.current = 0;
      setStatus('online');
    } else {
      failCountRef.current += 1;
      setStatus((prev) =>
        prev === 'checking' || failCountRef.current >= 2 ? 'offline' : prev
      );
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollMs);
    return () => clearInterval(interval);
  }, [check, pollMs]);

  return { status, recheck: check };
}

/** Splash exibido durante a primeira verificação de conexão. */
export const ConnectingSplash: React.FC = () => (
  <div className="min-h-screen bg-[#040816] flex flex-col items-center justify-center gap-4 p-6">
    <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/30 animate-pulse-glow">
      <Sparkles className="w-8 h-8" />
    </div>
    <h1 className="text-2xl font-black text-white tracking-wider glow-cyan">SIESAL</h1>
    <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
      <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      Conectando ao servidor...
    </div>
  </div>
);

/** Tela de bloqueio exibida quando o backend está fora do ar. */
export const OfflineGateView: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const [lastTry, setLastTry] = useState<Date>(new Date());

  const handleRetry = () => {
    setLastTry(new Date());
    onRetry();
  };

  return (
    <div className="min-h-screen bg-[#040816] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        {/* Ilustração estilo "aba sem internet" */}
        <div className="mx-auto w-fit p-6 rounded-[28px] border-2 border-dashed border-white/[0.12] mb-8 animate-float-slow">
          <div className="relative">
            <ServerOff className="w-16 h-16 text-slate-500" />
            <WifiOff className="w-6 h-6 text-rose-400 absolute -right-2 -top-1" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white tracking-wide mb-2">
          Servidor SIESAL fora do ar
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
          Não foi possível conectar ao backend em{' '}
          <code className="text-cyan-400/90">http://localhost:3001</code>.
          O sistema fica <strong className="text-slate-200">bloqueado até a conexão voltar</strong> —
          como a aba "sem internet" do navegador, mas com reconexão automática.
        </p>

        {/* Checklist de ajuda */}
        <div className="mt-7 text-left text-xs text-slate-400 space-y-2.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 max-w-md mx-auto">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Verifique:
          </p>
          <div className="flex items-start gap-2.5">
            <span className="text-cyan-400 font-bold">1.</span>
            <span>
              Se o terminal do backend ainda está aberto. Para iniciar:{' '}
              <code className="text-cyan-400/90">npm run dev</code> na raiz do projeto (ou{' '}
              <code className="text-cyan-400/90">iniciar.bat</code>)
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-cyan-400 font-bold">2.</span>
            <span>Se a porta <code className="text-cyan-400/90">3001</code> não está ocupada por outro processo</span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-cyan-400 font-bold">3.</span>
            <span>Sua conexão de rede (Wi-Fi/cabo) está funcionando</span>
          </div>
        </div>

        {/* Ações */}
        <button
          onClick={handleRetry}
          className="mt-7 siesal-button-primary text-white font-bold py-3.5 px-8 rounded-xl flex items-center justify-center gap-2.5 shadow-lg text-sm mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente agora</span>
        </button>

        <p className="mt-5 text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <Wifi className="w-3.5 h-3.5" />
          Reconectando automaticamente a cada 5 segundos...
          {lastTry && (
            <span className="text-slate-600">
              (última tentativa: {lastTry.toLocaleTimeString('pt-BR')})
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
