import type { FastifyReply } from 'fastify';

// F-056: a resposta só pode sair depois do COMMIT. Dentro da transação a rota "envia" para este objeto,
// que só guarda código, cabeçalhos e corpo; quem chamou envia de verdade quando a transação termina.
export type RespostaAdiada = Pick<FastifyReply, 'code' | 'send' | 'header'> & { sent: boolean };

type Guardado = {
  codigo: number | null;
  cabecalhos: [string, string][];
  enviado: boolean;
  corpo?: unknown;
};

export function criarRespostaAdiada(): { resposta: RespostaAdiada; guardado: () => Guardado } {
  const dados: Guardado = { codigo: null, cabecalhos: [], enviado: false };
  const resposta = {
    get sent() {
      return dados.enviado;
    },
    code(codigo: number) {
      dados.codigo = codigo;
      return resposta;
    },
    header(nome: string, valor: string) {
      dados.cabecalhos.push([nome, valor]);
      return resposta;
    },
    send(corpo?: unknown) {
      dados.enviado = true;
      dados.corpo = corpo;
      return resposta;
    },
  } as unknown as RespostaAdiada;
  return { resposta, guardado: () => dados };
}

// Aplica código e cabeçalhos guardados e, se a rota "enviou", envia de verdade. Só depois do withTenant terminar
// sem erro. Devolve a resposta enviada, ou null quando a rota só devolveu um valor (o Fastify envia depois).
export function enviarGuardada(res: FastifyReply, dados: Guardado): FastifyReply | null {
  for (const [nome, valor] of dados.cabecalhos) res.header(nome, valor);
  if (dados.codigo !== null) res.code(dados.codigo);
  return dados.enviado ? res.send(dados.corpo) : null;
}
