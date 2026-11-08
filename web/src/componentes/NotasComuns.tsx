import type { FormEvent } from 'react';
import { useState } from 'react';
import type { EstadoPedido, Perfil, VersaoNota } from '../api';
import { formatar } from '../datas';
import { Pill, type Tom } from './Basicos';
import { Campo } from './Campo';

// Peças comuns das telas de notas oficiais (L15). Texto literal, sem pressão e sem comparação.
export const nota1 = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const ROTULO_PERFIL: Record<Perfil, string> = {
  admin: 'Administração',
  professor: 'Professor',
  aluno: 'Aluno',
  pedagogico: 'Pedagógico e apoio',
  responsavel: 'Responsável',
};

const ESTADO: Record<EstadoPedido, { tom: Tom; rotulo: string; frase: string }> = {
  aberto: { tom: 'amber', rotulo: 'Aberto', frase: 'Aguardando a resposta do professor.' },
  revisada: { tom: 'teal', rotulo: 'Nota revisada', frase: 'O professor revisou a nota.' },
  mantida: { tom: 'blue', rotulo: 'Nota mantida', frase: 'O professor manteve a nota.' },
};
export const EstadoDoPedido = ({ estado }: { estado: EstadoPedido }) => (
  <Pill tom={ESTADO[estado].tom}>{ESTADO[estado].rotulo}</Pill>
);
export const fraseDoEstado = (estado: EstadoPedido) => ESTADO[estado].frase;

// Valor com a barra de 0 a 10: o número nunca aparece sozinho
export function ValorDaNota({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="nota-valor">
      <strong>{nota1(valor)}</strong> <span className="muted small">de 10</span>
      <div
        className="progress"
        role="progressbar"
        aria-label={rotulo}
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={10}
      >
        <span style={{ width: `${valor * 10}%` }} />
      </div>
    </div>
  );
}

// Histórico: a versão anterior continua visível ao professor e ao Admin
export function Historico({ versoes }: { versoes: VersaoNota[] }) {
  if (versoes.length < 2) return null;
  return (
    <details className="historico">
      <summary>Ver versões anteriores ({versoes.length - 1})</summary>
      <ul className="lista-simples">
        {versoes.map((v) => (
          <li key={v.numero}>
            <strong>Versão {v.numero}</strong>: {nota1(v.valor)} · {formatar(v.dia)} ·{' '}
            {v.autor_nome}
            {v.motivo ? <div className="small muted">Motivo: {v.motivo}</div> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Texto curto com limite; avisa o limite sem contar tempo
export function CampoTexto({
  rotulo,
  dica,
  valor,
  aoMudar,
  limite,
  erro,
}: {
  rotulo: string;
  dica?: string;
  valor: string;
  aoMudar: (v: string) => void;
  limite: number;
  erro?: string;
}) {
  return (
    <Campo rotulo={rotulo} dica={dica ?? `Até ${limite} letras. Sem links.`} erro={erro} cheio>
      {({ id, descricao }) => (
        <textarea
          id={id}
          aria-describedby={descricao}
          aria-invalid={erro ? true : undefined}
          value={valor}
          maxLength={limite}
          rows={3}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )}
    </Campo>
  );
}

// Formulário de revisão: novo valor e motivo obrigatório. A nota anterior não é apagada.
export function FormRevisao({
  valorAtual,
  aoEnviar,
  aoCancelar,
}: {
  valorAtual: number;
  aoEnviar: (valor: number, motivo: string) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erroValor, setErroValor] = useState('');
  const [erroMotivo, setErroMotivo] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const n = Number(valor.replace(',', '.'));
    setErroValor('');
    setErroMotivo('');
    if (valor === '' || Number.isNaN(n) || n < 0 || n > 10) {
      return setErroValor('Informe uma nota de 0 a 10.');
    }
    if (!motivo.trim()) return setErroMotivo('Escreva o motivo da revisão.');
    await aoEnviar(n, motivo.trim());
  }
  return (
    <form className="form-inline" onSubmit={enviar} noValidate>
      <p className="small muted">
        Nota atual: {nota1(valorAtual)}. A revisão grava uma nova versão. A anterior continua
        registrada.
      </p>
      <Campo rotulo="Nova nota (0 a 10)" erro={erroValor}>
        {({ id, descricao }) => (
          <input
            id={id}
            aria-describedby={descricao}
            aria-invalid={erroValor ? true : undefined}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        )}
      </Campo>
      <CampoTexto
        rotulo="Motivo da revisão"
        valor={motivo}
        aoMudar={setMotivo}
        limite={300}
        erro={erroMotivo}
      />
      <div className="blocos">
        <button type="submit" className="btn btn-primary">
          Salvar revisão
        </button>
        <button type="button" className="btn btn-outline" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
