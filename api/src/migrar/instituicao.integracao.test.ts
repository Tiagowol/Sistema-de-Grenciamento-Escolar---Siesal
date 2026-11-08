import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../app.js';
import { type Ambiente, criarAmbiente } from '../teste/ambiente.js';
import { criarInstituicao } from './instituicao.js';

// Comando de instalação da instituição: o admin criado consegue entrar e precisa trocar a senha
let amb: Ambiente;
beforeAll(async () => {
  amb = await criarAmbiente();
});
afterAll(async () => {
  await amb?.encerrar();
});

describe('criarInstituicao', () => {
  it('cria instituição e admin; o primeiro login exige troca de senha', async () => {
    const r = await criarInstituicao(amb.urlAdminDoBanco, {
      nome: 'Escola Teste (fictícia)',
      adminNome: 'Admin Teste',
      adminEmail: 'Admin@Teste.exemplo',
    });
    const app = criarApp({
      banco: amb.bancoApp,
      authSecret: 'segredo-de-teste-com-mais-de-32-caracteres!',
      cookieLocal: true,
    });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        instituicao_id: r.instituicaoId,
        email: 'admin@teste.exemplo',
        senha: r.senhaProvisoria,
      },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().nivel).toBe('trocar_senha');
    expect(String(login.headers['set-cookie'])).toContain('siesal_sessao=');
    expect(String(login.headers['set-cookie'])).not.toContain('Secure');
    await app.close();
  });

  it('recusa dados inválidos sem criar nada', async () => {
    await expect(
      criarInstituicao(amb.urlAdminDoBanco, { nome: ' ', adminNome: 'A', adminEmail: 'x' }),
    ).rejects.toThrow(/e-mail válido/);
  });
});
