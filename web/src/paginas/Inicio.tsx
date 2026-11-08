import type { Eu } from '../api';
import { Icone } from '../icones';

// Início simples. Tarefas, agenda e foco chegam nos próximos lotes.
export function Inicio({ eu, aoIr }: { eu: Eu; aoIr: (p: 'acessibilidade' | 'usuarios') => void }) {
  const primeiro = eu.usuario.nome.split(' ')[0];
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Início</div>
          <h1>Olá, {primeiro}</h1>
          <p>Você entrou com segurança. Escolha o que fazer agora.</p>
        </div>
      </div>
      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <h2>Ajustes de leitura</h2>
          </div>
          <p>Mude tamanho da letra, contraste, tema escuro e modo simples.</p>
          <button
            type="button"
            className="btn btn-primary mt-sm"
            onClick={() => aoIr('acessibilidade')}
          >
            <Icone nome="access" /> Abrir acessibilidade
          </button>
        </section>
        {eu.usuario.perfil === 'admin' ? (
          <section className="card">
            <div className="card-head">
              <h2>Usuários</h2>
            </div>
            <p>Cadastre pessoas e entregue a senha provisória.</p>
            <button
              type="button"
              className="btn btn-outline mt-sm"
              onClick={() => aoIr('usuarios')}
            >
              <Icone nome="users" /> Gerenciar usuários
            </button>
          </section>
        ) : null}
      </div>
    </>
  );
}
