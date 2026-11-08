import { diasAte, formatar, relativo } from '../datas';
import { carregarPreferencias } from '../preferencias';

const FAIXA = [1, 2, 3, 4, 5, 6, 7];
const DIAS_NA_FAIXA = FAIXA.length;

// Lida a cada visita à tela: a preferência fica no aparelho, sem banco
export const tempoVisualLigado = () => carregarPreferencias().tempoVisual;

// Prazo com palavra (hoje, amanhã), data (dia/mês) e uma faixa de 7 quadrados.
// Cada quadrado cheio é um dia que falta. A forma nunca é a única informação: o texto diz o mesmo.
// Com "passado" (data de algo que já aconteceu, como uma prova), os quadrados cheios contam os dias
// que já passaram (até 7) e a faixa não usa o estilo de prazo vencido.
export function TempoVisual({
  prazo,
  hoje,
  passado = false,
}: {
  prazo: string | null;
  hoje: string;
  passado?: boolean;
}) {
  if (!prazo) return <span>sem prazo</span>;
  const palavra = relativo(prazo, hoje);
  if (!tempoVisualLigado()) return <span>{`${formatar(prazo)} · ${palavra}`}</span>;
  const dias = diasAte(prazo, hoje);
  const faltam = Math.max(0, Math.min(DIAS_NA_FAIXA, passado ? -dias : dias));
  const passou = !passado && dias < 0;
  return (
    <span className={`tempo-visual${passou ? ' passou' : ''}`}>
      <strong>{palavra}</strong>
      <span>{formatar(prazo)}</span>
      <span className="tempo-blocos" aria-hidden="true">
        {FAIXA.map((d) => (
          <span key={d} className={d <= faltam ? 'cheio' : ''} />
        ))}
      </span>
    </span>
  );
}
