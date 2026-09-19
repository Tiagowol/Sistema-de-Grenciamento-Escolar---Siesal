import React, { useState } from 'react';
import { X, LogIn, UserPlus, ShieldAlert, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await register(nome, email, senha);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.error || 'Erro ao cadastrar');
        }
      } else {
        const res = await login(email, senha);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.error || 'Erro ao entrar');
          if (res.bloqueado) {
            setIsBlocked(true);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md siesal-card rounded-3xl p-6 sm:p-8 border border-cyan-500/40 relative shadow-2xl">
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#13275c] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-cyan-500/30 mb-3">
            {isRegister ? <UserPlus className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-black text-white tracking-wide">
            {isRegister ? 'Cadastro de Aluno' : 'Acesso ao SIESAL'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister
              ? 'Crie sua conta para gerenciar seus estudos'
              : 'Entre com seu e-mail institucional e senha'}
          </p>
        </div>

        {/* Alerta de Erro ou Bloqueio de Segurança (NF03) */}
        {errorMsg && (
          <div
            className={`p-3.5 rounded-2xl mb-4 text-xs font-semibold flex items-start gap-2.5 ${
              isBlocked
                ? 'bg-rose-950/80 border border-rose-500 text-rose-300'
                : 'bg-amber-950/80 border border-amber-500 text-amber-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: José de Arimatéia"
                className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aluno@escola.gov.br"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              Senha
            </label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-[#0a1430] border border-[#203c7e] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {!isRegister && (
              <p className="text-[10px] text-slate-500 mt-1">
                Aviso: O software bloqueia o acesso após 5 tentativas incorretas (NF03).
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || isBlocked}
              className="w-full siesal-button-primary text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading
                ? 'Processando...'
                : isRegister
                ? 'Cadastrar Aluno'
                : 'Entrar no Sistema'}
            </button>
          </div>
        </form>

        {/* Alternância Login / Cadastro */}
        <div className="mt-6 text-center pt-4 border-t border-[#1b3472]">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg('');
            }}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            {isRegister
              ? 'Já tem uma conta? Faça Login'
              : 'Não tem conta? Cadastre-se aqui'}
          </button>
        </div>
      </div>
    </div>
  );
};
