import { connect } from 'node:net';

// E-mail de teste (20c-2, D8): cliente SMTP mínimo, sem autenticação, para a caixa de teste (Mailpit) dentro do Docker.
// Não envia e-mail real. O envio real fica para a Parte 2. Sem biblioteca externa de propósito (menos dependência).
export type Email = { para: string; assunto: string; texto: string };
export type EnviarEmail = (e: Email) => Promise<void>;

const ENDERECO = /^[^@\s<>\r\n]+@[^@\s<>\r\n]+\.[^@\s<>\r\n]+$/;

export function montarMensagem(de: string, e: Email, data: Date): string {
  const corpo = Buffer.from(e.texto, 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');
  return [
    `From: SIESAL <${de}>`,
    `To: <${e.para}>`,
    `Subject: =?UTF-8?B?${Buffer.from(e.assunto, 'utf8').toString('base64')}?=`,
    `Date: ${data.toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    corpo,
  ].join('\r\n');
}

export function criarEnviadorSmtp(host: string, porta: number, de: string): EnviarEmail {
  return (e) =>
    new Promise<void>((resolve, reject) => {
      if (!ENDERECO.test(e.para) || !ENDERECO.test(de))
        return reject(new Error('endereço inválido'));
      const sock = connect({ host, port: porta });
      sock.setTimeout(5000);
      let buf = '';
      let espera: ((linha: string) => void) | null = null;
      // Uma resposta SMTP termina na linha "NNN texto" (com espaço depois do código)
      const tentar = () => {
        if (!espera) return;
        const linhas = buf.split('\r\n');
        const i = linhas.findIndex((l) => /^\d{3}( |$)/.test(l));
        if (i < 0) return;
        buf = linhas.slice(i + 1).join('\r\n');
        const r = espera;
        espera = null;
        r(linhas[i] as string);
      };
      sock.on('data', (d) => {
        buf += d.toString('utf8');
        tentar();
      });
      sock.on('error', reject);
      sock.on('timeout', () => {
        sock.destroy();
        reject(new Error('tempo esgotado'));
      });
      const ler = (codigo: string) =>
        new Promise<void>((ok, falha) => {
          espera = (linha) =>
            linha.startsWith(codigo) ? ok() : falha(new Error(`SMTP: ${linha}`));
          tentar();
        });
      const enviar = (linha: string) => sock.write(`${linha}\r\n`);
      (async () => {
        try {
          await ler('220');
          enviar('EHLO siesal.local');
          await ler('250');
          enviar(`MAIL FROM:<${de}>`);
          await ler('250');
          enviar(`RCPT TO:<${e.para}>`);
          await ler('250');
          enviar('DATA');
          await ler('354');
          enviar(`${montarMensagem(de, e, new Date())}\r\n.`);
          await ler('250');
          enviar('QUIT');
          resolve();
        } catch (x) {
          reject(x);
        } finally {
          sock.end();
        }
      })();
    });
}
