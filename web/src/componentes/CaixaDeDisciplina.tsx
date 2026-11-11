import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { api, type DisciplinaAluno, type DisciplinaCatalogo, ErroApi } from '../api';
import { useCarregar } from './useCarregar';

// Caixa de busca de disciplina (L20b), no padrão WAI-ARIA "combobox com lista".
// Digitar as iniciais filtra; acento e maiúscula não importam; funciona só com teclado
// (setas, Enter, Esc) e com leitor de tela. Última opção: "Criar a disciplina ...".
export type EscolhaDeDisciplina = { id: string; nome: string };

type Props = {
  id: string;
  descricao?: string | undefined;
  valor: string;
  aoDigitar: (texto: string) => void;
  aoEscolher: (e: EscolhaDeDisciplina) => void;
};

// Mesma regra do banco (função sem_acento): sem acento, minúsculas, sem espaços nas pontas
export const semAcento = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

// Casa com o nome (em qualquer ponto), com um sinônimo (POO, FLA) ou com as iniciais das palavras
export function casa(consulta: string, nome: string, sinonimos: string[] = []): boolean {
  const q = semAcento(consulta);
  if (!q) return true;
  const n = semAcento(nome);
  const iniciais = n
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .map((p) => p[0])
    .join('');
  return (
    n.includes(q) ||
    sinonimos.some((s) => semAcento(s).includes(q)) ||
    (q.length >= 2 && iniciais.startsWith(q))
  );
}

type Opcao =
  | { tipo: 'minha'; chave: string; nome: string; disciplina: DisciplinaAluno }
  | { tipo: 'catalogo'; chave: string; nome: string; catalogo: DisciplinaCatalogo }
  | { tipo: 'criar'; chave: string; nome: string };

export function CaixaDeDisciplina({ id, descricao, valor, aoDigitar, aoEscolher }: Props) {
  const { dados, recarregar } = useCarregar(api.minhasDisciplinas);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(0);
  const [aviso, setAviso] = useState('');
  const idLista = `${useId()}-lista`;
  const entrada = useRef<HTMLInputElement>(null);

  const minhas = dados?.minhas ?? [];
  const catalogo = dados?.catalogo ?? [];

  const opcoes = useMemo<Opcao[]>(() => {
    const q = semAcento(valor);
    const lista: Opcao[] = minhas
      .filter((d) => casa(valor, d.nome, catalogo.find((k) => k.id === d.catalogo_id)?.sinonimos))
      .map((d) => ({ tipo: 'minha', chave: `m-${d.id}`, nome: d.nome, disciplina: d }));
    // Do catálogo, só as que o aluno ainda não tem, e só quando ele já digitou algo
    if (q) {
      const tenho = new Set(minhas.map((d) => semAcento(d.nome)));
      for (const k of catalogo)
        if (!tenho.has(semAcento(k.nome)) && casa(valor, k.nome, k.sinonimos))
          lista.push({ tipo: 'catalogo', chave: `k-${k.id}`, nome: k.nome, catalogo: k });
      const igual = lista.some((o) => semAcento(o.nome) === q);
      if (!igual && valor.trim().length <= 80)
        lista.push({ tipo: 'criar', chave: 'criar', nome: valor.trim() });
    }
    return lista;
  }, [valor, minhas, catalogo]);

  // A opção ativa nunca passa do fim da lista
  useEffect(() => {
    setAtiva((a) => Math.min(a, Math.max(0, opcoes.length - 1)));
  }, [opcoes.length]);

  async function escolher(o: Opcao) {
    setAviso('');
    try {
      if (o.tipo === 'minha') {
        aoEscolher({ id: o.disciplina.id, nome: o.disciplina.nome });
      } else {
        const { disciplina } = await api.criarMinhaDisciplina(
          o.tipo === 'catalogo' ? { catalogo_id: o.catalogo.id } : { nome: o.nome },
        );
        await recarregar();
        aoEscolher({ id: disciplina.id, nome: disciplina.nome });
      }
      setAberta(false);
    } catch (x) {
      // Já existe com esse nome: usa a que existe
      if (x instanceof ErroApi && x.status === 409 && o.tipo !== 'minha') {
        const atual = (await api.minhasDisciplinas()).minhas.find(
          (d) => semAcento(d.nome) === semAcento(o.nome),
        );
        if (atual) {
          await recarregar();
          aoEscolher({ id: atual.id, nome: atual.nome });
          setAberta(false);
          return;
        }
      }
      setAviso(x instanceof ErroApi ? x.message : 'Não foi possível salvar a disciplina.');
    }
  }

  function tecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberta(true);
      setAtiva((a) => Math.min(a + 1, opcoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtiva((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && aberta && opcoes[ativa]) {
      e.preventDefault();
      void escolher(opcoes[ativa] as Opcao);
    } else if (e.key === 'Escape' && aberta) {
      e.preventDefault();
      setAberta(false);
    }
  }

  const rotuloOpcao = (o: Opcao) =>
    o.tipo === 'criar'
      ? `Criar a disciplina "${o.nome}"`
      : o.tipo === 'catalogo'
        ? `${o.nome} (adicionar à minha lista)`
        : o.nome;

  return (
    <div className="combo">
      <input
        ref={entrada}
        id={id}
        role="combobox"
        aria-expanded={aberta}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberta && opcoes[ativa] ? `${idLista}-${ativa}` : undefined}
        aria-describedby={descricao}
        autoComplete="off"
        value={valor}
        maxLength={80}
        onChange={(e) => {
          aoDigitar(e.target.value);
          setAberta(true);
          setAtiva(0);
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        onKeyDown={tecla}
      />
      <div
        id={idLista}
        role="listbox"
        aria-label="Disciplinas"
        className="combo-lista"
        hidden={!aberta || opcoes.length === 0}
      >
        {opcoes.map((o, i) => (
          <div
            key={o.chave}
            id={`${idLista}-${i}`}
            role="option"
            aria-selected={i === ativa}
            className={`combo-opcao${i === ativa ? ' ativa' : ''}${o.tipo === 'criar' ? ' criar' : ''}`}
            // mouseDown (não click): escolhe antes de o campo perder o foco
            onMouseDown={(e) => {
              e.preventDefault();
              void escolher(o);
            }}
            tabIndex={-1}
          >
            {rotuloOpcao(o)}
          </div>
        ))}
      </div>
      {/* Leitor de tela: quantas opções há, sem mexer no foco */}
      <div className="sr-only" role="status" aria-live="polite">
        {aberta ? `${opcoes.length} ${opcoes.length === 1 ? 'opção' : 'opções'}` : ''}
      </div>
      {aviso ? (
        <div className="field-hint" role="alert">
          {aviso}
        </div>
      ) : null}
    </div>
  );
}
