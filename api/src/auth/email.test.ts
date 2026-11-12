import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { criarEnviadorSmtp } from './email.js';

// O cliente SMTP de teste fala com um servidor falso local (sem Mailpit e sem rede): confere a conversa e o conteúdo.
let servidor: Server | undefined;
afterEach(() => new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok())));

function subirServidorFalso(recusarRcpt = false): Promise<{ porta: number; recebido: string[] }> {
  const recebido: string[] = [];
  return new Promise((pronto) => {
    servidor = createServer((s) => {
      let dados = false;
      let corpo = '';
      s.write('220 falso pronto\r\n');
      s.on('data', (d) => {
        for (const linha of d.toString('utf8').split('\r\n')) {
          if (dados) {
            corpo += `${linha}\r\n`;
            if (linha === '.') {
              dados = false;
              recebido.push(corpo);
              s.write('250 ok\r\n');
            }
          } else if (linha.startsWith('EHLO')) s.write('250-falso\r\n250 8BITMIME\r\n');
          else if (linha.startsWith('MAIL')) s.write('250 ok\r\n');
          else if (linha.startsWith('RCPT'))
            s.write(recusarRcpt ? '550 recusado\r\n' : '250 ok\r\n');
          else if (linha === 'DATA') {
            dados = true;
            s.write('354 envie\r\n');
          } else if (linha === 'QUIT') s.end('221 tchau\r\n');
        }
      });
    }).listen(0, '127.0.0.1', () => {
      const a = servidor?.address();
      pronto({ porta: typeof a === 'object' && a ? a.port : 0, recebido });
    });
  });
}

describe('cliente SMTP de teste', () => {
  it('entrega a mensagem completa, com o link no corpo em base64', async () => {
    const { porta, recebido } = await subirServidorFalso();
    const enviar = criarEnviadorSmtp('127.0.0.1', porta, 'nao-responda@siesal.local');
    await enviar({
      para: 'resp@x.exemplo',
      assunto: 'SIESAL: autorização do responsável',
      texto: 'Abra: http://localhost:18080/confirmar/responsavel#abc',
    });
    expect(recebido).toHaveLength(1);
    expect(recebido[0]).toContain('To: <resp@x.exemplo>');
    expect(recebido[0]).toContain('Subject: =?UTF-8?B?');
    const base64 = (recebido[0] as string).split('\r\n\r\n')[1]?.replace(/\r\n/g, '') ?? '';
    expect(Buffer.from(base64.replace(/\.$/, ''), 'base64').toString('utf8')).toContain(
      '/confirmar/responsavel#abc',
    );
  });

  it('falha quando o servidor recusa o destinatário', async () => {
    const { porta } = await subirServidorFalso(true);
    const enviar = criarEnviadorSmtp('127.0.0.1', porta, 'nao-responda@siesal.local');
    await expect(enviar({ para: 'resp@x.exemplo', assunto: 'x', texto: 'y' })).rejects.toThrow(
      'SMTP: 550',
    );
  });

  it('falha quando não há servidor na porta', async () => {
    const enviar = criarEnviadorSmtp('127.0.0.1', 1, 'nao-responda@siesal.local');
    await expect(enviar({ para: 'resp@x.exemplo', assunto: 'x', texto: 'y' })).rejects.toThrow();
  });
});
