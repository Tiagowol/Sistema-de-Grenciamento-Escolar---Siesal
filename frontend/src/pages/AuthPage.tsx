import React, { useState, useMemo } from 'react';
import {
  LogIn, UserPlus, ShieldAlert, Mail, Lock, User, School,
  GraduationCap, Sparkles, CheckCircle2, Eye, EyeOff,
  AlertCircle, ShieldCheck, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  initialTab?: 'login' | 'register';
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

// Avalia a força da senha de 0 a 4
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
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

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

  const passwordStrength = useMemo(() => getPasswordStrength(senha), [senha]);

  const clearForm = () => {
    setNome(''); setEmail(''); setSenha(''); setConfirmarSenha('');
    setEscola(''); setTurma(''); setErrors({}); setSuccessMsg('');
    setIsBlocked(false);
  };

  const switchTab = (tab: 'login' | 'register') => {
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
        newErrors.senha = 'Escolha uma senha mais forte (mínimo 6 caracteres).';
      }
    }

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

  const inputClass = (field: keyof FieldErrors) =>
    `w-full px-4 py-3 rounded-xl bg-[#0a1430] border text-white placeholder-slate-500 focus:outline-none transition-colors ${
      errors[field]
        ? 'border-rose-500 focus:border-rose-400'
        : 'border-[#203c7e] focus:border-cyan-400'
    }`;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg siesal-card rounded-3xl p-8 sm:p-10 border border-cyan-500/40 relative shadow-2xl animate-float">
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

        {/* Abas Alternáveis */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#0a1430] border border-[#1b3472] mb-6">
          <button
            type="button"
            onClick={() => switchTab('login')}
            className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Entrar</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('register')}
            className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Criar Conta</span>
          </button>
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

        {/* Formulário */}
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
              </div>
            )}

            {activeTab === 'login' && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                Segurança: Bloqueio automático após {5} tentativas incorretas.
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
