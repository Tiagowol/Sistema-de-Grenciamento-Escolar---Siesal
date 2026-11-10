import { useId } from 'react';
import type { Interface } from '../interface';

// L17d: rótulos do topo e VLibras. Os mesmos controles aparecem em Acessibilidade (5 perfis) e em Personalizar (aluno).
type Props = { valor: Interface; aoMudar: (p: Interface) => void };

export function AjustesInterface({ valor, aoMudar }: Props) {
  const id = useId();
  return (
    <>
      <fieldset className="setting">
        <legend>
          <b>Botões do topo</b>
        </legend>
        <div className="opcoes-rotulos">
          <label>
            <input
              type="radio"
              name={`${id}-rotulos`}
              checked={valor.rotulos === 'icones'}
              onChange={() => aoMudar({ ...valor, rotulos: 'icones' })}
            />
            Só ícones
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-rotulos`}
              checked={valor.rotulos === 'texto'}
              onChange={() => aoMudar({ ...valor, rotulos: 'texto' })}
            />
            Ícones com texto
          </label>
        </div>
        <p>
          Com texto, cada botão do topo mostra o nome ao lado do ícone. Fica salvo na sua conta.
        </p>
      </fieldset>
      <div className="setting">
        <div className="flex-between">
          <label id={`${id}-vl`} htmlFor={`${id}-vl-sw`}>
            <b>Mostrar o VLibras (Libras)</b>
          </label>
          <button
            id={`${id}-vl-sw`}
            type="button"
            role="switch"
            className="switch"
            aria-checked={valor.vlibras}
            aria-labelledby={`${id}-vl`}
            aria-describedby={`${id}-vl-txt`}
            onClick={() => aoMudar({ ...valor, vlibras: !valor.vlibras })}
          />
        </div>
        <p id={`${id}-vl-txt`}>
          Botão no canto direito que traduz o texto da tela para Libras. É do governo federal: o
          texto que você clicar vai para o servidor do governo (vlibras.gov.br). Desligado, o botão
          some e nada é enviado. Fica salvo na sua conta.
        </p>
      </div>
    </>
  );
}
