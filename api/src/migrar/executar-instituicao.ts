import { criarInstituicao } from './instituicao.js';

// Ponto de entrada do job "instituicao" do compose (perfil release)
function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

const r = await criarInstituicao(exigir('DATABASE_URL_ADMIN'), {
  nome: exigir('INSTITUICAO_NOME'),
  adminNome: exigir('ADMIN_NOME'),
  adminEmail: exigir('ADMIN_EMAIL'),
});
console.log('instituicao: criada (dados fictícios)');
console.log(`  INSTITUICAO_ID=${r.instituicaoId}`);
console.log(`  login do admin: ${exigir('ADMIN_EMAIL')}`);
console.log(`  senha provisória (aparece só agora): ${r.senhaProvisoria}`);
