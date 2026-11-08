import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

// Primeira etapa obrigatória quando a senha é provisória
export function TrocarSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (nova !== repetir) return setErro('As duas senhas novas precisam ser iguais.');
    try {
      await api.trocarSenha({ senha_atual: atual, senha_nova: nova });
      aoConcluir();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível trocar a senha.');
    }
  }

  return (
    <form className="card" onSubmit={enviar} noValidate style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="card-head">
        <h1 className="page-title" style={{ fontSize: 24 }}>
          Crie sua senha
        </h1>
      </div>
      <div className="stack">
        <Aviso>
          Sua senha atual é provisória. Troque agora para continuar. Use no mínimo 12 caracteres.
        </Aviso>
        {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
        <Campo rotulo="Senha atual (provisória)">
          {({ id }) => (
            <input
              id={id}
              type="password"
              autoComplete="current-password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Senha nova">
          {({ id }) => (
            <input
              id={id}
              type="password"
              autoComplete="new-password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Repita a senha nova">
          {({ id }) => (
            <input
              id={id}
              type="password"
              autoComplete="new-password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
            />
          )}
        </Campo>
        <button type="submit" className="btn btn-primary">
          Salvar senha
        </button>
      </div>
    </form>
  );
}
