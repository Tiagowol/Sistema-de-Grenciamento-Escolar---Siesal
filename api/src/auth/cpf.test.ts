import { describe, expect, it } from 'vitest';
import { decifrar } from './cifra.js';
import {
  dataValida,
  derivarChavesCpf,
  idadeEm,
  mascararCpf,
  protegerCpf,
  validarCpf,
} from './cpf.js';
import { criarEnviadorSmtp, montarMensagem } from './email.js';
import { TERMO_VERSAO, textosDoTermo } from './termo.js';

// CPFs de teste com dígitos verificadores válidos (fictícios)
const CPF_A = '52998224725';
const CPF_B = '11144477735';

describe('validarCpf', () => {
  it('aceita com ou sem pontos e devolve só os dígitos', () => {
    expect(validarCpf('529.982.247-25')).toBe(CPF_A);
    expect(validarCpf(CPF_B)).toBe(CPF_B);
  });
  it('recusa dígito errado, tamanho errado, repetidos e letras', () => {
    for (const ruim of ['52998224726', '5299822472', '111.111.111-11', '00000000000', 'abc', '']) {
      expect(validarCpf(ruim)).toBeNull();
    }
  });
});

describe('proteção do CPF', () => {
  const chaves = derivarChavesCpf('chave-de-teste-do-cpf-com-mais-de-32-caracteres');
  it('cifra, indexa e guarda só os 2 últimos dígitos; o texto claro não aparece', () => {
    const p = protegerCpf(CPF_A, chaves);
    expect(JSON.stringify(p)).not.toContain(CPF_A);
    expect(p.cpf_final).toBe('25');
    expect(decifrar(p.cpf_cifrado, chaves.cifra).toString()).toBe(CPF_A);
    expect(p.cpf_hmac).toMatch(/^[0-9a-f]{64}$/);
    // mesmo CPF, mesmo índice; CPF diferente, índice diferente; a cifra muda a cada vez (IV novo)
    expect(protegerCpf(CPF_A, chaves).cpf_hmac).toBe(p.cpf_hmac);
    expect(protegerCpf(CPF_B, chaves).cpf_hmac).not.toBe(p.cpf_hmac);
    expect(protegerCpf(CPF_A, chaves).cpf_cifrado).not.toBe(p.cpf_cifrado);
  });
  it('a máscara mostra só os 2 últimos dígitos', () => {
    expect(mascararCpf('25')).toBe('***.***.***-25');
  });
  it('as chaves de cifra e de índice são diferentes e a chave curta é recusada', () => {
    expect(chaves.cifra.equals(chaves.hmac)).toBe(false);
    expect(() => derivarChavesCpf('curta')).toThrow();
  });
});

describe('datas e idade', () => {
  const hoje = new Date('2026-11-12T12:00:00Z');
  it('recusa data impossível, futura, antiga demais ou mal escrita', () => {
    for (const ruim of ['2010-02-30', '2027-01-01', '1899-12-31', '15/01/2000', '2000-1-5'])
      expect(dataValida(ruim, hoje), ruim).toBe(false);
    expect(dataValida('2008-11-12', hoje)).toBe(true);
  });
  it('conta a idade em anos completos', () => {
    expect(idadeEm('2008-11-12', hoje)).toBe(18);
    expect(idadeEm('2008-11-13', hoje)).toBe(17);
    expect(idadeEm('2000-01-15', hoje)).toBe(26);
  });
});

describe('termo e e-mail de teste', () => {
  it('o termo tem 3 caixas, com o nome do aluno na primeira', () => {
    const t = textosDoTermo('Aluno Fictício');
    expect(t).toHaveLength(3);
    expect(t[0]).toContain('Aluno Fictício');
    expect(TERMO_VERSAO).toBe('1');
  });
  it('a mensagem leva o assunto em UTF-8 e o texto em base64', () => {
    const m = montarMensagem(
      'a@siesal.local',
      { para: 'b@x.exemplo', assunto: 'Autorização', texto: 'olá' },
      new Date('2026-11-12T12:00:00Z'),
    );
    expect(m).toContain('Subject: =?UTF-8?B?');
    expect(m).toContain(Buffer.from('olá').toString('base64'));
    expect(m).not.toContain('olá');
  });
  it('recusa endereço com quebra de linha (injeção de cabeçalho)', async () => {
    const enviar = criarEnviadorSmtp('127.0.0.1', 1, 'a@siesal.local');
    await expect(
      enviar({ para: 'b@x.exemplo\r\nBcc: c@x.exemplo', assunto: 'x', texto: 'y' }),
    ).rejects.toThrow('endereço inválido');
  });
});
