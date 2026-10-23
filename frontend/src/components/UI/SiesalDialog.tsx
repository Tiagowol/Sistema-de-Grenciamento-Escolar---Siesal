import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';

/**
 * Sistema de janelas de diálogo INTEGRADAS do SIESAL.
 *
 * Substitui definitivamente as janelas nativas do navegador
 * (window.confirm / window.alert / window.prompt) por modais com o visual
 * do sistema, mantendo a mesma ergonomia de Promise:
 *
 *   const ok = await dialog.confirm({ title, message, danger: true });
 *   await dialog.alert({ title, message });
 *   const valor = await dialog.prompt({ title, message, typeThis: 'DELETAR' });
 *
 * `typeThis` exige que o usuário digite um texto exato (ex.: "DELETAR")
 * para habilitar o botão de confirmação — usado em ações destrutivas.
 */

interface DialogOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirmação destrutiva (botão vermelho). */
  danger?: boolean;
  /** Exige digitar este texto exato para liberar o botão de confirmação. */
  typeThis?: string;
  /** Ícone do cabeçalho (default: info/alerta conforme danger). */
  icon?: 'info' | 'warning' | 'success' | 'question';
}

interface PromptOptions extends DialogOptions {
  placeholder?: string;
  initialValue?: string;
}

interface ActiveDialog {
  kind: 'confirm' | 'alert' | 'prompt';
  opts: DialogOptions & { placeholder?: string; initialValue?: string };
  resolve: (value: any) => void;
}

interface DialogApi {
  confirm(opts: DialogOptions): Promise<boolean>;
  alert(opts: DialogOptions): Promise<void>;
  prompt(opts: PromptOptions): Promise<string | null>;
}

const DialogContext = createContext<DialogApi>({} as DialogApi);

export const useDialog = () => useContext(DialogContext);

const ICONS = {
  info: { Icon: Info, cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  success: { Icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  question: { Icon: HelpCircle, cls: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback((kind: ActiveDialog['kind'], opts: ActiveDialog['opts']) => {
    return new Promise<any>((resolve) => {
      setInputValue((opts as PromptOptions).initialValue || '');
      setActive({ kind, opts, resolve });
      // foca o input do prompt após o modal renderizar
      setTimeout(() => inputRef.current?.focus(), 60);
    });
  }, []);

  const confirm = useCallback((opts: DialogOptions) => open('confirm', opts), [open]);
  const alert = useCallback(
    (opts: DialogOptions) => open('alert', opts).then(() => undefined),
    [open]
  );
  const prompt = useCallback((opts: PromptOptions) => open('prompt', opts), [open]);

  const close = (value: any) => {
    active?.resolve(value);
    setActive(null);
  };

  // Teclado: Esc fecha/cancela; Enter confirma (quando liberado)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close(active.kind === 'alert' ? undefined : active.kind === 'prompt' ? null : false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const iconKey = active ? (active.opts.icon || (active.opts.danger ? 'warning' : 'question')) : 'question';
  const { Icon, cls } = ICONS[iconKey as keyof typeof ICONS];

  const needsTyped = Boolean(active?.opts.typeThis);
  const typedOk = !needsTyped || (active?.opts.typeThis === inputValue.trim());

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt }}>
      {children}

      {active && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onMouseDown={(e) => {
            // clique no véu fecha (cancela) — clique dentro do cartão não
            if (e.target === e.currentTarget && active.kind !== 'alert') close(null);
            if (e.target === e.currentTarget && active.kind === 'alert') close(undefined);
          }}
        >
          <div className="w-full max-w-md siesal-card rounded-3xl p-6 border border-cyan-500/40 shadow-2xl">
            {/* Cabeçalho */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className={`p-2.5 rounded-2xl border shrink-0 ${cls}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white leading-snug">{active.opts.title}</h3>
                <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {active.opts.message}
                </div>
              </div>
            </div>

            {/* Campo de digitação (prompt / confirmação digitada) */}
            {active.kind === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (!needsTyped || typedOk)) {
                    close(inputValue.trim());
                  }
                }}
                placeholder={needsTyped ? `Digite "${active.opts.typeThis}" para confirmar` : (active.opts as PromptOptions).placeholder || ''}
                className="w-full px-4 py-3 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors mb-1"
              />
            )}

            {/* Botões */}
            <div className="flex items-center justify-end gap-2.5 mt-5">
              {active.kind !== 'alert' && (
                <button
                  onClick={() => close(active.kind === 'prompt' ? null : false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                >
                  {active.opts.cancelLabel || 'Cancelar'}
                </button>
              )}

              <button
                onClick={() =>
                  close(
                    active.kind === 'alert'
                      ? undefined
                      : active.kind === 'prompt'
                      ? typedOk
                        ? inputValue.trim()
                        : null
                      : true
                  )
                }
                disabled={needsTyped && !typedOk}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  active.opts.danger
                    ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:brightness-110'
                    : 'siesal-button-primary text-white'
                }`}
              >
                {active.opts.confirmLabel ||
                  (active.kind === 'alert' ? 'OK, entendi' : 'Confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
