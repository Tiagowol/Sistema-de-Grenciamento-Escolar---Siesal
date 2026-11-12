// Cliente da API. Tudo passa por /api (nginx em produção, proxy do Vite em desenvolvimento).
export type Nivel = 'completo' | 'configurar_totp' | 'trocar_senha';
export type Perfil = 'admin' | 'professor' | 'aluno' | 'pedagogico' | 'responsavel';
// L20: módulos que o Master liga e desliga por escola (sem a informação, tudo ligado)
export type Modulo = 'mensagens' | 'calendario' | 'apoio_aluno';
export type EstadoModulos = Record<Modulo, boolean>;
export type Eu = {
  nivel: Nivel;
  usuario: { id: string; nome: string; perfil: Perfil };
  modulos?: EstadoModulos;
  // 20c-1: aluno sem instituição usa um espaço individual (sem turmas, notas oficiais nem avisos da escola)
  espaco?: 'escola' | 'individual';
};
// 20c-2: cadastro com data de nascimento e CPF (opcional); menor de 18 anos informa o responsável
export type NovoCadastro = {
  codigo: string;
  nome: string;
  email: string;
  senha: string;
  nascimento: string;
  cpf?: string;
  matricula?: string;
  escolas?: string;
  responsavel?: { nome: string; cpf: string; nascimento: string; email: string };
};
export type CadastroAguardando = {
  aguardando_responsavel: true;
  email_enviado: boolean;
  expira_em: string;
};
export type PedidoDoResponsavel = {
  aluno: string;
  responsavel: string;
  expiraEm: string;
  termo: { versao: string; caixas: string[] };
};
export type DadosCadastro =
  | { cadastrado: false }
  | {
      cadastrado: true;
      nascimento: string;
      cpf: string | null;
      matricula: string | null;
      escolas: string | null;
    };
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
  tipo_atividade_id?: string | null;
  disciplina_aluno_id?: string | null;
  dificuldade?: number | null; // 20d: percepção do aluno, de 0 a 10
};
// Disciplinas do aluno (L20b)
export type DisciplinaCatalogo = {
  id: number;
  nome: string;
  etapas: string[];
  gerais_em: string[];
  curso: string | null;
  sinonimos: string[];
};
export type DisciplinaAluno = {
  id: string;
  nome: string;
  origem: 'catalogo' | 'propria' | 'escola' | 'suap';
  catalogo_id: number | null;
  dificuldade?: number | null; // 20d
};
// 20d: cards de resumo e visão do Apoio Pedagógico
export type ModeloCartao = 'conceito' | 'passo_a_passo' | 'formula' | 'pergunta_resposta';
export type Cartao = {
  id: string;
  modelo: ModeloCartao;
  titulo: string;
  frente: string;
  verso: string;
  tarefa_id: string | null;
  disciplina_id: string | null;
  tarefa_titulo: string | null;
  disciplina_nome: string | null;
};
export type NovoCartao = {
  modelo: ModeloCartao;
  titulo: string;
  frente: string;
  verso: string;
  tarefa_id?: string;
  disciplina_id?: string;
};
export type DificuldadesDoAluno = {
  aluno: { id: string; nome: string };
  disciplinas: { id: string; nome: string; dificuldade: number }[];
  tarefas: {
    id: string;
    titulo: string;
    disciplina: string;
    prazo: string | null;
    situacao: Tarefa['situacao'];
    dificuldade: number;
  }[];
};
export type EtapaDisciplinas = 'fundamental' | 'medio' | 'tecnico';
export type TipoAtividade = { id: string; nome: string; cor: string; icone: string };
export type PreferenciasServidor = {
  apelido: string | null;
  cor_destaque: string | null;
  tema: 'claro' | 'escuro' | 'alto_contraste' | 'alto_contraste_escuro';
  fonte: number;
  reduzir_movimento: boolean;
  leitura_facilitada: boolean;
  modo_simples: boolean;
  tempo_visual: boolean;
  linguagem_curta: boolean;
  escolha_agora: boolean;
  tela_inicial: 'meudia' | 'agenda' | 'calendario';
  minutos_curto: number;
  minutos_medio: number;
  minutos_longo: number;
};
export type Evento = {
  id: string;
  titulo: string;
  // Os 3 últimos tipos só chegam do calendário da escola (L19); o aluno não cria evento com eles
  tipo:
    | 'aula'
    | 'estudo'
    | 'pessoal'
    | 'prova'
    | 'trabalho'
    | 'lembrete'
    | 'compromisso'
    | 'periodo_letivo'
    | 'feriado'
    | 'evento_escolar';
  origem: 'manual' | 'plano' | 'google_agenda' | 'google_sala_de_aula' | 'calendario_escolar';
  item_id?: string; // item do calendário da escola (para ocultar)
  turma_nome?: string | null;
  id_externo?: string | null;
  tipo_atividade_id?: string | null;
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
  regra_numero?: number | null; // L19: versão da regra de notas citada no lançamento
};
// Admin institucional (L19): calendário da escola, regras de notas e identidade visual
export type TipoItemEscolar = 'periodo_letivo' | 'feriado' | 'evento';
export type ItemEscolar = {
  id: string;
  tipo: TipoItemEscolar;
  titulo: string;
  dia_inicio: string;
  dia_fim: string;
  turma_id: string | null;
  turma_nome: string | null;
};
export type NovoItemEscolar = Omit<ItemEscolar, 'id' | 'turma_nome'>;
export type Arredondamento = 'nenhum' | 'decimo' | 'meio';
export type PeriodoRegra = { nome: string; inicio: string; fim: string; peso: number };
export type RegraNota = {
  numero: number;
  vigente_desde: string;
  arredondamento: Arredondamento;
  periodos: PeriodoRegra[];
};
export type VersaoRegra = RegraNota & { autor_nome: string; criada_em: string };
export type MediaDoAluno = {
  aluno_id: string;
  disciplina_id: string;
  disciplina_nome: string;
  periodos: (PeriodoRegra & { media: number | null })[];
  final: number | null;
};
export type Identidade = {
  numero: number;
  nome_exibicao: string;
  cor_claro: string | null;
  cor_escuro: string | null;
  tem_logotipo: boolean;
};
export type VersaoIdentidade = Identidade & { autor_nome: string; criada_em: string };
export type NovaIdentidade = {
  nome_exibicao: string;
  cor_claro: string | null;
  cor_escuro: string | null;
  logotipo: 'manter' | null | { tipo: 'image/png' | 'image/jpeg'; dados: string };
};
export const URL_LOGOTIPO = '/api/escola/identidade/logotipo';
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
  versao_atual: number | null; // só o professor recebe
  pode_responder: boolean;
};

// Sino "Mensagens" (L16): pedidos (professor), respostas e avisos curtos. Nunca traz motivo de revisão nem versões antigas.
type ItemBase = { id: string; visto: boolean; dia: string };
export type ItemPedidoAberto = ItemBase & {
  tipo: 'pedido_aberto';
  perfil_pedinte: Perfil;
  pedinte_nome: string;
  texto: string;
  aluno_nome: string;
  turma_nome: string;
  disciplina_nome: string;
  nota_descricao: string;
  valor_atual: number;
  pode_responder: boolean;
};
export type ItemResposta = ItemBase & {
  tipo: 'resposta';
  estado: 'revisada' | 'mantida';
  motivo: string; // só em "mantida"
  aluno_nome: string;
  disciplina_nome: string;
  nota_descricao: string;
  valor_atual: number;
};
export type ItemAviso = ItemBase & {
  tipo: 'aviso';
  escopo: 'turma' | 'instituicao';
  turma_nome: string | null;
  texto: string;
  autor_nome: string;
};
// Pedido de ajuda (L17): "ajuda_aberta" chega ao professor ou ao Pedagógico; "ajuda_minha" é do próprio aluno
export type MotivoAjuda = 'nao_entendi' | 'nao_sei_comecar' | 'preciso_tempo' | 'outro';
type CamposAjuda = {
  destino: 'professor' | 'pedagogico';
  motivo: MotivoAjuda;
  texto: string;
  disciplina_nome: string | null;
  tarefa_titulo: string | null;
  etapa_texto: string | null;
};
export type ItemAjudaAberta = ItemBase &
  CamposAjuda & { tipo: 'ajuda_aberta'; aluno_nome: string; turma_nome: string | null };
export type ItemAjudaMinha = ItemBase &
  CamposAjuda & {
    tipo: 'ajuda_minha';
    estado: 'aberto' | 'atendido';
    resposta: string;
    professor_nome: string | null;
    atendido_por_nome: string | null;
  };
export type ItemSuporteAberto = ItemBase & {
  tipo: 'suporte_aberto';
  assunto: string;
  assunto_rotulo: string;
  texto: string;
  autor_nome: string;
  autor_perfil: Perfil;
};
// Preferências de interface (L17d): rótulos do topo e VLibras, por usuário, nos 5 perfis
export type InterfaceServidor = {
  rotulos: 'icones' | 'texto';
  vlibras: boolean;
  vlibras_aviso_aceito: boolean;
};
export type ContaDados = {
  conta: { nome: string; email: string; perfil: Perfil; menor: boolean };
  pedidos: {
    id: string;
    tipo: 'email' | 'encerramento';
    email_novo: string | null;
    exige_aprovacao: boolean;
    dia: string;
  }[];
  decisoes: {
    id: string;
    tipo: 'email' | 'encerramento';
    email_novo: string | null;
    aluno_nome: string;
    dia: string;
  }[];
};
export type ItemCaixa =
  | ItemSuporteAberto
  | ItemPedidoAberto
  | ItemResposta
  | ItemAviso
  | ItemAjudaAberta
  | ItemAjudaMinha;
export type DestinoProfessor = {
  professor_id: string;
  professor_nome: string;
  turma_id: string;
  turma_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
};
export type NovoPedidoAjuda = {
  motivo: MotivoAjuda;
  texto?: string;
  tarefa_id?: string;
  microetapa_id?: string;
} & (
  | { destino: 'professor'; professor_id: string; turma_id: string; disciplina_id: string }
  | { destino: 'pedagogico' }
);
export type Caixa = { itens: ItemCaixa[]; nao_vistos: number };
export type AvisoPublicado = {
  id: string;
  escopo: 'turma' | 'instituicao';
  turma_nome: string | null;
  texto: string;
  autor_nome: string;
  dia: string;
  ativo: boolean;
};
export type TurmaParaAviso = { id: string; nome: string; ano_letivo: number };
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
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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
  login: (
    d:
      | { instituicao_id: string; email: string; senha: string; codigo?: string }
      | { sem_instituicao: true; email: string; senha: string; codigo?: string },
  ) => chamar<Eu>('POST', '/auth/login', d),
  criarContaIndividual: (d: NovoCadastro) =>
    chamar<Eu | { criada: true } | CadastroAguardando>('POST', '/auth/criar-conta-individual', d),
  // 20c-2: o responsável abre o link do e-mail, lê o termo e confirma
  consultarResponsavel: (token: string) =>
    chamar<PedidoDoResponsavel>('POST', '/auth/responsavel/consultar', { token }),
  confirmarResponsavel: (token: string, aceites: boolean[]) =>
    chamar<{ confirmado: true }>('POST', '/auth/responsavel/confirmar', { token, aceites }),
  dadosCadastro: () => chamar<DadosCadastro>('GET', '/conta/dados-cadastro'),
  criarInstituicao: (d: {
    codigo: string;
    instituicao: string;
    nome: string;
    email: string;
    senha: string;
  }) => chamar<Eu | { criada: true }>('POST', '/auth/criar-instituicao', d),
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
  notasOficiais: () =>
    chamar<{ notas: NotaOficial[]; regra?: RegraNota | null; medias?: MediaDoAluno[] }>(
      'GET',
      '/notas-oficiais',
    ),
  calendarioEscola: (de: string, ate: string) =>
    chamar<{ itens: ItemEscolar[] }>('GET', `/escola/calendario?de=${de}&ate=${ate}`),
  criarItemEscolar: (d: NovoItemEscolar) => chamar<{ id: string }>('POST', '/escola/calendario', d),
  editarItemEscolar: (id: string, d: NovoItemEscolar) =>
    chamar<void>('POST', `/escola/calendario/${id}`, d),
  desativarItemEscolar: (id: string) => chamar<void>('POST', `/escola/calendario/${id}/desativar`),
  ocultarItemEscolar: (id: string) => chamar<void>('POST', `/escola/calendario/${id}/ocultar`),
  regrasNotas: () =>
    chamar<{ vigente: RegraNota | null; versoes: VersaoRegra[] }>('GET', '/escola/regras-notas'),
  criarRegraNota: (d: Omit<RegraNota, 'numero'>) =>
    chamar<{ numero: number }>('POST', '/escola/regras-notas', d),
  identidade: () =>
    chamar<{ identidade: Identidade | null; versoes: VersaoIdentidade[] }>(
      'GET',
      '/escola/identidade',
    ),
  salvarIdentidade: (d: NovaIdentidade) =>
    chamar<{ identidade: Identidade }>('POST', '/escola/identidade', d),
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
  caixa: () => chamar<Caixa>('GET', '/caixa'),
  marcarVistos: () => chamar<{ marcados: number }>('POST', '/caixa/vistos'),
  destinosAjuda: () =>
    chamar<{ professores: DestinoProfessor[]; equipe_pedagogica: boolean }>(
      'GET',
      '/ajuda/destinos',
    ),
  pedirAjuda: (d: NovoPedidoAjuda) => chamar<{ id: string }>('POST', '/ajuda', d),
  conta: () => chamar<ContaDados>('GET', '/conta'),
  interfaceServidor: () => chamar<{ interface: InterfaceServidor }>('GET', '/conta/interface'),
  salvarInterfaceServidor: (d: InterfaceServidor) =>
    chamar<{ interface: InterfaceServidor }>('POST', '/conta/interface', d),
  pedirTrocaEmail: (d: { email_novo: string; senha_atual: string }) =>
    chamar<{ pedido: { id: string } }>('POST', '/conta/email', d),
  pedirEncerramento: (d: { senha_atual: string }) =>
    chamar<{ pedido: { id: string } }>('POST', '/conta/encerrar', d),
  confirmarPedidoConta: (id: string) => chamar<void>('POST', `/conta/pedidos/${id}/confirmar`),
  cancelarPedidoConta: (id: string) => chamar<void>('POST', `/conta/pedidos/${id}/cancelar`),
  decidirPedidoConta: (id: string, aprovar: boolean) =>
    chamar<void>('POST', `/conta/pedidos/${id}/decidir`, { aprovar }),
  pedirSuporte: (d: { assunto: string; texto: string }) =>
    chamar<{ pedido: { id: string } }>('POST', '/suporte', d),
  atenderSuporte: (id: string) => chamar<void>('POST', `/suporte/${id}/atender`),
  atenderAjuda: (id: string, resposta?: string) =>
    chamar<void>('POST', `/ajuda/${id}/atender`, resposta ? { resposta } : {}),
  avisosPublicados: () => chamar<{ avisos: AvisoPublicado[] }>('GET', '/avisos-escolares'),
  turmasParaAviso: () => chamar<{ turmas: TurmaParaAviso[] }>('GET', '/avisos-escolares/turmas'),
  publicarAviso: (d: { texto: string; turma_id?: string }) =>
    chamar<{ id: string }>('POST', '/avisos-escolares', d),
  desativarAviso: (id: string) => chamar<void>('POST', `/avisos-escolares/${id}/desativar`),
  meuDia: () => chamar<MeuDia>('GET', '/meu-dia'),
  tarefas: () => chamar<{ tarefas: Tarefa[] }>('GET', '/tarefas'),
  criarTarefa: (d: {
    titulo: string;
    disciplina?: string;
    disciplina_id?: string | null;
    tipo?: Tarefa['tipo'];
    prazo?: string | null;
    prioridade?: Tarefa['prioridade'];
    microetapas?: string[];
    tipo_atividade_id?: string | null;
    dificuldade?: number | null;
  }) => chamar<{ tarefa: Tarefa }>('POST', '/tarefas', d),
  atualizarTarefa: (
    id: string,
    d: Partial<Pick<Tarefa, 'titulo' | 'situacao' | 'prazo' | 'prioridade' | 'dificuldade'>>,
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
    tipo_atividade_id?: string | null;
    tarefa_id?: string | null; // 20d: atividade colocada na grade do dia
  }) => chamar<{ evento: Evento }>('POST', '/eventos', d),
  preferenciasServidor: () =>
    chamar<{ preferencias: PreferenciasServidor | null }>('GET', '/preferencias'),
  salvarPreferenciasServidor: (d: PreferenciasServidor) =>
    chamar<{ preferencias: PreferenciasServidor }>('PUT', '/preferencias', d),
  preferenciasPadrao: () =>
    chamar<{ preferencias: PreferenciasServidor }>('POST', '/preferencias/padrao'),
  tiposAtividade: () => chamar<{ tipos: TipoAtividade[] }>('GET', '/tipos-atividade'),
  criarTipoAtividade: (d: { nome: string; cor: string; icone: string }) =>
    chamar<{ tipo: TipoAtividade }>('POST', '/tipos-atividade', d),
  removerTipoAtividade: (id: string) => chamar<void>('DELETE', `/tipos-atividade/${id}`),
  editarEvento: (
    id: string,
    d: {
      titulo: string;
      tipo: Evento['tipo'];
      dia: string;
      hora_inicio?: string | null;
      minutos?: number | null;
      tipo_atividade_id?: string | null;
    },
  ) => chamar<{ evento: Evento }>('PATCH', `/eventos/${id}`, d),
  ocultarEvento: (id: string) => chamar<void>('POST', `/eventos/${id}/ocultar`),
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
  minhasDisciplinas: () =>
    chamar<{
      etapa: EtapaDisciplinas | null;
      catalogo: DisciplinaCatalogo[];
      minhas: DisciplinaAluno[];
      limite_proprias: number;
    }>('GET', '/minhas-disciplinas'),
  escolherEtapaDisciplinas: (etapa: EtapaDisciplinas) =>
    chamar<{ etapa: EtapaDisciplinas; marcadas: number; minhas: DisciplinaAluno[] }>(
      'POST',
      '/minhas-disciplinas/etapa',
      { etapa },
    ),
  disciplinasDaEscola: () =>
    chamar<{ novas: number; minhas: DisciplinaAluno[] }>('POST', '/minhas-disciplinas/da-escola'),
  criarMinhaDisciplina: (d: { catalogo_id: number } | { nome: string }) =>
    chamar<{ disciplina: DisciplinaAluno }>('POST', '/minhas-disciplinas', d),
  corrigirMinhaDisciplina: (id: string, nome: string) =>
    chamar<{ disciplina: DisciplinaAluno }>('PATCH', `/minhas-disciplinas/${id}`, { nome }),
  removerMinhaDisciplina: (id: string) => chamar<void>('DELETE', `/minhas-disciplinas/${id}`),
  // 20d: dificuldade da disciplina (o aluno marca; null limpa)
  dificuldadeDaDisciplina: (id: string, dificuldade: number | null) =>
    chamar<{ id: string; dificuldade: number | null }>(
      'PUT',
      `/minhas-disciplinas/${id}/dificuldade`,
      { dificuldade },
    ),
  // 20d: visão do Apoio Pedagógico/NAPNE, um aluno por vez
  apoioAlunos: () => chamar<{ alunos: { id: string; nome: string }[] }>('GET', '/apoio/alunos'),
  apoioDificuldades: (id: string) =>
    chamar<DificuldadesDoAluno>('GET', `/apoio/alunos/${id}/dificuldades`),
  // 20d: cards de resumo (só do aluno)
  cartoes: (filtro: { tarefa_id?: string; disciplina_id?: string } = {}) => {
    const q = new URLSearchParams(filtro as Record<string, string>).toString();
    return chamar<{ limite: number; cartoes: Cartao[] }>(
      'GET',
      `/cartoes-resumo${q ? `?${q}` : ''}`,
    );
  },
  criarCartao: (d: NovoCartao) => chamar<{ cartao: Cartao }>('POST', '/cartoes-resumo', d),
  editarCartao: (id: string, d: Partial<Pick<Cartao, 'modelo' | 'titulo' | 'frente' | 'verso'>>) =>
    chamar<{ cartao: Cartao }>('PATCH', `/cartoes-resumo/${id}`, d),
  removerCartao: (id: string) => chamar<void>('DELETE', `/cartoes-resumo/${id}`),
  criarNota: (d: {
    disciplina?: string;
    disciplina_id?: string | null;
    descricao?: string;
    valor: number;
    dia: string;
  }) => chamar<{ id: string }>('POST', '/notas-pessoais', d),
  removerNota: (id: string) => chamar<void>('DELETE', `/notas-pessoais/${id}`),
  notificacoes: () =>
    chamar<{ notificacoes: Notificacao[]; nao_lidas: number }>('GET', '/notificacoes'),
  lerNotificacao: (id: string) => chamar<void>('POST', `/notificacoes/${id}/lida`),
  lerTodas: () => chamar<void>('POST', '/notificacoes/lidas'),
};

// L18: Masters (/operacao). Rotas e cookie próprios; nada daqui toca em dado escolar.
export type NivelOperacao = 'completo' | 'configurar_totp';
export type EuOperacao = { nivel: NivelOperacao; usuario: string };
export type Situacao = 'em_implantacao' | 'ativa' | 'suspensa' | 'encerrada';
export type InstituicaoLista = {
  id: string;
  nome: string;
  situacao: Situacao;
  criado_em: string;
};
// L20: painel com módulos e contagens por perfil (só números)
export type InstituicaoPainel = InstituicaoLista & {
  modulos: EstadoModulos;
  contagem: Partial<Record<Perfil, number>>;
};
export type EventoMaster = {
  seq: number;
  ator: string;
  acao: string;
  alvo: string;
  criado_em: string;
};
export const apiOperacao = {
  eu: () => chamar<EuOperacao>('GET', '/operacao/eu'),
  login: (d: { usuario: string; senha: string; codigo?: string }) =>
    chamar<EuOperacao>('POST', '/operacao/login', d),
  primeiroAcesso: (d: { usuario: string; convite: string; senha_nova: string }) =>
    chamar<EuOperacao>('POST', '/operacao/primeiro-acesso', d),
  logout: () => chamar<void>('POST', '/operacao/logout'),
  iniciarTotp: () => chamar<{ segredo: string; uri: string }>('POST', '/operacao/totp/iniciar'),
  confirmarTotp: (codigo: string) =>
    chamar<{ nivel: NivelOperacao }>('POST', '/operacao/totp/confirmar', { codigo }),
  instituicoes: () => chamar<{ instituicoes: InstituicaoLista[] }>('GET', '/operacao/instituicoes'),
  criarInstituicao: (nome: string) =>
    chamar<{ instituicao: InstituicaoLista }>('POST', '/operacao/instituicoes', { nome }),
  suspender: (id: string) => chamar<void>('POST', `/operacao/instituicoes/${id}/suspender`),
  reativar: (id: string) => chamar<void>('POST', `/operacao/instituicoes/${id}/reativar`),
  gerarConvite: () =>
    chamar<{ codigo: string; expira_em: string }>('POST', '/operacao/convites-individuais'),
  gerarConviteInstituicao: () =>
    chamar<{ codigo: string; expira_em: string }>('POST', '/operacao/convites-instituicao'),
  resumoConvites: () =>
    chamar<{
      pendentes: number;
      usados: number;
      vencidos: number;
      instituicao?: { pendentes: number; usados: number; vencidos: number };
    }>('GET', '/operacao/convites-individuais'),
  painel: () =>
    chamar<{ instituicoes: InstituicaoPainel[]; espacos_individuais: number }>(
      'GET',
      '/operacao/painel',
    ),
  mudarSituacao: (id: string, situacao: Situacao, confirmar_nome?: string) =>
    chamar<void>('POST', `/operacao/instituicoes/${id}/situacao`, {
      situacao,
      ...(confirmar_nome === undefined ? {} : { confirmar_nome }),
    }),
  mudarModulo: (id: string, modulo: Modulo, ligado: boolean) =>
    chamar<void>('POST', `/operacao/instituicoes/${id}/modulos`, { modulo, ligado }),
  trilha: () => chamar<{ integra: boolean; eventos: EventoMaster[] }>('GET', '/operacao/auditoria'),
};
