import { linkDeCadastro } from '../linkCadastro';

// L22i (item 1) e L22j: código do convite em letras grandes, validade com data e 7 blocos, botões de copiar.
// Usado na tela "Convite de aluno" e na fila "Pedidos de convite" (depois de Aprovar).
const DIAS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
const dataCurta = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

type Props = {
  codigo: string;
  expiraEm: string;
  aoCopiar: (ok: string) => void;
  aoFalhar: (erro: string) => void;
  dica: string;
};

export function CodigoDoConvite({ codigo, expiraEm, aoCopiar, aoFalhar, dica }: Props) {
  // Copiar: avisa o resultado; se o navegador bloquear, pede para selecionar o texto
  function copiar(texto: string, ok: string) {
    void navigator.clipboard
      ?.writeText(texto)
      .then(() => aoCopiar(ok))
      .catch(() => aoFalhar('Não foi possível copiar. Selecione o texto e copie.'));
  }
  return (
    <div className="mt" role="status">
      <p className="small muted">Código do convite</p>
      <p>
        <strong
          style={{ fontSize: 24, letterSpacing: 1, wordBreak: 'break-all', userSelect: 'all' }}
        >
          {codigo}
        </strong>
      </p>
      <p>
        Vale por 7 dias, até <strong>{dataCurta(expiraEm)}</strong>.
      </p>
      <div aria-hidden="true" style={{ display: 'flex', gap: 4, maxWidth: 280 }}>
        {DIAS.map((dia) => (
          <span
            key={dia}
            style={{ flex: 1, height: 12, borderRadius: 3, background: 'var(--accent, #2563eb)' }}
          />
        ))}
      </div>
      <p className="small muted">Os 7 blocos são os 7 dias de validade.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44 }}
          onClick={() => copiar(codigo, 'Código copiado.')}
        >
          Copiar o código
        </button>
        <button
          type="button"
          className="btn btn-outline"
          style={{ minHeight: 44 }}
          onClick={() => copiar(linkDeCadastro('aluno', codigo), 'Link copiado.')}
        >
          Copiar o link
        </button>
      </div>
      <p className="small muted mt-sm">{dica}</p>
    </div>
  );
}
