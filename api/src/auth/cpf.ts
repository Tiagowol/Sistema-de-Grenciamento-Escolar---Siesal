import { createHmac, hkdfSync } from 'node:crypto';
import { cifrar } from './cifra.js';

// CPF (20c-2). Só dados fictícios na Parte 1. O CPF nunca é guardado nem registrado em texto claro:
// vai cifrado (AES-256-GCM), com um índice HMAC para achar duplicidade e os 2 últimos dígitos para a máscara.
// A chave vem de CPF_CHAVE (segredo próprio, fora do git, sem relação com AUTH_SECRET).
export type ChavesCpf = { cifra: Buffer; hmac: Buffer };

export function derivarChavesCpf(segredo: string): ChavesCpf {
  if (segredo.length < 32) throw new Error('CPF_CHAVE precisa ter pelo menos 32 caracteres.');
  const chave = (info: string) =>
    Buffer.from(hkdfSync('sha256', segredo, 'siesal-sal-v1', info, 32));
  return { cifra: chave('siesal-cpf-cifra'), hmac: chave('siesal-cpf-hmac') };
}

// Aceita pontos e traço. Devolve os 11 dígitos, ou null se os dígitos verificadores não batem
export function validarCpf(entrada: string): string | null {
  const d = entrada.replace(/[.\-\s]/g, '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return null;
  const digito = (n: number): number => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]) ? d : null;
}

export type CpfProtegido = { cpf_cifrado: string; cpf_hmac: string; cpf_final: string };

export function protegerCpf(digitos: string, chaves: ChavesCpf): CpfProtegido {
  return {
    cpf_cifrado: cifrar(Buffer.from(digitos, 'utf8'), chaves.cifra),
    cpf_hmac: createHmac('sha256', chaves.hmac).update(digitos).digest('hex'),
    cpf_final: digitos.slice(-2),
  };
}

// Máscara de tela: só os 2 últimos dígitos
export const mascararCpf = (final: string): string => `***.***.***-${final}`;

// Datas no formato AAAA-MM-DD (sem hora). Datas impossíveis (30/02) e futuras são recusadas.
export function dataValida(texto: string, hoje: Date): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia)
    return false;
  return a >= 1900 && texto <= hoje.toISOString().slice(0, 10);
}

// Idade em anos completos na data de hoje (UTC)
export function idadeEm(nascimento: string, hoje: Date): number {
  const [a, m, d] = nascimento.split('-').map(Number) as [number, number, number];
  let idade = hoje.getUTCFullYear() - a;
  const antes =
    hoje.getUTCMonth() + 1 < m || (hoje.getUTCMonth() + 1 === m && hoje.getUTCDate() < d);
  if (antes) idade -= 1;
  return idade;
}
