// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaixaAmbiente } from './componentes/FaixaAmbiente';
import { Operacao } from './paginas/Operacao';

// L18 e L20: entrada dos Masters (/operacao): entrar, primeiro acesso, TOTP e painel de instituições. Dados fictícios.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TRILHA = {
  integra: true,
  eventos: [
    {
      seq: 1,
      ator: 'master:master_um',
      acao: 'instituicao.criada',
      alvo: 'instituicao:i1',
      criado_em: '2026-11-10T12:00:00.000Z',
    },
  ],
};
const semContraste = { rules: { 'color-contrast': { enabled: false } } };
type Rota = { status?: number; corpo?: unknown };

function simular(rotas: Record<string, Rota>) {
  const chamadas: { metodo: string; url: string; corpo: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      const caminho = url.replace('/api', '');
      chamadas.push({
        metodo,
        url: caminho,
        corpo: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const r = rotas[`${metodo} ${caminho}`] ?? {
        status: 401,
        corpo: { erro: 'Sessão inválida ou vencida.' },
      };
      return new Response(r.status === 204 ? null : JSON.stringify(r.corpo ?? {}), {
        status: r.status ?? 200,
      });
    }),
  );
  return chamadas;
}

const instituicoes = [
  {
    id: 'i1',
    nome: 'Escola A (fictícia)',
    situacao: 'ativa',
    criado_em: '2026-11-10T12:00:00.000Z',
    modulos: { mensagens: true, calendario: true, apoio_aluno: true },
    contagem: { admin: 1, professor: 3, aluno: 20 },
  },
  {
    id: 'i2',
    nome: 'Escola B (fictícia)',
    situacao: 'suspensa',
    criado_em: '2026-11-09T12:00:00.000Z',
    modulos: { mensagens: true, calendario: false, apoio_aluno: true },
    contagem: {},
  },
];

describe('tela /operacao', () => {
  it('sem sessão mostra o login do Master, com rótulos e sem violações do axe', async () => {
    simular({});
    const { container } = render(<Operacao />);
    await screen.findByRole('heading', { name: 'Entrar na gestão' });
    for (const rotulo of ['Usuário', 'Senha', 'Código do aplicativo de autenticação'])
      expect(screen.getByLabelText(rotulo)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('entrar exige o código de 6 números e envia usuário, senha e código', async () => {
    const chamadas = simular({
      'POST /operacao/login': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
    });
    render(<Operacao />);
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Usuário'), 'master_um');
    await u.type(screen.getByLabelText('Senha'), 'senha-ficticia');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Escreva o código de 6 números/)).toBeTruthy();
    expect(chamadas.some((c) => c.url === '/operacao/login')).toBe(false);
    await u.type(screen.getByLabelText('Código do aplicativo de autenticação'), '123456');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Instituições' });
    expect(chamadas.find((c) => c.url === '/operacao/login')?.corpo).toEqual({
      usuario: 'master_um',
      senha: 'senha-ficticia',
      codigo: '123456',
    });
  });

  it('primeiro acesso pede convite e senha nova e leva ao segundo fator', async () => {
    const chamadas = simular({
      'POST /operacao/primeiro-acesso': {
        corpo: { nivel: 'configurar_totp', usuario: 'master_um' },
      },
      'POST /operacao/totp/iniciar': {
        corpo: { segredo: 'CHAVEFICTICIA', uri: 'otpauth://totp/x' },
      },
    });
    const { container } = render(<Operacao />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Primeiro acesso: tenho um convite' }));
    expect(screen.queryByLabelText('Código do aplicativo de autenticação')).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.type(screen.getByLabelText('Usuário'), 'master_um');
    await u.type(screen.getByLabelText('Convite'), 'AAAA-BBBB');
    await u.type(screen.getByLabelText('Senha nova'), 'senha ficticia longa');
    await u.click(screen.getByRole('button', { name: 'Definir a senha' }));
    await screen.findByRole('heading', { name: 'Ative o segundo fator' });
    await screen.findByText('CHAVEFICTICIA');
    expect(chamadas.find((c) => c.url === '/operacao/primeiro-acesso')?.corpo).toEqual({
      usuario: 'master_um',
      convite: 'AAAA-BBBB',
      senha_nova: 'senha ficticia longa',
    });
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('painel lista e cria; mostra situação, números por perfil e a trilha; axe sem violações', async () => {
    const chamadas = simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
      'POST /operacao/instituicoes': { status: 201, corpo: { instituicao: instituicoes[0] } },
    });
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    expect(screen.getByText(/Criada em 10\/11\/2026\./)).toBeTruthy();
    expect(
      screen.getByText(/1 Admin, 3 professores, 20 alunos, 0 Pedagógico, 0 responsáveis/),
    ).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText('Escreva o nome da instituição.')).toBeTruthy();
    await u.type(screen.getByLabelText('Nome da instituição'), 'Escola C (fictícia)');
    await u.click(screen.getByRole('button', { name: 'Criar' }));
    await screen.findByText('Instituição criada.');
    expect(
      chamadas.find((c) => c.metodo === 'POST' && c.url === '/operacao/instituicoes')?.corpo,
    ).toEqual({ nome: 'Escola C (fictícia)' });
  });

  it('L20: muda a situação; encerrar pede o nome escrito; liga e desliga módulo', async () => {
    const chamadas = simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
      'POST /operacao/instituicoes/i1/situacao': { status: 204 },
      'POST /operacao/instituicoes/i2/modulos': { status: 204 },
    });
    render(<Operacao />);
    const u = userEvent.setup();
    const select = await screen.findByLabelText('Nova situação de Escola A (fictícia)');
    const mudar = screen.getByRole('button', { name: /Mudar a situação\s*de Escola A/ });
    expect((mudar as HTMLButtonElement).disabled).toBe(true);
    await u.selectOptions(select, 'Suspensa');
    await u.click(mudar);
    await waitFor(() =>
      expect(chamadas.find((c) => c.url === '/operacao/instituicoes/i1/situacao')?.corpo).toEqual({
        situacao: 'suspensa',
      }),
    );
    await u.selectOptions(
      screen.getByLabelText('Nova situação de Escola A (fictícia)'),
      'Encerrada',
    );
    await u.type(
      screen.getByLabelText('Para encerrar, escreva o nome da instituição'),
      'Escola A (fictícia)',
    );
    await u.click(screen.getByRole('button', { name: /Mudar a situação\s*de Escola A/ }));
    await waitFor(() =>
      expect(
        chamadas.filter((c) => c.url === '/operacao/instituicoes/i1/situacao').at(-1)?.corpo,
      ).toEqual({ situacao: 'encerrada', confirmar_nome: 'Escola A (fictícia)' }),
    );
    const modulos = screen.getByRole('group', { name: /Módulos\s*de Escola B/ });
    const calendario = within(modulos).getByRole('switch', { name: 'Calendário' });
    expect((calendario as HTMLInputElement).checked).toBe(false);
    await u.click(calendario);
    await waitFor(() =>
      expect(chamadas.find((c) => c.url === '/operacao/instituicoes/i2/modulos')?.corpo).toEqual({
        modulo: 'calendario',
        ligado: true,
      }),
    );
  });

  it('sair volta para o login', async () => {
    simular({
      'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
      'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
      'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
      'GET /operacao/auditoria': { corpo: TRILHA },
      'POST /operacao/logout': { status: 204 },
    });
    render(<Operacao />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sair' }));
    await screen.findByRole('heading', { name: 'Entrar na gestão' });
  });

  // L22b: menu das áreas e árvore do Master (só leitura)
  const baseGestao = {
    'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
    'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
    'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
    'GET /operacao/auditoria': { corpo: TRILHA },
    'GET /operacao/instituicoes': { corpo: { instituicoes } },
  };
  const gente = [
    {
      usuario_id: 'u1',
      perfil: 'professor',
      nome: 'Professora Fictícia',
      email: 'prof@x.exemplo',
      ativo: true,
      menor: null,
    },
    {
      usuario_id: 'u2',
      perfil: 'aluno',
      nome: 'Aluno Fictício',
      email: 'al@x.exemplo',
      ativo: true,
      menor: true,
    },
    {
      usuario_id: 'u3',
      perfil: 'aluno',
      nome: 'Aluna Maior Fictícia',
      email: 'am@x.exemplo',
      ativo: false,
      menor: false,
    },
  ];

  it('L22b: o menu tem as 6 áreas e a página das instituições continua a mesma', async () => {
    simular(baseGestao);
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    for (const rotulo of [
      'Instituições',
      'Administradores',
      'Professores',
      'Pedagógicos e NAPNE',
      'Alunos',
      'Responsáveis',
      'Usuários sem vínculo',
      'Auditoria',
      'Suporte',
      'Acessibilidade',
      'Ajuda',
    ])
      expect(within(menu).getByRole('button', { name: rotulo })).toBeTruthy();
    expect(
      within(menu).getByRole('button', { name: 'Instituições' }).getAttribute('aria-current'),
    ).toBe('page');
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('L22b: a área mostra nome, e-mail e situação da escola escolhida, só leitura', async () => {
    const chamadas = simular({
      ...baseGestao,
      'GET /operacao/arvore/instituicao/i1': {
        corpo: { nome: 'Escola A (fictícia)', pessoas: gente },
      },
    });
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const u = userEvent.setup();
    await u.click(
      within(screen.getByRole('navigation', { name: 'Telas do sistema' })).getByRole('button', {
        name: 'Alunos',
      }),
    );
    await screen.findByRole('heading', { name: 'Alunos' });
    expect(
      screen.getByText(/Você está só lendo\. Nota, tarefa e mensagem não aparecem aqui\./),
    ).toBeTruthy();
    await u.selectOptions(await screen.findByLabelText('Onde olhar'), 'i1');
    await screen.findByText('Aluno Fictício');
    expect(screen.getByText('al@x.exemplo')).toBeTruthy();
    expect(screen.getByText(/Aluno menor de 18 anos/)).toBeTruthy();
    expect(screen.getByText(/Conta desativada · Aluno com 18 anos ou mais/)).toBeTruthy();
    expect(screen.queryByText('Professora Fictícia')).toBeNull();
    // Nenhum botão de escrita na área; a leitura foi um GET
    expect(
      chamadas.filter((c) => c.url.startsWith('/operacao/arvore')).every((c) => c.metodo === 'GET'),
    ).toBe(true);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('L22b: espaços individuais e usuários sem vínculo', async () => {
    simular({
      ...baseGestao,
      'GET /operacao/arvore/espacos': {
        corpo: {
          espacos: [
            {
              espaco_id: 'e1',
              pessoas: [
                gente[1],
                {
                  usuario_id: 'u9',
                  perfil: 'responsavel',
                  nome: 'Responsável Fictício',
                  email: 'r@x.exemplo',
                  ativo: true,
                  menor: null,
                },
              ],
            },
          ],
        },
      },
      'GET /operacao/arvore/sem-vinculo': {
        corpo: {
          pessoas: [
            {
              pessoa_id: 'p1',
              nome: 'Pessoa Solta Fictícia',
              email: 's@x.exemplo',
              papel_desejado: 'professor',
            },
          ],
        },
      },
    });
    render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const u = userEvent.setup();
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    await u.click(within(menu).getByRole('button', { name: 'Responsáveis' }));
    await u.selectOptions(await screen.findByLabelText('Onde olhar'), 'espacos');
    await screen.findByText('Responsável Fictício');
    expect(screen.getByText('Espaço individual 1')).toBeTruthy();
    expect(screen.queryByText('Aluno Fictício')).toBeNull();
    await u.click(within(menu).getByRole('button', { name: 'Usuários sem vínculo' }));
    await screen.findByText('Pessoa Solta Fictícia');
    expect(screen.getByText(/Pediu para ser professor/)).toBeTruthy();
  });
});

describe('console do Master no padrão do sistema (L22d)', () => {
  const base = {
    'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
    'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
    'GET /operacao/convites-individuais': {
      corpo: {
        pendentes: 1,
        usados: 0,
        vencidos: 0,
        instituicao: { pendentes: 2, usados: 0, vencidos: 0 },
      },
    },
    'GET /operacao/auditoria': { corpo: TRILHA },
    'GET /operacao/instituicoes': { corpo: { instituicoes } },
  };

  it('tem busca no menu, Ajuda no topo, Versão, sino de avisos e Sair', async () => {
    simular(base);
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    expect(screen.getByLabelText('Buscar no menu')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ajuda' })).toHaveLength(2);
    expect(screen.getByText(/SIESAL 4\.0 · Parte 1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
    // Sino: 2 convites de instituição esperando + 1 instituição em implantação (nenhuma no exemplo) = 1 aviso
    await screen.findByRole('button', { name: /Avisos da plataforma, 1 aviso/ });
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('a busca no menu acha só itens do Master', async () => {
    simular(base);
    render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Buscar no menu'), 'trilha');
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    expect(within(menu).getByRole('button', { name: /Auditoria/ })).toBeTruthy();
    expect(within(menu).queryByRole('button', { name: /Alunos/ })).toBeNull();
    expect(within(menu).queryByRole('button', { name: /Notas/ })).toBeNull();
  });

  it('Auditoria é página própria e mostra a conferência da trilha', async () => {
    simular(base);
    render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    expect(screen.queryByText('A trilha está íntegra: nenhum registro foi alterado.')).toBeNull();
    const u = userEvent.setup();
    await u.click(
      within(screen.getByRole('navigation', { name: 'Telas do sistema' })).getByRole('button', {
        name: 'Auditoria',
      }),
    );
    await screen.findByRole('heading', { name: 'Auditoria' });
    await screen.findByText('A trilha está íntegra: nenhum registro foi alterado.');
    expect(screen.getByText(/instituicao\.criada/)).toBeTruthy();
  });

  it('Suporte e Ajuda do Master são texto, sem formulário e sem dado escolar', async () => {
    simular(base);
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const u = userEvent.setup();
    const menu = screen.getByRole('navigation', { name: 'Telas do sistema' });
    await u.click(within(menu).getByRole('button', { name: 'Suporte' }));
    await screen.findByRole('heading', { name: 'Suporte' });
    expect(screen.queryByRole('textbox')).toBeNull();
    await u.click(within(menu).getByRole('button', { name: 'Ajuda' }));
    await screen.findByRole('heading', { name: 'Ajuda e manual' });
    expect(screen.getAllByText(/Gestão da plataforma: o que o Master vê/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/SIESAL 4\.0 · Parte 1/).length).toBeGreaterThan(1);
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('o sino da plataforma avisa trilha com problema', async () => {
    simular({ ...base, 'GET /operacao/auditoria': { corpo: { integra: false, eventos: [] } } });
    render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const sino = await screen.findByRole('button', { name: /Avisos da plataforma, 2 avisos/ });
    await userEvent.setup().click(sino);
    expect(await screen.findByText(/registro alterado na trilha/)).toBeTruthy();
    expect(screen.getByText(/2 convites de instituição esperando uso/)).toBeTruthy();
  });
});

describe('Master: convites e limite de alunos (L22c)', () => {
  const base = {
    'GET /operacao/eu': { corpo: { nivel: 'completo', usuario: 'master_um' } },
    'GET /operacao/painel': { corpo: { instituicoes, espacos_individuais: 2 } },
    'GET /operacao/convites-individuais': { corpo: { pendentes: 1, usados: 0, vencidos: 0 } },
    'GET /operacao/auditoria': { corpo: TRILHA },
    'GET /operacao/instituicoes': { corpo: { instituicoes } },
  };
  const irPara = async (u: ReturnType<typeof userEvent.setup>, rotulo: string) =>
    u.click(
      within(screen.getByRole('navigation', { name: 'Telas do sistema' })).getByRole('button', {
        name: rotulo,
      }),
    );

  it('lista convites sem o código; revogar pede confirmação e chama a API', async () => {
    let revogado = false;
    const chamadas = simular({
      ...base,
      'GET /operacao/convites-pendentes': {
        corpo: {
          convites: [
            {
              id: 'c1',
              tipo: 'individual',
              criado_em: '2026-11-10T12:00:00.000Z',
              expira_em: '2026-11-17T12:00:00.000Z',
            },
            {
              id: 'c2',
              tipo: 'instituicao',
              criado_em: '2026-11-11T12:00:00.000Z',
              expira_em: '2026-11-18T12:00:00.000Z',
            },
          ],
        },
      },
      'POST /operacao/convites/c1/revogar': { status: 204 },
    });
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const u = userEvent.setup();
    await irPara(u, 'Convites');
    await screen.findByRole('heading', { name: 'Convites' });
    expect(await screen.findByText('Convite de instituição')).toBeTruthy();
    expect(screen.getByText(/Criado em 10\/11\/2026 · vale até 17\/11\/2026/)).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    await u.click(screen.getAllByRole('button', { name: /^Revogar/ })[0] as HTMLElement);
    expect(screen.getByText(/Revogar este convite\? Ele deixa de valer na hora\./)).toBeTruthy();
    expect(chamadas.some((c) => c.url.includes('/revogar'))).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Sim, revogar' }));
    await waitFor(() =>
      expect(chamadas.some((c) => c.url === '/operacao/convites/c1/revogar')).toBe(true),
    );
    revogado = true;
    expect(revogado).toBe(true);
    expect(await screen.findByText('Convite revogado. Ele não vale mais.')).toBeTruthy();
  });

  it('limite de alunos: mostra o atual, recusa fora de 1 a 20 e salva', async () => {
    const chamadas = simular({
      ...base,
      'GET /operacao/limite-alunos': { corpo: { limite: 5 } },
      'PUT /operacao/limite-alunos': { status: 204 },
    });
    const { container } = render(<Operacao />);
    await screen.findByText('Escola A (fictícia)');
    const u = userEvent.setup();
    await irPara(u, 'Limite de alunos');
    await screen.findByRole('heading', { name: 'Limite de alunos' });
    expect(await screen.findByText('5')).toBeTruthy();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
    const campo = screen.getByLabelText('Novo limite');
    await u.clear(campo);
    await u.type(campo, '25');
    await u.click(screen.getByRole('button', { name: 'Salvar o limite' }));
    expect(await screen.findByText('Escolha um número de 1 a 20.')).toBeTruthy();
    expect(chamadas.some((c) => c.metodo === 'PUT')).toBe(false);
    await u.clear(campo);
    await u.type(campo, '8');
    await u.click(screen.getByRole('button', { name: 'Salvar o limite' }));
    expect(await screen.findByText('Limite salvo: 8 alunos por representante.')).toBeTruthy();
    expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({ limite: 8 });
  });
});

describe('faixa de ambiente (L22b)', () => {
  it('mostra "teste" por padrão e "produção" só quando a API diz producao', async () => {
    simular({ 'GET /config': { corpo: { instituicao_padrao: null, modo_local: true } } });
    const { unmount } = render(<FaixaAmbiente />);
    expect(screen.getByText('Ambiente de teste. Dados fictícios.')).toBeTruthy();
    unmount();
    simular({
      'GET /config': {
        corpo: { instituicao_padrao: null, modo_local: true, ambiente: 'qualquer' },
      },
    });
    const r2 = render(<FaixaAmbiente />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Ambiente de teste. Dados fictícios.')).toBeTruthy();
    r2.unmount();
    simular({
      'GET /config': {
        corpo: { instituicao_padrao: null, modo_local: false, ambiente: 'producao' },
      },
    });
    const { container } = render(<FaixaAmbiente />);
    await screen.findByText('Ambiente de produção.');
    expect(screen.queryByText(/Dados fictícios/)).toBeNull();
    expect((await axe.run(container, semContraste)).violations).toEqual([]);
  });

  it('sem resposta da API continua "teste"', async () => {
    simular({});
    render(<FaixaAmbiente />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Ambiente de teste. Dados fictícios.')).toBeTruthy();
  });
});
