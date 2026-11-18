import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';

// L22i item 2 (migração 0034): pedido de convite de quem não tem código. Não cria conta nem convite; resposta sempre igual. Dados fictícios.
let amb: Ambiente;
let app: FastifyInstance;
const pedir = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/auth/solicitar-convite', payload: payload as object });
const contar = async (tabela: string) =>
  Number((await amb.admin.query(`SELECT count(*)::int AS n FROM ${tabela}`)).rows[0].n);

beforeAll(async () => {
  amb = await criarAmbiente();
  app = criarApp({
    banco: amb.bancoApp,
    authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
    agora: () => new Date(),
    limiteTentativasPorMinuto: 1000,
  });
});
afterAll(async () => {
  await app.close();
  await amb.encerrar();
});

describe('pedido de convite (L22i, item 2)', () => {
  it('grava o pedido como pendente, sem criar conta nem convite', async () => {
    const usuarios = await contar('usuario');
    const convites = await contar('convite_individual');
    const r = await pedir({
      nome: 'Aluno Ficticio',
      email: 'ped1@exemplo.test',
      motivo: 'Quero estudar com o SIESAL.',
    });
    expect(r.statusCode).toBe(202);
    expect(r.json().recebido).toBe(true);
    const l = await amb.admin.query(
      `SELECT estado, motivo FROM pedido_convite WHERE email_busca = 'ped1@exemplo.test'`,
    );
    expect(l.rows).toEqual([{ estado: 'pendente', motivo: 'Quero estudar com o SIESAL.' }]);
    expect(await contar('usuario')).toBe(usuarios);
    expect(await contar('convite_individual')).toBe(convites);
  });

  it('pedido repetido do mesmo e-mail dá a mesma resposta e não duplica', async () => {
    const a = await pedir({
      nome: 'Outro Nome',
      email: 'PED1@exemplo.test ',
      motivo: 'Pedindo de novo agora.',
    });
    expect(a.statusCode).toBe(202);
    expect(a.json()).toEqual(
      (
        await pedir({
          nome: 'Aluno Ficticio',
          email: 'ped1@exemplo.test',
          motivo: 'Quero estudar com o SIESAL.',
        })
      ).json(),
    );
    expect(await contar(`pedido_convite WHERE email_busca = 'ped1@exemplo.test'`)).toBe(1);
  });

  it('e-mail que já tem espaço individual: mesma resposta e nada gravado', async () => {
    await amb.admin.query(
      `INSERT INTO instituicao (id, nome, tipo, situacao) VALUES ('00000000-0000-4000-8000-0000000000a1', 'Espaço individual', 'individual', 'ativa')`,
    );
    await amb.admin.query(
      `INSERT INTO espaco_individual (email_busca, instituicao_id) VALUES ('tem@exemplo.test', '00000000-0000-4000-8000-0000000000a1')`,
    );
    const r = await pedir({
      nome: 'Quem Tem',
      email: 'tem@exemplo.test',
      motivo: 'Esqueci de ter conta.',
    });
    expect(r.statusCode).toBe(202);
    expect(r.json().recebido).toBe(true);
    expect(await contar(`pedido_convite WHERE email_busca = 'tem@exemplo.test'`)).toBe(0);
  });

  it('recusa dados inválidos: link no motivo, e-mail ruim, motivo curto e campo a mais', async () => {
    const ok = {
      nome: 'Aluno Ficticio',
      email: 'ped2@exemplo.test',
      motivo: 'Preciso de um convite.',
    };
    expect((await pedir({ ...ok, motivo: 'veja https://golpe.test' })).statusCode).toBe(400);
    expect((await pedir({ ...ok, email: 'sem-arroba' })).statusCode).toBe(400);
    expect((await pedir({ ...ok, motivo: 'oi' })).statusCode).toBe(400);
    expect((await pedir({ ...ok, estado: 'aprovado' })).statusCode).toBe(400);
    expect(await contar(`pedido_convite WHERE email_busca = 'ped2@exemplo.test'`)).toBe(0);
  });

  it('o aplicativo não lê a tabela direto (só a função)', async () => {
    await expect(amb.bancoApp.$queryRaw`SELECT * FROM pedido_convite`).rejects.toThrow();
  });
});
