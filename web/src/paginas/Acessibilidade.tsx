import type { Preferencias } from '../preferencias';

type Props = { valor: Preferencias; aoMudar: (p: Preferencias) => void };

type Chave =
  | 'escuro'
  | 'contraste'
  | 'movimento'
  | 'legivel'
  | 'simples'
  | 'tempoVisual'
  | 'linguagemCurta'
  | 'escolhaAgora';
const AJUSTES: { chave: Chave; titulo: string; texto: string }[] = [
  { chave: 'escuro', titulo: 'Tema escuro', texto: 'Fundo escuro, bom para pouca luz.' },
  {
    chave: 'contraste',
    titulo: 'Alto contraste',
    texto: 'Cores mais fortes e bordas mais marcadas.',
  },
  { chave: 'movimento', titulo: 'Reduzir movimento', texto: 'Sem animações e transições.' },
  { chave: 'legivel', titulo: 'Leitura facilitada', texto: 'Mais espaço entre linhas e letras.' },
  {
    chave: 'simples',
    titulo: 'Modo simples',
    texto: 'Esconde detalhes extras. Mostra só o essencial.',
  },
  {
    chave: 'tempoVisual',
    titulo: 'Mostrar tempo de forma visual',
    texto: 'Palavras, datas e formas no lugar de só números. No modo foco, o número fica oculto.',
  },
  {
    chave: 'linguagemCurta',
    titulo: 'Linguagem curta',
    texto: 'Frases mais curtas nas telas Meu dia, Atividades, Agenda e Foco.',
  },
  {
    chave: 'escolhaAgora',
    titulo: 'Mostrar "Escolha o que fazer agora"',
    texto: 'No Meu dia, um cartão mostra uma etapa por vez para você escolher.',
  },
];

export function Acessibilidade({ valor, aoMudar }: Props) {
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Preferências</div>
          <h1>Acessibilidade</h1>
          <p>Estes ajustes ficam salvos neste aparelho.</p>
        </div>
      </div>
      <div className="settings-grid">
        {AJUSTES.map((a) => (
          <div className="setting" key={a.chave}>
            <div className="flex-between">
              <label id={`aj-${a.chave}`} htmlFor={`sw-${a.chave}`}>
                <b>{a.titulo}</b>
              </label>
              <button
                id={`sw-${a.chave}`}
                type="button"
                role="switch"
                className="switch"
                aria-checked={valor[a.chave]}
                aria-labelledby={`aj-${a.chave}`}
                onClick={() => aoMudar({ ...valor, [a.chave]: !valor[a.chave] })}
              />
            </div>
            <p>{a.texto}</p>
          </div>
        ))}
        <div className="setting">
          <label htmlFor="aj-fonte">
            <b>Tamanho da letra: {valor.fonte}%</b>
          </label>
          <input
            id="aj-fonte"
            className="slider"
            type="range"
            min={90}
            max={150}
            step={10}
            value={valor.fonte}
            onChange={(e) => aoMudar({ ...valor, fonte: Number(e.target.value) })}
          />
          <p>De 90% a 150%.</p>
        </div>
      </div>
    </>
  );
}
