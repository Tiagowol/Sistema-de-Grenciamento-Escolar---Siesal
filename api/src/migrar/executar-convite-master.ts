import { emitirConviteMaster, VALIDADE_CONVITE_MINUTOS } from './convite-master.js';

// Ponto de entrada do job "convite-master" do compose. Só o dono do computador roda este comando.
function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

const usuario = exigir('MASTER_USUARIO');
const convite = await emitirConviteMaster(exigir('DATABASE_URL_ADMIN'), usuario);
console.log(
  `convite-master: convite de ${usuario} (vale ${VALIDADE_CONVITE_MINUTOS} minutos, uma vez):`,
);
console.log(convite);
console.log('Ele não será mostrado de novo. Use em /gestao, em "Primeiro acesso".');
console.log(`Ou envie o link: /cadastro/master#${usuario}.${convite} (depois do endereço do site)`);
