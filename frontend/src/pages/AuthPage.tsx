import React, { useState, useMemo, useEffect } from 'react';
import {
  LogIn, UserPlus, ShieldAlert, Mail, Lock, User, School,
  GraduationCap, Sparkles, CheckCircle2, Eye, EyeOff,
  AlertCircle, ShieldCheck, X, Chrome, BadgeCheck, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { checkPasswordBreach } from '../utils/security';

interface AuthPageProps {
  initialTab?: 'login' | 'register' | 'google';
  onSuccess?: () => void;
}

interface FieldErrors {
  nome?: string;
  email?: string;
  senha?: string;
  confirmarSenha?: string;
  escola?: string;
  turma?: string;
  geral?: string;
}

type AuthTab = 'login' | 'register' | 'google';

// Chave de sessão do fluxo OAuth do Google (proteção anti-CSRF)
const OAUTH_STATE_KEY = '@siesal:oauth_state';

/** Gera um valor aleatório seguro codificado em base64url. */
function generateRandomBase64Url(lengthBytes: number): string {
  const bytes = new Uint8Array(lengthBytes);
  crypto.getRandomValues(bytes);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ícone oficial da conta Google (SVG multicolorido). */
const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

// Avalia a força da senha de 0 a 5
function getPasswordStrength(senha: string): { score: number; label: string; color: string } {
  let score = 0;
  if (senha.length >= 6) score++;
  if (senha.length >= 10) score++;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) score++;
  if (/[0-9]/.test(senha)) score++;
  if (/[^a-zA-Z0-9]/.test(senha)) score++;

  if (score <= 1) return { score, label: 'Muito fraca', color: '#ef4444' };
  if (score === 2) return { score, label: 'Fraca', color: '#f97316' };
  if (score === 3) return { score, label: 'Média', color: '#eab308' };
  if (score === 4) return { score, label: 'Forte', color: '#22c55e' };
  return { score, label: 'Muito forte', color: '#06b6d4' };
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export const AuthPage: React.FC<AuthPageProps> = ({ initialTab = 'login', onSuccess }) => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Campos
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [escola, setEscola] = useState('');
  const [turma, setTurma] = useState('');

  // UI
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Status da configuração do Google no backend ('checking' | 'ok' | 'off')
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'ok' | 'off'>('checking');
  const [googleStarting, setGoogleStarting] = useState(false);

  // Consulta o status sempre que a aba Google é aberta
  useEffect(() => {
    if (activeTab !== 'google') return;
    setGoogleStatus('checking');
    api
      .googleOAuthStatus()
      .then((s) => setGoogleStatus(s.configured ? 'ok' : 'off'))
      .catch(() => setGoogleStatus('off'));
  }, [activeTab]);

  const passwordStrength = useMemo(() => getPasswordStrength(senha), [senha]);

  const clearForm = () => {
    setNome(''); setEmail(''); setSenha(''); setConfirmarSenha('');
    setEscola(''); setTurma('');
    setErrors({}); setSuccessMsg('');
    setIsBlocked(false);
  };

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    clearForm();
  };

  // Validações client-side
  const validateForm = (): boolean => {
    const newErrors: FieldErrors = {};

    if (activeTab === 'register') {
      if (!nome.trim()) {
        newErrors.nome = 'Nome completo é obrigatório.';
      } else if (nome.trim().length < 2) {
        newErrors.nome = 'O nome deve ter pelo menos 2 caracteres.';
      } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(nome.trim())) {
        newErrors.nome = 'O nome deve conter apenas letras e espaços.';
      }

      if (!escola.trim()) {
        newErrors.escola = 'Nome da escola é obrigatório.';
      } else if (escola.trim().length < 3) {
        newErrors.escola = 'O nome da escola deve ter pelo menos 3 caracteres.';
      }

      if (!turma.trim()) {
        newErrors.turma = 'Turma/série é obrigatória.';
      }

      if (confirmarSenha !== senha) {
        newErrors.confirmarSenha = 'As senhas não coincidem.';
      }

      if (passwordStrength.score < 2) {
        newErrors.senha = 'Escolha uma senha mais forte (misture letras, números ou símbolos).';
      }
    }

    if (activeTab !== 'google') {
      if (!email.trim()) {
        newErrors.email = 'E-mail é obrigatório.';
      } else if (!EMAIL_REGEX.test(email.trim())) {
        newErrors.email = 'Formato de e-mail inválido. Ex: aluno@escola.com';
      }

      if (!senha) {
        newErrors.senha = 'Senha é obrigatória.';
      } else if (senha.length < 6) {
        newErrors.senha = 'A senha deve ter pelo menos 6 caracteres.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      if (activeTab === 'register') {
        // Segurança v2: recusa senhas já vazadas na internet (HaveIBeenPwned)
        const breach = await checkPasswordBreach(senha);
        if (breach && breach.breached) {
          setErrors({
            senha: `Senha insegura: já apareceu em vazamentos de dados ${breach.count} vez(es). Escolha outra senha.`,
          });
          setLoading(false);
          return;
        }

        const res = await register(nome, email, senha, escola, turma);
        if (res.success) {
          setSuccessMsg('Conta criada com sucesso! Bem-vindo ao SIESAL 🎓');
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 800);
        } else {
          const errMsg = res.error || 'Erro ao realizar cadastro.';
          // Usa o campo do backend se disponível, senão faz detecção por texto
          const errField = (res as any).field as keyof FieldErrors | undefined;
          if (errField && errField !== 'geral') {
            setErrors({ [errField]: errMsg });
          } else if (errMsg.toLowerCase().includes('e-mail') || errMsg.toLowerCase().includes('email')) {
            setErrors({ email: errMsg });
          } else if (errMsg.toLowerCase().includes('nome')) {
            setErrors({ nome: errMsg });
          } else if (errMsg.toLowerCase().includes('coincidem')) {
            setErrors({ confirmarSenha: errMsg });
          } else if (errMsg.toLowerCase().includes('senha')) {
            setErrors({ senha: errMsg });
          } else if (errMsg.toLowerCase().includes('escola')) {
            setErrors({ escola: errMsg });
          } else if (errMsg.toLowerCase().includes('turma')) {
            setErrors({ turma: errMsg });
          } else {
            setErrors({ geral: errMsg });
          }
        }
      } else {
        const res = await login(email, senha);
        if (res.success) {
          if (onSuccess) onSuccess();
        } else {
          const errMsg = res.error || 'Erro ao entrar.';
          const errField = (res as any).field as keyof FieldErrors | undefined;
          if (res.bloqueado) {
            setIsBlocked(true);
            setErrors({ geral: errMsg });
          } else if (errField && errField !== 'geral') {
            setErrors({ [errField]: errMsg });
          } else if (errMsg.toLowerCase().includes('e-mail') || errMsg.toLowerCase().includes('email')) {
            setErrors({ email: errMsg });
          } else if (errMsg.toLowerCase().includes('senha')) {
            setErrors({ senha: errMsg });
          } else {
            setErrors({ geral: errMsg });
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Inicia o login com Google (OAuth 2.0 Authorization Code):
   * 1. Confere com o backend se GOOGLE_CLIENT_ID/SECRET já estão configurados;
   * 2. Gera o `state` anti-CSRF e guarda no sessionStorage;
   * 3. Redireciona o navegador para /api/auth/google, que encaminha ao Google.
   */
  const handleStartGoogle = async () => {
    setErrors({});
    setGoogleStarting(true);

    try {
      const status = await api.googleOAuthStatus();

      if (!status.configured) {
        setErrors({
          geral:
            'O login com Google ainda não foi configurado no servidor. Siga o guia abaixo (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend/.env) e reinicie o backend.',
        });
        setGoogleStarting(false);
        return;
      }

      const state = generateRandomBase64Url(24);
      sessionStorage.setItem(OAUTH_STATE_KEY, state);

      window.location.assign(api.buildGoogleLoginUrl(state));
    } catch (err: any) {
      setErrors({ geral: err.message || 'Erro ao iniciar o login com Google.' });
      setGoogleStarting(false);
    }
  };

  const inputClass = (field: keyof FieldErrors) =>
    `w-full px-4 py-3 rounded-xl bg-[#0a1430] border text-white placeholder-slate-500 focus:outline-none transition-colors ${
      errors[field]
        ? 'border-rose-500 focus:border-rose-400'
        : 'border-[#203c7e] focus:border-cyan-400'
    }`;

  const tabs: { id: AuthTab; label: string; icon: any }[] = [
    { id: 'login', label: 'Entrar', icon: LogIn },
    { id: 'register', label: 'Criar Conta', icon: UserPlus },
    { id: 'google', label: 'Google', icon: Chrome },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg siesal-card rounded-3xl p-8 sm:p-10 border border-cyan-500/40 relative shadow-2xl animate-float-slow">
        {/* Logo & Marca */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-cyan-500/30 mb-4 animate-pulse-glow">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-wider glow-cyan">
            SIESAL
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Sistema de Gerenciamento Escolar do Aluno
          </p>
        </div>

        {/* Abas Alternáveis: Entrar | Criar Conta | Google (OAuth) */}
        <div className="grid grid-cols-3 p-1.5 rounded-2xl bg-[#0a1430] border border-[#1b3472] mb-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mensagem de sucesso */}
        {successMsg && (
          <div className="p-4 rounded-2xl mb-5 text-xs font-semibold flex items-start gap-2.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 animate-fade-in">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Alerta de Erro Geral ou Bloqueio */}
        {errors.geral && (
          <div
            className={`p-4 rounded-2xl mb-5 text-xs font-semibold flex items-start gap-2.5 ${
              isBlocked
                ? 'bg-rose-950/80 border border-rose-500 text-rose-300'
                : 'bg-amber-950/80 border border-amber-500 text-amber-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errors.geral}</span>
          </div>
        )}

        {/* ────────────────────────────────────────────────
            ABA GOOGLE — OAuth 2.0 real (Authorization Code)
           ──────────────────────────────────────────────── */}
        {activeTab === 'google' ? (
          <div className="space-y-4 animate-fade-in">
            {/* Status da configuração do provedor Google */}
            {googleStatus === 'checking' && (
              <div className="p-4 rounded-2xl bg-[#0b1739]/80 border border-[#1f3c7e] flex items-center gap-3 text-xs text-slate-300">
                <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin shrink-0" />
                Verificando configuração do Google no servidor...
              </div>
            )}

            {googleStatus === 'ok' && (
              <>
                {/* Cartão explicativo do fluxo */}
                <div className="p-5 rounded-2xl bg-[#0b1739]/80 border border-[#1f3c7e]">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                      <GoogleIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Conta Google conectada ✔</h3>
                      <p className="text-[11px] text-slate-400">
                        OAuth 2.0 • Authorization Code Flow
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ao continuar, você será redirecionado à tela oficial de login do
                    <strong className="text-cyan-300"> Google</strong>. Depois de autorizar,
                    você volta automaticamente para o SIESAL já autenticado.
                  </p>

                  <div className="mt-4 space-y-2">
                    {[
                      'O SIESAL recebe apenas seu nome e e-mail verificado pelo Google',
                      'Sua senha do Google nunca é compartilhada com o aplicativo',
                      'Alunos novos têm a conta criada automaticamente no primeiro acesso',
                    ].map((txt) => (
                      <div key={txt} className="flex items-start gap-2 text-[11px] text-slate-300">
                        <BadgeCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{txt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botão principal: Google OAuth */}
                <button
                  type="button"
                  onClick={handleStartGoogle}
                  disabled={googleStarting || isBlocked}
                  className="w-full bg-white hover:bg-slate-100 text-slate-800 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 text-sm transition-all border border-white/60"
                >
                  {googleStarting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                      Redirecionando ao Google...
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="w-4.5 h-4.5" />
                      <span>Continuar com a Conta Google</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] text-slate-500 leading-relaxed">
                  Protegido com <code className="text-cyan-400/80">state</code> anti-CSRF e
                  validação do perfil no servidor — o token de sessão é emitido pelo SIESAL
                  (JWT próprio, 7 dias).
                </p>
              </>
            )}

            {googleStatus === 'off' && (
              <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Configuração necessária</h3>
                    <p className="text-[11px] text-amber-300/90">
                      O backend ainda não tem as credenciais do Google.
                    </p>
                  </div>
                </div>

                <ol className="space-y-2 text-[11px] text-slate-300 list-decimal list-inside leading-relaxed">
                  <li>
                    Acesse{' '}
                    <span className="text-cyan-300 font-mono">console.cloud.google.com/apis/credentials</span>
                  </li>
                  <li>
                    Crie um <strong>ID do cliente OAuth</strong> do tipo{' '}
                    <strong>Aplicativo da Web</strong>
                  </li>
                  <li>
                    Em "URIs de redirecionamento autorizados", adicione:{' '}
                    <code className="text-cyan-300">http://localhost:3001/api/auth/google/callback</code>
                  </li>
                  <li>
                    No arquivo <code className="text-cyan-300">backend/.env</code>, preencha{' '}
                    <code className="text-cyan-300">GOOGLE_CLIENT_ID</code> e{' '}
                    <code className="text-cyan-300">GOOGLE_CLIENT_SECRET</code>
                  </li>
                  <li>Reinicie o backend e recarregue esta aba</li>
                </ol>

                <p className="text-[10px] text-slate-400 mt-3">
                  Enquanto isso, use as abas <strong>Entrar</strong> ou{' '}
                  <strong>Criar Conta</strong> com e-mail e senha.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ──────────────────────────────────────────────
             ABAS DE LOGIN E CADASTRO (e-mail + senha)
           ────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="space-y-4 text-sm" noValidate>
            {/* ── Campos apenas no cadastro ── */}
            {activeTab === 'register' && (
              <>
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    Nome Completo *
                  </label>
                  <input
                    id="auth-nome"
                    type="text"
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      if (errors.nome) setErrors((prev) => ({ ...prev, nome: undefined }));
                    }}
                    placeholder="Ex: João Silva"
                    className={inputClass('nome')}
                    autoComplete="name"
                  />
                  {errors.nome && (
                    <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1.5 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.nome}
                    </p>
                  )}
                </div>

                {/* Escola e Turma */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-cyan-400" />
                      Escola / Instituição *
                    </label>
                    <input
                      id="auth-escola"
                      type="text"
                      value={escola}
                      onChange={(e) => {
                        setEscola(e.target.value);
                        if (errors.escola) setErrors((prev) => ({ ...prev, escola: undefined }));
                      }}
                      placeholder="Ex: Escola Municipal..."
                      className={inputClass('escola')}
                    />
                    {errors.escola && (
                      <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1.5 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.escola}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                      Turma / Série *
                    </label>
                    <input
                      id="auth-turma"
                      type="text"
                      value={turma}
                      onChange={(e) => {
                        setTurma(e.target.value);
                        if (errors.turma) setErrors((prev) => ({ ...prev, turma: undefined }));
                      }}
                      placeholder="Ex: 9º Ano B, 3º Colegial..."
                      className={inputClass('turma')}
                    />
                    {errors.turma && (
                      <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1.5 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.turma}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                E-mail do Aluno *
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="aluno@escola.gov.br"
                className={inputClass('email')}
                autoComplete="email"
              />
              {errors.email && (
                <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1.5 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {errors.email}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                {activeTab === 'register' ? 'Criar Senha *' : 'Senha de Acesso *'}
              </label>
              <div className="relative">
                <input
                  id="auth-senha"
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    if (errors.senha) setErrors((prev) => ({ ...prev, senha: undefined }));
                  }}
                  placeholder="••••••••"
                  className={inputClass('senha') + ' pr-12'}
                  autoComplete={activeTab === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                  tabIndex={-1}
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.senha && (
                <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1.5 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {errors.senha}
                </p>
              )}

              {/* Barra de força da senha (só no cadastro) */}
              {activeTab === 'register' && senha.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: i <= passwordStrength.score ? passwordStrength.color : '#1e3a6e',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] font-medium" style={{ color: passwordStrength.color }}>
                    Força: {passwordStrength.label}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    🔒 Verificamos na hora contra bases públicas de vazamentos — sem enviar sua
                    senha para lugar nenhum.
                  </p>
                </div>
              )}

              {activeTab === 'login' && (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Segurança: Bloqueio automático após 5 tentativas incorretas.
                </p>
              )}
            </div>

            {/* Confirmar Senha (só no cadastro) */}
            {activeTab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <input
                    id="auth-confirmar"
                    type={showConfirmar ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => {
                      setConfirmarSenha(e.target.value);
                      if (errors.confirmarSenha) setErrors((prev) => ({ ...prev, confirmarSenha: undefined }));
                    }}
                    placeholder="••••••••"
                    className={inputClass('confirmarSenha') + ' pr-12'}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmar((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmar ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                  >
                    {showConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {/* Ícone de validação em tempo real */}
                  {confirmarSenha.length > 0 && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      {confirmarSenha === senha ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                  )}
                </div>
                {errors.confirmarSenha && (
                  <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1.5 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.confirmarSenha}
                  </p>
                )}
              </div>
            )}

            {/* Botão de envio */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading || isBlocked}
                id="auth-submit-btn"
                className="w-full siesal-button-primary text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 text-sm transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : activeTab === 'register' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Criar Conta e Entrar</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Acessar Painel Escolar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Recursos */}
        <div className="mt-8 pt-6 border-t border-[#1b3472] grid grid-cols-2 gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Dados salvos no MySQL</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Calendário Interativo</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Alertas de Prazos</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Gestão por Matéria</span>
          </div>
        </div>
      </div>
    </div>
  );
};
