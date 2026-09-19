import React, { createContext, useContext, useState, useEffect } from 'react';
import { Usuario } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string; bloqueado?: boolean; field?: string }>;
  register: (nome: string, email: string, senha: string, escola?: string, turma?: string) => Promise<{ success: boolean; error?: string; field?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('@siesal:user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(localStorage.getItem('@siesal:token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('@siesal:token');
      if (savedToken) {
        try {
          const profile = await api.getProfile();
          if (profile && profile.id_usuario) {
            setUser(profile);
            localStorage.setItem('@siesal:user', JSON.stringify(profile));
          }
        } catch (e) {
          console.warn('Sessão restaurada localmente');
        }
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, senha: string) => {
    try {
      const response = await api.login({ email, senha });
      if (response.token && response.usuario) {
        localStorage.setItem('@siesal:token', response.token);
        localStorage.setItem('@siesal:user', JSON.stringify(response.usuario));
        setToken(response.token);
        setUser(response.usuario);
        return { success: true };
      }
      return { success: false, error: 'Resposta inesperada do servidor' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Erro ao realizar login',
        bloqueado: err.bloqueado || err.message?.includes('bloqueado') || false,
        field: err.field,
      };
    }
  };

  const register = async (nome: string, email: string, senha: string, escola?: string, turma?: string) => {
    try {
      const response = await api.register({ nome, email, senha, escola, turma });
      if (response.token && response.usuario) {
        localStorage.setItem('@siesal:token', response.token);
        localStorage.setItem('@siesal:user', JSON.stringify(response.usuario));
        setToken(response.token);
        setUser(response.usuario);
        return { success: true };
      }
      return { success: false, error: 'Resposta inesperada do servidor' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Erro ao realizar cadastro',
        field: err.field,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('@siesal:token');
    localStorage.removeItem('@siesal:user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
