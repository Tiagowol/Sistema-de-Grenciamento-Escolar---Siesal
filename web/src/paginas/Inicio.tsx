import type { Eu } from '../api';
import { PrimeirosPassos } from '../componentes/PrimeirosPassos';
import type { Pagina } from '../componentes/Shell';
import { Icone } from '../icones';

// Início simples. Tarefas, agenda e foco chegam nos próximos lotes.
export function Inicio({ eu, aoIr }: { eu: Eu; aoIr: (p: Pagina) => void }) {
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
      <PrimeirosPassos perfil={eu.usuario.perfil} aoIr={aoIr} />
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
        {eu.usuario.perfil === 'professor' ? (
          <section className="card">
            <div className="card-head">
              <h2>Notas da turma</h2>
            </div>
            <p>Lance notas, revise o que lançou e responda pedidos de revisão.</p>
            <button
              type="button"
              className="btn btn-primary mt-sm"
              onClick={() => aoIr('notasprof')}
            >
              <Icone nome="book" /> Abrir notas da turma
            </button>
          </section>
        ) : null}
        {['admin', 'pedagogico', 'responsavel'].includes(eu.usuario.perfil) ? (
          <section className="card">
            <div className="card-head">
              <h2>Notas oficiais</h2>
            </div>
            <p>Veja as notas lançadas pelos professores e peça uma revisão, se precisar.</p>
            <button
              type="button"
              className="btn btn-outline mt-sm"
              onClick={() => aoIr('notasoficiais')}
            >
              <Icone nome="book" /> Abrir notas oficiais
            </button>
          </section>
        ) : null}
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
