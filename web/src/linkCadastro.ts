// Links de cadastro: o código vem depois do "#" (ex.: /cadastro/aluno#ABCD-EFGH-JKLM-NPQR).
// O que fica depois do "#" nunca é enviado ao servidor, então não aparece nos registros do nginx nem no Referer.
// Depois de lido, o código sai da barra de endereço.
export function lerCodigoDoLink(caminhoEsperado: string): string | null {
  const caminho = window.location.pathname.replace(/\/+$/, '');
  let codigo = '';
  try {
    codigo = decodeURIComponent(window.location.hash.slice(1)).trim();
  } catch {
    return null;
  }
  if (caminho !== caminhoEsperado || !codigo) return null;
  window.history.replaceState(null, '', caminhoEsperado);
  return codigo;
}

// Monta o link completo para o Master enviar (usa o endereço em que ele está logado)
export const linkDeCadastro = (tipo: 'aluno' | 'master' | 'instituicao', codigo: string): string =>
  `${window.location.origin}/cadastro/${tipo}#${encodeURIComponent(codigo)}`;
