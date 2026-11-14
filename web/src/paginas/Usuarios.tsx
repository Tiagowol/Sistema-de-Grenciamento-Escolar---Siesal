import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Perfil, type UsuarioLista } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

const PERFIS: { valor: Perfil; rotulo: string }[] = [
  { valor: 'aluno', rotulo: 'Aluno' },
  { valor: 'professor', rotulo: 'Professor' },
  { valor: 'pedagogico', rotulo: 'Pedagógico e apoio' },
  { valor: 'responsavel', rotulo: 'Responsável' },
  { valor: 'admin', rotulo: 'Administração' },
];

export function Usuarios() {
  const [lista, setLista] = useState<UsuarioLista[]>([]);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('aluno');
  const [entrega, setEntrega] = useState<{ para: string; senha: string } | null>(null);
  // L22c: confirmação em texto antes de desativar (nada é apagado; a pessoa só deixa de entrar)
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [feito, setFeito] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLista((await api.usuarios()).usuarios);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Falha ao listar.');
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function mudarSituacao(u: UsuarioLista, desativar: boolean) {
    setErro('');
    setFeito('');
    try {
      if (desativar) await api.desativarUsuario(u.id);
      else await api.reativarUsuario(u.id);
      setFeito(
        desativar ? `A conta de ${u.nome} foi desativada.` : `A conta de ${u.nome} foi reativada.`,
      );
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível concluir. Tente de novo.');
    }
    setConfirmando(null);
    await carregar();
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      const r = await api.criarUsuario({ perfil, nome: nome.trim(), email: email.trim() });
      setEntrega({ para: r.usuario.nome, senha: r.senha_provisoria });
      setNome('');
      setEmail('');
      await carregar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Falha ao cadastrar.');
    }
  }

  async function redefinir(u: UsuarioLista) {
    setErro('');
    try {
      const r = await api.senhaProvisoria(u.id);
      setEntrega({ para: u.nome, senha: r.senha_provisoria });
      await carregar();
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Falha ao redefinir.');
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Administração</div>
          <h1>Usuários</h1>
          <p>Use somente dados fictícios.</p>
        </div>
      </div>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {feito ? <Aviso>{feito}</Aviso> : null}
      {entrega ? (
        <Aviso>
          Senha provisória de <b>{entrega.para}</b>:{' '}
          <code style={{ fontSize: 18 }}>{entrega.senha}</code>. Ela aparece só agora. Entregue em
          mão.
        </Aviso>
      ) : null}
      <form className="card" onSubmit={criar} noValidate>
        <div className="card-head">
          <h2>Cadastrar pessoa</h2>
        </div>
        <div className="form-grid">
          <Campo rotulo="Nome">
            {({ id }) => <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} />}
          </Campo>
          <Campo rotulo="E-mail">
            {({ id }) => (
              <input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Perfil">
            {({ id }) => (
              <select id={id} value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
                {PERFIS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        </div>
        <button type="submit" className="btn btn-primary mt-sm">
          Cadastrar
        </button>
      </form>
      <section className="card mt">
        <div className="card-head">
          <h2>Pessoas cadastradas</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <caption className="small muted">Lista de usuários da instituição</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Perfil</th>
                <th scope="col">Situação</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{PERFIS.find((p) => p.valor === u.perfil)?.rotulo ?? u.perfil}</td>
                  <td>
                    {u.situacao === 'inativo'
                      ? 'Desativada'
                      : u.situacao === 'aguardando_responsavel'
                        ? 'Espera o responsável'
                        : u.senhaProvisoria
                          ? 'Senha provisória'
                          : 'Ativa'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void redefinir(u)}
                    >
                      Nova senha provisória<span className="sr-only"> para {u.nome}</span>
                    </button>{' '}
                    {u.situacao === 'inativo' ? (
                      <button
                        aria-label={`Reativar ${u.nome}`}
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void mudarSituacao(u, false)}
                      >
                        Reativar
                      </button>
                    ) : u.situacao === 'ativo' ? (
                      confirmando === u.id ? (
                        <span>
                          <span className="small">
                            Desativar {u.nome}? A pessoa deixa de entrar. Nada é apagado.
                          </span>{' '}
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => void mudarSituacao(u, true)}
                          >
                            Sim, desativar
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setConfirmando(null)}
                          >
                            Não
                          </button>
                        </span>
                      ) : (
                        <button
                          aria-label={`Desativar ${u.nome}`}
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setConfirmando(u.id)}
                        >
                          Desativar
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
