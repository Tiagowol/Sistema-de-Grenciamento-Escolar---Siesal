import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cifrar, decifrar, derivarChave } from './cifra.js';
import {
  gerarCodigosRecuperacao,
  hashCodigo,
  normalizarCodigo,
  pareceCodigoRecuperacao,
} from './codigos.js';
import { LimitadorJanela } from './limitador.js';
import { hashSenha, validarSenha, verificarSenha, verificarSenhaFalsa } from './senha.js';
import { gerarToken, lerCookie, lerToken, NOME_COOKIE, serializarCookie } from './sessao.js';
import { base32Codificar, base32Decodificar, codigoTotp, verificarTotp } from './totp.js';

describe('senha (Argon2id)', () => {
  it('gera hash PHC e confere a senha certa e a errada', async () => {
    const hash = await hashSenha('uma senha longa e boa');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verificarSenha('uma senha longa e boa', hash)).toBe(true);
    expect(await verificarSenha('outra senha qualquer', hash)).toBe(false);
  });

  it('dois hashes da mesma senha são diferentes (sal aleatório)', async () => {
    expect(await hashSenha('mesma senha 12345')).not.toBe(await hashSenha('mesma senha 12345'));
  });

  it('hash malformado nunca lança erro, só falha', async () => {
    for (const ruim of ['', 'texto', '$argon2id$v=19$m=x$a$b', '$bcrypt$x$y$z$w']) {
      expect(await verificarSenha('qualquer senha 123', ruim)).toBe(false);
    }
    expect(await verificarSenhaFalsa('qualquer senha 123')).toBe(false);
  });

  it('valida só o comprimento (12 a 128), sem regras de símbolos', () => {
    expect(validarSenha('curta')).toMatch(/12/);
    expect(validarSenha('a'.repeat(129))).toMatch(/128/);
    expect(validarSenha('aaaaaaaaaaaa')).toBeNull();
  });
});

describe('TOTP (RFC 6238)', () => {
  const segredo = Buffer.from('12345678901234567890');
  // Vetores do Apêndice B da RFC 6238 (SHA-1), cortados em 6 dígitos
  const vetores: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ];

  it.each(vetores)('instante %i gera %s', (segundos, esperado) => {
    expect(codigoTotp(segredo, Math.floor(segundos / 30))).toBe(esperado);
  });

  it('aceita o passo atual e vizinhos, e recusa fora da janela', () => {
    const agora = new Date(1234567890 * 1000);
    const passo = Math.floor(1234567890 / 30);
    expect(verificarTotp(segredo, codigoTotp(segredo, passo), agora, null)).toBe(passo);
    expect(verificarTotp(segredo, codigoTotp(segredo, passo - 1), agora, null)).toBe(passo - 1);
    expect(verificarTotp(segredo, codigoTotp(segredo, passo + 2), agora, null)).toBeNull();
    expect(verificarTotp(segredo, codigoTotp(segredo, passo - 2), agora, null)).toBeNull();
  });

  it('um passo já usado não vale de novo', () => {
    const agora = new Date(1234567890 * 1000);
    const passo = Math.floor(1234567890 / 30);
    expect(verificarTotp(segredo, codigoTotp(segredo, passo), agora, passo)).toBeNull();
  });

  it('recusa código fora do formato', () => {
    const agora = new Date(1234567890 * 1000);
    for (const ruim of ['', '12345', '1234567', 'abcdef', '12 345'])
      expect(verificarTotp(segredo, ruim, agora, null)).toBeNull();
  });

  it('base32 vai e volta', () => {
    expect(base32Codificar(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decodificar('MZXW6YTBOI').toString()).toBe('foobar');
    expect(() => base32Decodificar('1!')).toThrow();
  });
});

describe('cifra do segredo do TOTP', () => {
  const chave = derivarChave('x'.repeat(40));

  it('cifra e decifra, e o texto cifrado muda a cada vez', () => {
    const segredo = Buffer.from('segredo-do-totp');
    const a = cifrar(segredo, chave);
    expect(decifrar(a, chave).toString()).toBe('segredo-do-totp');
    expect(cifrar(segredo, chave)).not.toBe(a);
  });

  it('recusa texto adulterado e chave errada', () => {
    const cifrado = cifrar(Buffer.from('abc'), chave);
    const partes = cifrado.split('.');
    partes[3] = Buffer.from('adulterado').toString('base64url');
    expect(() => decifrar(partes.join('.'), chave)).toThrow();
    expect(() => decifrar(cifrado, derivarChave('y'.repeat(40)))).toThrow();
  });

  it('exige AUTH_SECRET com pelo menos 32 caracteres', () => {
    expect(() => derivarChave('curto')).toThrow(/32/);
  });
});

describe('token e cookie de sessão', () => {
  it('o token carrega a instituição e só o hash vai ao banco', () => {
    const instituicao = randomUUID();
    const { token, hash } = gerarToken(instituicao);
    const lido = lerToken(token);
    expect(lido).toEqual({ instituicaoId: instituicao, hash });
    expect(hash).not.toContain(token.split('.')[1]);
  });

  it('recusa tokens malformados', () => {
    for (const ruim of [
      undefined,
      '',
      'abc',
      `${randomUUID()}.curto`,
      `nao-uuid.${'a'.repeat(43)}`,
      `${randomUUID()}.${'a'.repeat(43)}.extra`,
    ]) {
      expect(lerToken(ruim)).toBeNull();
    }
  });

  it('o cookie tem os atributos de segurança do prefixo __Host-', () => {
    const cookie = serializarCookie('valor', 60);
    expect(cookie).toContain(`${NOME_COOKIE}=valor`);
    for (const atributo of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=60'])
      expect(cookie).toContain(atributo);
    expect(cookie).not.toContain('Domain');
  });

  it('lê o cookie certo no meio de outros', () => {
    expect(lerCookie(`a=1; ${NOME_COOKIE}=xyz=; b=2`)).toBe('xyz=');
    expect(lerCookie('a=1')).toBeUndefined();
  });
});

describe('códigos de recuperação', () => {
  it('gera 10 códigos únicos no formato XXXXX-XXXXX, com hash estável', () => {
    const codigos = gerarCodigosRecuperacao();
    expect(codigos).toHaveLength(10);
    expect(new Set(codigos.map((c) => c.texto)).size).toBe(10);
    for (const c of codigos) {
      expect(c.texto).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
      expect(hashCodigo(c.texto.toLowerCase())).toBe(c.hash);
      expect(pareceCodigoRecuperacao(c.texto)).toBe(true);
    }
    expect(normalizarCodigo('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(pareceCodigoRecuperacao('123456')).toBe(false);
  });
});

describe('limitador por janela', () => {
  it('bloqueia depois do máximo e libera na janela seguinte', () => {
    const limitador = new LimitadorJanela(3, 1000);
    expect([1, 2, 3, 4].map(() => limitador.permitir('ip', 0))).toEqual([true, true, true, false]);
    expect(limitador.permitir('outro', 0)).toBe(true);
    expect(limitador.permitir('ip', 1000)).toBe(true);
  });
});
