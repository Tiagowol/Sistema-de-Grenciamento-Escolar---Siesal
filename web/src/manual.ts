// Manual do sistema por perfil (L16e). Texto literal, passos curtos (no máximo 5), exemplos fictícios.
// Sem senha, sem endereço de acesso e sem dado real. Ao mudar uma tela, atualize o tópico e a data.
export const MANUAL_VERSAO = '1.0';
export const MANUAL_DATA = '08/11/2026';

export type Topico = {
  id: string;
  titulo: string;
  perfis: string[]; // perfis que veem o tópico; vazio = todos
  palavras: string[]; // para a busca (sem acento)
  resumo: string;
  passos: string[];
  exemplo?: string;
};

const TODOS: string[] = [];

export const TOPICOS: Topico[] = [
  {
    id: 'master-visao',
    titulo: 'Gestão da plataforma: o que o Master vê e o que não vê',
    perfis: ['master'],
    palavras: ['master', 'gestao', 'instituicao', 'arvore', 'auditoria', 'convite', 'suporte'],
    resumo:
      'O Master cuida da plataforma. Vê números, a árvore de pessoas (nome, e-mail e situação) e a trilha de ações. Não vê notas nem o conteúdo dos alunos.',
    passos: [
      'Em Instituições, crie uma instituição, mude a situação e ligue ou desligue módulos.',
      'Na Árvore, escolha uma área (por exemplo, Alunos) e depois a instituição. A leitura é apenas de consulta.',
      'Em Auditoria, confira a trilha das ações do Master e se ela está íntegra.',
      'Em Suporte, veja como pedir ajuda sobre a plataforma.',
    ],
    exemplo: 'Cada abertura da árvore fica registrada na Auditoria, sem os nomes lidos.',
  },
  {
    id: 'entrar',
    titulo: 'Entrar no sistema e trocar a senha',
    perfis: TODOS,
    palavras: ['login', 'senha', 'acesso', 'primeiro acesso', 'provisoria'],
    resumo: 'No primeiro acesso, a senha que você recebeu é provisória e precisa ser trocada.',
    passos: [
      'Abra a página do sistema e confira o nome da instituição.',
      'Escreva seu e-mail e a senha provisória e escolha Entrar.',
      'Escolha uma senha nova, longa, que só você saiba.',
      'Para sair, escolha Sair, no alto da tela.',
    ],
    exemplo: 'Exemplo fictício: aluna.exemplo@exemplo.invalid. Nunca compartilhe sua senha.',
  },
  {
    id: 'meu-dia',
    titulo: 'Meu dia: ver o que fazer agora',
    perfis: ['aluno'],
    palavras: ['hoje', 'inicio', 'resumo', 'prazo passou'],
    resumo: 'A tela Meu dia mostra o que tem prazo, o que vem a seguir e o que já foi feito.',
    passos: [
      'Escolha Meu dia no menu.',
      'Leia os quadros: Prazo passou, Para hoje, Próximos 7 dias e Atividades concluídas.',
      'Escolha uma atividade para ver os detalhes.',
      'Você não precisa fazer tudo hoje. Escolha uma coisa de cada vez.',
    ],
  },
  {
    id: 'atividade',
    titulo: 'Criar uma atividade e marcar como concluída',
    perfis: ['aluno'],
    palavras: ['tarefa', 'licao', 'dever', 'prazo', 'etapas', 'concluir'],
    resumo: 'Atividades são os seus afazeres. Você pode dividir cada uma em pequenas etapas.',
    passos: [
      'Escolha Atividades no menu e depois Nova atividade.',
      'Escreva o nome, a disciplina e o prazo (dia e mês).',
      'Se quiser, escreva pequenas etapas, uma por linha.',
      'Escolha Salvar atividade.',
      'Quando terminar, escolha Marcar como concluída.',
    ],
    exemplo: 'Exemplo fictício: Lista de exercícios, Matemática, prazo 15/11.',
  },
  {
    id: 'plano',
    titulo: 'Montar um plano de estudo em blocos',
    perfis: ['aluno'],
    palavras: ['plano', 'bloco', 'blocos', 'curto', 'medio', 'longo', 'agenda', 'estudar'],
    resumo:
      'O plano divide o estudo em blocos até o prazo. Você escolhe o tamanho e a quantidade de blocos.',
    passos: [
      'Em Atividades, abra a atividade e escolha Ver etapas e plano.',
      'Escolha o tamanho do bloco: Curto, Médio ou Longo.',
      'Escolha quantos blocos quer.',
      'Leia o resumo antes de salvar: quantos blocos, quantos minutos e em quais dias.',
      'Escolha Montar plano.',
    ],
    exemplo:
      'Se há menos dias do que blocos, alguns blocos ficam juntos no mesmo dia. O resumo avisa antes de salvar.',
  },
  {
    id: 'foco',
    titulo: 'Modo foco',
    perfis: ['aluno'],
    palavras: ['concentrar', 'concentracao', 'cronometro', 'timer', 'parar', 'estudar'],
    resumo: 'O modo foco ajuda a estudar um bloco de cada vez. Não tem som nem pontuação.',
    passos: [
      'Escolha Modo foco no menu.',
      'Escolha o bloco: Curto, Médio ou Longo.',
      'Escolha a atividade, se quiser, e depois Iniciar foco.',
      'Uma forma vai diminuindo. Os números ficam ocultos, se você preferir.',
      'Para encerrar, escolha Parar por agora. Não há punição.',
    ],
  },
  {
    id: 'agenda',
    titulo: 'Agenda: compromissos e blocos de estudo',
    perfis: ['aluno'],
    palavras: ['calendario', 'compromisso', 'semana', 'horario', 'dia'],
    resumo: 'A agenda mostra a semana com compromissos e blocos de estudo.',
    passos: [
      'Escolha Agenda no menu.',
      'Escolha um dia para ver o que há nele.',
      'Para criar, preencha Novo compromisso e escolha Salvar compromisso.',
    ],
  },
  {
    id: 'notas-pessoais',
    titulo: 'Minhas notas (anotações suas)',
    perfis: ['aluno'],
    palavras: ['anotar', 'media', 'desempenho'],
    resumo:
      'Em Notas você anota as suas notas para acompanhar. Elas não substituem as notas oficiais.',
    passos: [
      'Escolha Notas no menu.',
      'Escolha a disciplina e escreva a nota.',
      'Salve. A tela mostra uma barra por disciplina.',
    ],
  },
  {
    id: 'notas-oficiais-aluno',
    titulo: 'Notas oficiais e pedido de revisão',
    perfis: ['aluno', 'responsavel'],
    palavras: ['boletim', 'prova', 'revisao', 'pedir revisao', 'nota oficial'],
    resumo:
      'Notas oficiais são as lançadas pelo professor. Se achar que há um engano, você pode pedir revisão. O professor decide.',
    passos: [
      'Escolha Notas oficiais no menu.',
      'Ache a nota e escolha Pedir revisão.',
      'Escreva o motivo com suas palavras (até 300 letras).',
      'Escolha Enviar pedido de revisão.',
      'Acompanhe a resposta em Meus pedidos de revisão e no sino Mensagens.',
    ],
    exemplo:
      'A resposta mostra só o estado (revisada ou mantida), a nota atual e a data em dia e mês. Pedir revisão não obriga a mudar a nota.',
  },
  {
    id: 'sinos',
    titulo: 'Os dois sinos: Mensagens e Prazos',
    perfis: ['aluno'],
    palavras: ['sino', 'mensagens', 'prazos', 'aviso', 'notificacao'],
    resumo:
      'O sino amarelo é Mensagens. O sino azul é Prazos. Cada um tem nome e desenho diferentes.',
    passos: [
      'Escolha Mensagens para ver pedidos de revisão, respostas e avisos da escola.',
      'Escolha Prazos para ver atividades de hoje e de amanhã.',
      'Para fechar o painel, aperte Esc ou escolha o sino de novo.',
    ],
  },
  {
    id: 'sino-mensagens',
    titulo: 'Sino Mensagens',
    perfis: ['responsavel', 'professor', 'pedagogico', 'admin'],
    palavras: ['sino', 'mensagens', 'aviso', 'pedidos', 'notificacao'],
    resumo: 'O sino Mensagens mostra pedidos, respostas e avisos que dizem respeito a você.',
    passos: [
      'Escolha Mensagens, no alto da tela.',
      'Leia os itens novos. O número mostra quantos você ainda não viu.',
      'Para fechar o painel, aperte Esc.',
    ],
  },
  {
    id: 'responsavel-notas',
    titulo: 'Ver as notas do aluno vinculado',
    perfis: ['responsavel'],
    palavras: ['filho', 'filha', 'aluno', 'notas', 'vinculo', 'pedir revisao'],
    resumo: 'Você vê as notas oficiais do aluno ao qual está vinculado, e só dele.',
    passos: [
      'Escolha Notas oficiais no menu.',
      'Leia a nota atual e a data.',
      'Se houver dúvida, escolha Pedir revisão e escreva o motivo.',
    ],
    exemplo: 'Se não aparece nenhuma nota, a administração precisa fazer o vínculo com o aluno.',
  },
  {
    id: 'professor-lancar',
    titulo: 'Lançar e revisar notas da turma',
    perfis: ['professor'],
    palavras: ['lancar', 'nota', 'revisar', 'turma', 'disciplina', 'versao'],
    resumo:
      'Você lança notas nas turmas e disciplinas em que está vinculado. Cada revisão cria uma nova versão.',
    passos: [
      'Escolha Notas da turma no menu e escolha a turma e a disciplina.',
      'Em Lançar nota, escolha o aluno e escreva a nota de 0 a 10.',
      'Escolha Lançar nota.',
      'Para mudar uma nota, escolha Revisar a nota, escreva a nova nota e o motivo.',
    ],
    exemplo: 'O histórico de versões fica visível só para você e para a administração.',
  },
  {
    id: 'professor-pedidos',
    titulo: 'Responder pedidos de revisão',
    perfis: ['professor'],
    palavras: ['pedido', 'revisao', 'manter', 'fechar juntos', 'resposta'],
    resumo: 'Você pode revisar a nota ou manter a nota. Nos dois casos, o motivo é obrigatório.',
    passos: [
      'Abra Pedidos de revisão abertos.',
      'Escolha Revisar a nota (nova nota e motivo) ou Manter a nota (motivo).',
      'Ao revisar, os outros pedidos abertos da mesma nota são fechados juntos, ligados à nova versão.',
      'Quem pediu vê só o estado, a nota atual e a data. O motivo da revisão não aparece para eles.',
    ],
    exemplo: 'O motivo de "manter a nota" aparece só para quem fez o pedido e para você.',
  },
  {
    id: 'pedagogico-notas',
    titulo: 'Ver notas (Pedagógico e apoio)',
    perfis: ['pedagogico'],
    palavras: ['notas', 'acompanhar', 'apoio'],
    resumo: 'Você vê a nota atual dos alunos. Não vê o motivo das revisões nem as versões antigas.',
    passos: [
      'Escolha Notas oficiais no menu.',
      'Leia a nota atual e a data.',
      'Para falar com o aluno ou a família, use o canal combinado pela escola.',
    ],
  },
  {
    id: 'aviso-escolar',
    titulo: 'Publicar um aviso curto',
    perfis: ['pedagogico', 'admin'],
    palavras: ['aviso', 'comunicado', 'mensagem', 'publicar', 'turma'],
    resumo: 'O aviso é curto (até 300 letras), só de leitura, sem link, sem anexo e sem resposta.',
    passos: [
      'Escolha Avisos da escola no menu.',
      'Pedagógico: escolha a turma. Administração: o aviso vale para a escola inteira.',
      'Escreva o texto, sem endereços de internet.',
      'Escolha Publicar aviso.',
      'Para retirar, escolha Desativar aviso. Nada é apagado de verdade.',
    ],
  },
  {
    id: 'admin-usuarios',
    titulo: 'Usuários, turmas e vínculos',
    perfis: ['admin'],
    palavras: ['usuario', 'conta', 'senha provisoria', 'turma', 'vinculo', 'disciplina', 'totp'],
    resumo:
      'A administração cria as contas, as turmas e os vínculos. A senha provisória é mostrada uma vez.',
    passos: [
      'Escolha Usuários para criar uma conta e anote a senha provisória na hora.',
      'Escolha Turmas e vínculos para criar turmas e disciplinas.',
      'Faça os vínculos: professor com turma e disciplina, aluno com turma, responsável com aluno.',
      'Na primeira entrada, a administração configura o código do aplicativo autenticador (TOTP).',
    ],
  },
  {
    id: 'acessibilidade',
    titulo: 'Acessibilidade: letra, cores e movimento',
    perfis: TODOS,
    palavras: [
      'fonte',
      'letra',
      'tema escuro',
      'contraste',
      'movimento',
      'leitura facilitada',
      'tempo visual',
      'configuracoes',
    ],
    resumo: 'Os ajustes ficam salvos neste aparelho. Você pode ligar e desligar quando quiser.',
    passos: [
      'Escolha Acessibilidade no menu (ou busque por "fonte" na busca do menu).',
      'Ligue ou desligue: tema escuro, alto contraste, leitura facilitada, reduzir movimento e mostrar o tempo de forma visual.',
      'Mude o tamanho da letra de 90% a 150%.',
    ],
  },
  {
    id: 'menu-busca',
    titulo: 'Buscar no menu e recolher o menu',
    perfis: TODOS,
    palavras: ['busca', 'procurar', 'menu', 'recolher', 'barra lateral'],
    resumo: 'A busca ajuda a achar telas e configurações. O menu pode ser recolhido no computador.',
    passos: [
      'No menu, escreva uma palavra em Buscar no menu. Não precisa de acento.',
      'Escolha o resultado. Aperte Esc para limpar a busca.',
      'No computador, escolha Recolher menu para ter mais espaço, e Mostrar menu para voltar.',
    ],
  },
  {
    id: 'problemas',
    titulo: 'Quando algo não funciona',
    perfis: TODOS,
    palavras: ['erro', 'nao consigo', 'senha esquecida', 'sessao', 'ajuda', 'bloqueada'],
    resumo: 'Algumas situações comuns e o que fazer.',
    passos: [
      'Sessão vencida: entre de novo.',
      'Errou a senha várias vezes: a conta fica bloqueada por 15 minutos. Espere e tente de novo.',
      'Esqueceu a senha: peça uma nova senha provisória à administração da escola.',
      'Não vê uma tela ou um botão: seu perfil pode não ter essa permissão. Fale com a escola.',
    ],
  },
  {
    id: 'limites',
    titulo: 'O que o sistema não faz',
    perfis: TODOS,
    palavras: ['clinico', 'diagnostico', 'ranking', 'privacidade', 'comparacao'],
    resumo: 'O SIESAL apoia o estudo. Não é ferramenta clínica.',
    passos: [
      'Não faz diagnóstico.',
      'Não faz ranking nem compara alunos.',
      'Mostra a cada pessoa só o que o seu perfil pode ver.',
    ],
  },
];

export const topicosDoPerfil = (perfil: string): Topico[] =>
  TOPICOS.filter((t) => t.perfis.length === 0 || t.perfis.includes(perfil));
