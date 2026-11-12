import { useId } from 'react';
import { moduloLigado } from '../modulos';

// Dificuldade de 0 a 10 (20d). É a percepção do aluno, pedida pelo NAPNE para o Apoio Pedagógico ajudar o aluno.
// Não é nota de prova nem diagnóstico. Nunca só número: cada valor mostra a palavra e uma barra de blocos.
export const PALAVRA_NAS_PONTAS: Record<number, string> = {
  0: 'muito fácil',
  5: 'média',
  10: 'extremamente difícil',
};

export function palavraDaDificuldade(n: number): string {
  if (n === 0) return 'muito fácil';
  if (n <= 3) return 'fácil';
  if (n <= 6) return 'média';
  if (n <= 9) return 'difícil';
  return 'extremamente difícil';
}

// Regra de sugestão do plano (sem IA): dificuldade 7 ou mais sugere começar antes e usar blocos menores
export const DIFICULDADE_QUE_SUGERE = 7;
export const dificuldadeAlta = (n: number | null | undefined): boolean =>
  typeof n === 'number' && n >= DIFICULDADE_QUE_SUGERE;

export const TEXTO_EQUIPE_VE =
  'A equipe de apoio pedagógico vê esta nota para ajudar você. Ela não é uma nota de prova.';

const VALORES = Array.from({ length: 11 }, (_, i) => i);

// Barra de 10 blocos, só desenho; o texto ao lado diz o mesmo
export function BarraDificuldade({ valor }: { valor: number }) {
  return (
    <span className="dif-barra" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocos iguais, só desenho
        <span key={i} className={`dif-bloco${i < valor ? ' cheio' : ''}`} />
      ))}
    </span>
  );
}

// Leitura (sem editar): usada na tela do Apoio Pedagógico
export function NotaDeDificuldade({ valor }: { valor: number }) {
  return (
    <span className="dif-leitura">
      <strong>{palavraDaDificuldade(valor)}</strong>
      <span>nota {valor} de 10</span>
      <BarraDificuldade valor={valor} />
    </span>
  );
}

// Escolha com 11 posições. Escolher de novo a mesma posição não limpa; para limpar há o botão "Sem nota".
export function Dificuldade({
  valor,
  aoMudar,
  rotulo = 'Dificuldade (opcional)',
  nome,
}: {
  valor: number | null | undefined;
  aoMudar: (v: number | null) => void;
  rotulo?: string;
  nome?: string;
}) {
  const grupo = useId();
  const atual = typeof valor === 'number' ? valor : null;
  // O aviso só aparece quando a equipe realmente vê (escola com o módulo "apoio ao aluno" ligado)
  const equipeVe = moduloLigado('apoio_aluno');
  return (
    <fieldset className="dificuldade">
      <legend>{rotulo}</legend>
      <div className="dif-opcoes" role="radiogroup" aria-label={rotulo}>
        {VALORES.map((n) => (
          <label key={n} className={`dif-opcao${atual === n ? ' marcada' : ''}`}>
            <input
              type="radio"
              name={nome ?? grupo}
              checked={atual === n}
              onChange={() => aoMudar(n)}
            />
            <span className="dif-num">{n}</span>
            {PALAVRA_NAS_PONTAS[n] ? (
              <small className="dif-palavra">{PALAVRA_NAS_PONTAS[n]}</small>
            ) : null}
          </label>
        ))}
      </div>
      <p className="dif-estado" aria-live="polite">
        {atual === null ? (
          'Sem nota.'
        ) : (
          <>
            <strong>{palavraDaDificuldade(atual)}</strong> (nota {atual} de 10)
          </>
        )}{' '}
        {atual !== null ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => aoMudar(null)}>
            Sem nota
          </button>
        ) : null}
      </p>
      {equipeVe ? <p className="muted small">{TEXTO_EQUIPE_VE}</p> : null}
    </fieldset>
  );
}
