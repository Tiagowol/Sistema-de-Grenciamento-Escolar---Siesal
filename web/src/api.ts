// Cliente da API. Tudo passa por /api (nginx em produção, proxy do Vite em desenvolvimento).
export type Nivel = 'completo' | 'configurar_totp' | 'trocar_senha';
export type Perfil = 'admin' | 'professor' | 'aluno' | 'pedagogico' | 'responsavel';
export type Eu = { nivel: Nivel; usuario: { id: string; nome: string; perfil: Perfil } };
export type UsuarioLista = {
  id: string;
  perfil: Perfil;
  nome: string;
  email: string;
  situacao: string;
  senhaProvisoria: boolean;
};

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly corpo: Record<string, unknown>,
  ) {
    super(mensagem);
  }
}

async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    credentials: 'same-origin',
  });
  if (resposta.status === 204) return undefined as T;
  const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok) {
    throw new ErroApi(
      resposta.status,
      String(dados.erro ?? 'Algo não saiu como esperado. Tente de novo.'),
      dados,
    );
  }
  return dados as T;
}

export const api = {
  config: () =>
    chamar<{ instituicao_padrao: string | null; modo_local: boolean }>('GET', '/config'),
  eu: () => chamar<Eu>('GET', '/auth/eu'),
  login: (d: { instituicao_id: string; email: string; senha: string; codigo?: string }) =>
    chamar<Eu>('POST', '/auth/login', d),
  logout: () => chamar<void>('POST', '/auth/logout'),
  trocarSenha: (d: { senha_atual: string; senha_nova: string }) =>
    chamar<{ nivel: Nivel }>('POST', '/auth/senha/trocar', d),
  iniciarTotp: () => chamar<{ segredo: string; uri: string }>('POST', '/auth/totp/iniciar'),
  confirmarTotp: (codigo: string) =>
    chamar<{ codigos_recuperacao: string[] }>('POST', '/auth/totp/confirmar', { codigo }),
  usuarios: () => chamar<{ usuarios: UsuarioLista[] }>('GET', '/usuarios'),
  criarUsuario: (d: { perfil: Perfil; nome: string; email: string }) =>
    chamar<{ usuario: UsuarioLista; senha_provisoria: string }>('POST', '/usuarios', d),
  senhaProvisoria: (id: string) =>
    chamar<{ senha_provisoria: string }>('POST', `/usuarios/${id}/senha-provisoria`),
};
