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

export type Turno = 'manha' | 'tarde' | 'noite';
export type TurmaLista = {
  id: string;
  nome: string;
  ano_letivo: number;
  turno: Turno;
  criado_em: string;
  ativa: boolean;
  alunos: number;
  professores: number;
};
export type DisciplinaLista = { id: string; nome: string; criado_em: string; ativa: boolean };
export type TipoVinculo = 'professor_turma' | 'aluno_turma' | 'responsavel_aluno';
export type VinculoLista = {
  id: string;
  tipo: TipoVinculo;
  criado_em: string;
  usuario_id: string;
  usuario_nome: string;
  turma_nome: string | null;
  disciplina_nome: string | null;
  aluno_nome: string | null;
};
export type NovoVinculo =
  | { tipo: 'professor_turma'; usuario_id: string; turma_id: string; disciplina_id: string }
  | { tipo: 'aluno_turma'; usuario_id: string; turma_id: string }
  | { tipo: 'responsavel_aluno'; usuario_id: string; aluno_id: string };

export type Microetapa = { id: string; texto: string; feita: boolean; ordem: number };
export type Tarefa = {
  id: string;
  titulo: string;
  descricao: string;
  disciplina: string;
  tipo: 'tarefa' | 'trabalho' | 'prova' | 'leitura';
  prazo: string | null;
  prioridade: 'baixa' | 'media' | 'alta';
  situacao: 'pendente' | 'em_andamento' | 'concluida';
  microetapas: Microetapa[];
};
export type Evento = {
  id: string;
  titulo: string;
  tipo: 'aula' | 'estudo' | 'pessoal' | 'prova';
  origem: 'manual' | 'plano';
  dia: string;
  hora_inicio: string | null;
  minutos: number | null;
  tarefa_id?: string | null;
};
export type SessaoFoco = {
  id: string;
  tarefa_id: string | null;
  tarefa_titulo: string | null;
  minutos_planejados: number;
  segundos_decorridos: number;
};
export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  lida: boolean;
  quando: string;
};
export type NotaPessoal = {
  id: string;
  disciplina: string;
  descricao: string;
  valor: number;
  dia: string;
};
// Notas oficiais (L15): lançadas e revisadas pelo professor; os outros perfis leem e pedem revisão
export type VersaoNota = {
  numero: number;
  valor: number;
  motivo: string;
  autor_nome: string;
  dia: string;
};
export type NotaOficial = {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  turma_id: string;
  turma_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
  descricao: string;
  dia: string;
  versao: number;
  valor: number;
  atualizada_em: string;
  pode_revisar: boolean;
  pedido_aberto_meu: boolean;
  versoes?: VersaoNota[]; // só professor e Admin
};
export type TurmaDoProfessor = {
  turma_id: string;
  turma_nome: string;
  ano_letivo: number;
  disciplina_id: string;
  disciplina_nome: string;
  alunos: { id: string; nome: string }[];
};
export type EstadoPedido = 'aberto' | 'revisada' | 'mantida';
export type PedidoRevisao = {
  id: string;
  nota_id: string;
  perfil_pedinte: Perfil;
  pedinte_nome: string;
  texto: string;
  estado: EstadoPedido;
  criado_em: string;
  motivo_resposta: string;
  respondido_em: string | null;
  aluno_nome: string;
  turma_nome: string;
  disciplina_nome: string;
  nota_descricao: string;
  nota_dia: string;
  valor_atual: number;
  versao_atual: number;
  pode_responder: boolean;
};
export type MeuDia = {
  hoje: string;
  atrasadas: ResumoTarefa[];
  para_hoje: ResumoTarefa[];
  proximas: ResumoTarefa[];
  eventos: Omit<Evento, 'dia'>[];
  minutos_estudados_hoje: number;
  sessao_atual: SessaoFoco | null;
  tarefas_concluidas: number;
  tarefas_total: number;
};
export type ResumoTarefa = {
  id: string;
  titulo: string;
  disciplina: string;
  prazo: string | null;
  prioridade: string;
  situacao: string;
  etapas: number;
  etapas_feitas: number;
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

async function chamar<T>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  caminho: string,
  corpo?: unknown,
): Promise<T> {
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
  turmas: () => chamar<{ turmas: TurmaLista[] }>('GET', '/turmas'),
  criarTurma: (d: { nome: string; ano_letivo: number; turno: Turno }) =>
    chamar<{ id: string }>('POST', '/turmas', d),
  inativarTurma: (id: string) => chamar<void>('POST', `/turmas/${id}/inativar`),
  reativarTurma: (id: string) => chamar<void>('POST', `/turmas/${id}/reativar`),
  disciplinas: () => chamar<{ disciplinas: DisciplinaLista[] }>('GET', '/disciplinas'),
  criarDisciplina: (d: { nome: string }) => chamar<{ id: string }>('POST', '/disciplinas', d),
  inativarDisciplina: (id: string) => chamar<void>('POST', `/disciplinas/${id}/inativar`),
  reativarDisciplina: (id: string) => chamar<void>('POST', `/disciplinas/${id}/reativar`),
  vinculos: () => chamar<{ vinculos: VinculoLista[] }>('GET', '/vinculos'),
  criarVinculo: (d: NovoVinculo) => chamar<{ id: string }>('POST', '/vinculos', d),
  inativarVinculo: (id: string) => chamar<void>('POST', `/vinculos/${id}/inativar`),
  turmasDoProfessor: () => chamar<{ turmas: TurmaDoProfessor[] }>('GET', '/professor/turmas'),
  notasOficiais: () => chamar<{ notas: NotaOficial[] }>('GET', '/notas-oficiais'),
  lancarNotaOficial: (d: {
    aluno_id: string;
    turma_id: string;
    disciplina_id: string;
    descricao?: string;
    valor: number;
    dia: string;
  }) => chamar<{ id: string }>('POST', '/notas-oficiais', d),
  revisarNota: (id: string, d: { valor: number; motivo: string; pedido_id?: string }) =>
    chamar<{ versao: number }>('POST', `/notas-oficiais/${id}/revisoes`, d),
  pedirRevisao: (id: string, texto: string) =>
    chamar<{ id: string }>('POST', `/notas-oficiais/${id}/pedidos`, { texto }),
  pedidosRevisao: () => chamar<{ pedidos: PedidoRevisao[] }>('GET', '/pedidos-revisao'),
  manterNota: (pedidoId: string, motivo: string) =>
    chamar<void>('POST', `/pedidos-revisao/${pedidoId}/manter`, { motivo }),
  meuDia: () => chamar<MeuDia>('GET', '/meu-dia'),
  tarefas: () => chamar<{ tarefas: Tarefa[] }>('GET', '/tarefas'),
  criarTarefa: (d: {
    titulo: string;
    disciplina?: string;
    tipo?: Tarefa['tipo'];
    prazo?: string | null;
    prioridade?: Tarefa['prioridade'];
    microetapas?: string[];
  }) => chamar<{ tarefa: Tarefa }>('POST', '/tarefas', d),
  atualizarTarefa: (
    id: string,
    d: Partial<Pick<Tarefa, 'titulo' | 'situacao' | 'prazo' | 'prioridade'>>,
  ) => chamar<{ tarefa: Tarefa }>('PATCH', `/tarefas/${id}`, d),
  removerTarefa: (id: string) => chamar<void>('DELETE', `/tarefas/${id}`),
  criarMicroetapa: (id: string, texto: string) =>
    chamar<{ tarefa: Tarefa }>('POST', `/tarefas/${id}/microetapas`, { texto }),
  marcarMicroetapa: (id: string, feita: boolean) =>
    chamar<{ tarefa: Tarefa }>('PATCH', `/microetapas/${id}`, { feita }),
  planejar: (id: string, d: { minutos_total: number; minutos_por_sessao: number }) =>
    chamar<{ blocos: { dia: string; minutos: number }[] }>('POST', `/tarefas/${id}/plano`, d),
  eventos: (de: string, ate: string) =>
    chamar<{ eventos: Evento[] }>('GET', `/eventos?de=${de}&ate=${ate}`),
  criarEvento: (d: {
    titulo: string;
    tipo: Evento['tipo'];
    dia: string;
    hora_inicio?: string | null;
    minutos?: number | null;
  }) => chamar<{ evento: Evento }>('POST', '/eventos', d),
  removerEvento: (id: string) => chamar<void>('DELETE', `/eventos/${id}`),
  sessaoAtual: () => chamar<{ sessao: SessaoFoco | null }>('GET', '/sessoes/atual'),
  iniciarSessao: (d: { tarefa_id?: string | null; minutos_planejados: number }) =>
    chamar<{ sessao: SessaoFoco }>('POST', '/sessoes', d),
  encerrarSessao: (id: string, situacao: 'concluida' | 'interrompida') =>
    chamar<{ minutos_reais: number }>('POST', `/sessoes/${id}/encerrar`, { situacao }),
  notas: () =>
    chamar<{
      notas: NotaPessoal[];
      medias: { disciplina: string; media: number; quantidade: number }[];
    }>('GET', '/notas-pessoais'),
  criarNota: (d: { disciplina: string; descricao?: string; valor: number; dia: string }) =>
    chamar<{ id: string }>('POST', '/notas-pessoais', d),
  removerNota: (id: string) => chamar<void>('DELETE', `/notas-pessoais/${id}`),
  notificacoes: () =>
    chamar<{ notificacoes: Notificacao[]; nao_lidas: number }>('GET', '/notificacoes'),
  lerNotificacao: (id: string) => chamar<void>('POST', `/notificacoes/${id}/lida`),
  lerTodas: () => chamar<void>('POST', '/notificacoes/lidas'),
};
