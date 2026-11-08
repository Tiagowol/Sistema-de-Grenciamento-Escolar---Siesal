import type { ReactNode } from 'react';
import { useId } from 'react';

// Campo de formulário com rótulo visível, dica e erro ligados ao campo (WCAG 1.3.1, 3.3.1)
type Props = {
  rotulo: string;
  dica?: string;
  erro?: string;
  cheio?: boolean;
  children: (ids: { id: string; descricao?: string }) => ReactNode;
};

export function Campo({ rotulo, dica, erro, cheio, children }: Props) {
  const id = useId();
  const idDescricao = `${id}-d`;
  const descricao = dica || erro ? idDescricao : undefined;
  return (
    <div className={`field${cheio ? ' full' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children({ id, descricao })}
      {dica && !erro ? (
        <div className="field-hint" id={idDescricao}>
          {dica}
        </div>
      ) : null}
      {erro ? (
        <div className="field-hint" id={idDescricao} role="alert">
          {erro}
        </div>
      ) : null}
    </div>
  );
}
