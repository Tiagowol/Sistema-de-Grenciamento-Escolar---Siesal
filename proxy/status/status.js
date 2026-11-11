// Página de status (L20). Confere o site, o login (API) e o banco, e escreve o resultado em texto literal.
// Círculo cheio = funcionando; círculo vazio = fora do ar. O texto diz o mesmo que o círculo.
(() => {
  const TEXTOS = {
    site: [
      'O site está funcionando.',
      'O site está fora do ar agora.',
      'O site está em manutenção agora.',
    ],
    login: ['O sistema de login está funcionando.', 'O sistema de login está fora do ar agora.'],
    banco: ['O banco de dados está funcionando.', 'O banco de dados está fora do ar agora.'],
  };
  const marcar = (servico, ok, texto) => {
    const li = document.querySelector(`[data-servico="${servico}"]`);
    li.className = ok ? 'ok' : 'fora';
    li.querySelector('.texto').textContent = texto;
  };
  const pedir = (url) => fetch(url, { cache: 'no-store', credentials: 'omit' });
  const conferir = async () => {
    let site = 'fora';
    try {
      const r = await pedir('/');
      site = r.ok ? 'ok' : r.status === 503 ? 'manutencao' : 'fora';
    } catch {
      site = 'fora';
    }
    marcar('site', site === 'ok', TEXTOS.site[site === 'ok' ? 0 : site === 'manutencao' ? 2 : 1]);
    let api = null;
    try {
      const s = await pedir('/api/saude');
      if (s.ok) api = await s.json();
    } catch {
      api = null;
    }
    const loginOk = Boolean(api) && api.status === 'ok';
    const bancoOk = Boolean(api) && api.banco === 'ok';
    marcar('login', loginOk, TEXTOS.login[loginOk ? 0 : 1]);
    marcar('banco', bancoOk, TEXTOS.banco[bancoOk ? 0 : 1]);
    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dia = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    document.getElementById('quando').textContent = `Conferido hoje (${dia}), às ${hora}.`;
  };
  document.getElementById('conferir').addEventListener('click', conferir);
  conferir();
})();
