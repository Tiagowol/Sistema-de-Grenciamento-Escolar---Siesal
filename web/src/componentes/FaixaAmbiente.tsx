import { useEffect, useState } from 'react';
import { type Ambiente, api } from '../api';
import { Icone } from '../icones';

// L22b: faixa fixa no topo de todas as telas. Texto + ícone + cor (nunca só cor).
// Sem resposta da API ou com valor estranho, vale "teste" (o lado seguro).
export const TEXTO_AMBIENTE: Record<Ambiente, string> = {
  teste: 'Ambiente de teste. Dados fictícios.',
  producao: 'Ambiente de produção.',
};

export function FaixaAmbiente({ inicial = 'teste' }: { inicial?: Ambiente }) {
  const [ambiente, setAmbiente] = useState<Ambiente>(inicial);
  useEffect(() => {
    let vivo = true;
    api
      .config()
      .then((c) => {
        if (vivo) setAmbiente(c.ambiente === 'producao' ? 'producao' : 'teste');
      })
      .catch(() => {
        // Sem resposta: continua "teste"
      });
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <div className={`faixa-ambiente ${ambiente}`}>
      <Icone nome={ambiente === 'producao' ? 'lock' : 'spark'} />
      <span>{TEXTO_AMBIENTE[ambiente]}</span>
    </div>
  );
}
