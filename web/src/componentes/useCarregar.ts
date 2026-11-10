import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi } from '../api';

// Carrega dados da API; recarrega quando as dependências mudam e sob demanda depois de uma ação
export function useCarregar<T>(funcao: () => Promise<T>, dependencias: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true); // só até a primeira resposta (dado ou erro)
  const ultima = useRef(funcao);
  ultima.current = funcao;
  const recarregar = useCallback(async () => {
    try {
      setDados(await ultima.current());
      setErro('');
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível carregar. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => {
    void recarregar();
  }, [recarregar, ...dependencias]);
  return { dados, erro, carregando, recarregar };
}
