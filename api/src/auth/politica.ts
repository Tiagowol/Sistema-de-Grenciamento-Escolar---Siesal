// Quem pode administrar usuários da própria instituição. Espelha a matriz (recurso "usuarios", ação "administrar");
// o teste em verificacao/politica-coerente.test.ts garante que as duas não se separem.
export const PERFIS_CADASTRAVEIS = [
  'admin',
  'professor',
  'aluno',
  'pedagogico',
  'responsavel',
] as const;
export type PerfilCadastravel = (typeof PERFIS_CADASTRAVEIS)[number];

export function podeAdministrarUsuarios(perfil: string): boolean {
  return perfil === 'admin';
}

// Quem usa o Núcleo (tarefas, plano, agenda, notas pessoais): só o aluno, nos próprios dados.
// Espelha a matriz (tarefas/plano_regressivo/notas_pessoais, ação "administrar", escopo "proprio").
export function podeUsarNucleo(perfil: string): boolean {
  return perfil === 'aluno';
}

// Quem administra turmas, disciplinas e vínculos da própria instituição.
// Espelha a matriz v3 (recursos turmas, disciplinas e vinculos, ação "administrar").
export function podeAdministrarTurmas(perfil: string): boolean {
  return perfil === 'admin';
}

// Notas oficiais (L15). Espelham a matriz v4; o teste em verificacao/politica-coerente.test.ts garante a coerência.
export const podeLancarNota = (perfil: string): boolean => perfil === 'professor'; // lancar e revisar
export const podeLerNotas = (perfil: string): boolean =>
  ['admin', 'professor', 'aluno', 'pedagogico', 'responsavel'].includes(perfil);
export const podeVerHistoricoNotas = (perfil: string): boolean =>
  perfil === 'admin' || perfil === 'professor';
export const PERFIS_QUE_PEDEM_REVISAO = ['admin', 'aluno', 'pedagogico', 'responsavel'] as const;
export const podePedirRevisao = (perfil: string): boolean =>
  (PERFIS_QUE_PEDEM_REVISAO as readonly string[]).includes(perfil);
export const podeResponderPedido = (perfil: string): boolean => perfil === 'professor';

// Sino de mensagens e avisos curtos (L16). Espelham a matriz v5.
export const podeLerCaixa = (perfil: string): boolean =>
  ['admin', 'professor', 'aluno', 'pedagogico', 'responsavel'].includes(perfil);
export const podePublicarAviso = (perfil: string): boolean =>
  perfil === 'admin' || perfil === 'pedagogico';
export const podeLerAvisoEscolar = (perfil: string): boolean =>
  perfil === 'aluno' || perfil === 'responsavel';

// Pedido de ajuda (L17). Espelham a matriz v6: o aluno pede; professor (vínculo) e Pedagógico atendem.
export const podePedirAjuda = (perfil: string): boolean => perfil === 'aluno';
export const podeAtenderAjuda = (perfil: string): boolean =>
  perfil === 'professor' || perfil === 'pedagogico';
export const podeLerAjuda = (perfil: string): boolean =>
  ['aluno', 'professor', 'pedagogico'].includes(perfil);

// Calendário do aluno (L17a). Espelha a matriz v7: só o aluno, nos próprios eventos.
export const podeUsarCalendario = (perfil: string): boolean => perfil === 'aluno';

// Tipos de atividade do aluno e preferências por usuário (L17b). Espelham a matriz v8: só o aluno, só os próprios.
export const podeUsarTiposAtividade = (perfil: string): boolean => perfil === 'aluno';

// Conta e suporte (L17c). Espelham a matriz v9: todo perfil escolar cuida da própria conta e pede suporte;
// o Responsável (vínculo) e o Admin decidem pelo aluno menor; o Admin e o Pedagógico atendem o suporte.
const PERFIS_ESCOLARES = ['admin', 'professor', 'aluno', 'pedagogico', 'responsavel'];
export const podeAdministrarConta = (perfil: string): boolean => PERFIS_ESCOLARES.includes(perfil);
export const podeDecidirContaDeMenor = (perfil: string): boolean =>
  perfil === 'responsavel' || perfil === 'admin';
export const podePedirSuporte = (perfil: string): boolean => PERFIS_ESCOLARES.includes(perfil);
export const podeAtenderSuporte = (perfil: string): boolean =>
  perfil === 'admin' || perfil === 'pedagogico';

// Preferências de interface (L17d). Espelham a matriz v10: todo perfil escolar escolhe rótulos e VLibras para si.
export const podeAdministrarInterface = (perfil: string): boolean =>
  PERFIS_ESCOLARES.includes(perfil);

// Preferências de aparência e acessibilidade (L20a). Espelham a matriz v13: os 5 perfis escolares guardam as
// próprias preferências na conta (antes, só o aluno).
export const podeAdministrarPreferencias = (perfil: string): boolean =>
  PERFIS_ESCOLARES.includes(perfil);

// Admin institucional (L19). Espelham a matriz v11: o Admin cuida do calendário da escola, das regras de notas e
// da identidade visual; os 5 perfis escolares leem (cada um no seu alcance); só o aluno oculta item para si.
export const podeAdministrarEscola = (perfil: string): boolean => perfil === 'admin';
export const podeLerEscola = (perfil: string): boolean => PERFIS_ESCOLARES.includes(perfil);
export const podeOcultarItemEscolar = (perfil: string): boolean => perfil === 'aluno';

// Dificuldade de 0 a 10 e cards de resumo (20d). Espelham a matriz v18: o aluno marca a própria dificuldade;
// o Pedagógico/NAPNE a lê (um aluno por vez); cards são só do aluno.
export const podeAdministrarDificuldade = (perfil: string): boolean => perfil === 'aluno';
export const podeLerDificuldade = (perfil: string): boolean =>
  perfil === 'aluno' || perfil === 'pedagogico';
export const podeUsarCartoes = (perfil: string): boolean => perfil === 'aluno';
// Visão da equipe: só o Pedagógico/NAPNE lê a dificuldade de um aluno (escopo da instituição na matriz).
export const podeAcompanharAlunos = (perfil: string): boolean => perfil === 'pedagogico';

// Acompanhamento (L22a-2, matriz v19): quem libera ou encerra o acesso de professor, pedagógico e representante indicado
// aos dados do aluno. O aluno (no próprio espaço) e o representante legal (vínculo com o aluno). Quem é acompanhado entra
// pela pessoa, fora desta matriz: lê por funções do banco, um aluno por vez.
export const podeAdministrarAcompanhamento = (perfil: string): boolean =>
  perfil === 'aluno' || perfil === 'responsavel';

// Acompanhamento por código da instituição (L22a-2b, matriz v20). O Admin liga e gera o código; o Pedagógico aceita o pedido e lê
// (só o que o aluno liberou, um aluno por vez); Admin e Pedagógico encerram e renovam os vínculos da instituição.
export const podeGerirCodigoAcompanhamento = (perfil: string): boolean => perfil === 'admin';
export const podeGerirVinculosInstituicao = (perfil: string): boolean =>
  perfil === 'admin' || perfil === 'pedagogico';
export const podeAcompanharPorInstituicao = (perfil: string): boolean => perfil === 'pedagogico';

// "Meu aluno" (L22a-3, matriz v21): o representante legal lê tudo do aluno menor, só leitura. O vínculo legal é conferido no banco.
export const podeVerComoRepresentante = (perfil: string): boolean => perfil === 'responsavel';
