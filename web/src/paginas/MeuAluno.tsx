import { useState } from 'react';
import { api, ErroApi, type ItemAcompanhado } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Progresso, Titulo } from '../componentes/Basicos';
import { LeituraAluno } from '../componentes/LeituraAluno';
import { useCarregar } from '../componentes/useCarregar';
import { paraTexto, relativo } from '../datas';

// L22a-3: "Meu aluno". O representante legal de aluno MENOR lê tudo, só leitura (A-074, A-091).
// Um item por vez. Sem lista de alunos, média, ordem por dificuldade nem comparação. Não é diagnóstico.
// Aluno com 18 anos ou mais: nada é lido aqui; vale só o que o aluno liberar em "Quem pode ver meus dados".
const ITENS: { item: ItemAcompanhado; rotulo: string }[] = [
  { item: 'tarefas', rotulo: 'Tarefas e plano' },
  { item: 'agenda', rotulo: 'Agenda' },
  { item: 'notas', rotulo: 'Notas' },
  { item: 'mensagens', rotulo: 'Mensagens' },
  { item: 'disciplinas', rotulo: 'Disciplinas' },
  { item: 'dificuldade', rotulo: 'Nível de dificuldade' },
];
const dataCurta = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;

export function MeuAluno() {
  const { dados: ficha, erro, carregando } = useCarregar(api.representadoFicha);
  const [aberto, setAberto] = useState<{
    item: ItemAcompanhado;
    dados: Record<string, unknown>[];
  } | null>(null);
  const [falha, setFalha] = useState('');

  async function ver(item: ItemAcompanhado) {
    setFalha('');
    try {
      setAberto({ item, dados: (await api.representadoLer(item)).dados });
    } catch (x) {
      setAberto(null);
      setFalha(x instanceof ErroApi ? x.message : 'Não foi possível abrir.');
    }
  }

  if (carregando) return <Carregando />;
  if (erro || !ficha)
    return (
      <div className="stack">
        <Titulo olho="Representante legal" titulo="Meu aluno" sub="Só leitura." />
        <Aviso tipo="warn">{erro || 'Não foi possível carregar.'}</Aviso>
      </div>
    );

  // Aviso de 30 dias antes dos 18 anos: palavra, data e barra
  const dias = ficha.dias_para_18;
  const perto = ficha.menor && dias !== null && dias <= 30;
  return (
    <div className="stack">
      <Titulo
        olho="Representante legal"
        titulo="Meu aluno"
        sub={`${ficha.aluno_nome}. Você só lê: não muda nada.`}
      />
      <Aviso tipo="info">
        {ficha.menor
          ? 'Você vê como representante legal do aluno menor de idade. Cada leitura fica registrada. Estes dados não são um diagnóstico.'
          : 'O aluno tem 18 anos ou mais. Você vê só o que ele liberar. Peça que ele indique você em "Quem pode ver meus dados".'}
      </Aviso>
      {perto && ficha.maior_em ? (
        <div className="card stack">
          <p className="small">
            O aluno faz 18 anos {relativo(ficha.maior_em, paraTexto(new Date()))} (
            {dataCurta(ficha.maior_em)}). Depois disso, você vê só o que ele liberar.
          </p>
          <Progresso
            percentual={Math.round(((30 - Math.max(0, dias ?? 0)) / 30) * 100)}
            rotulo="Quanto falta para o aluno fazer 18 anos"
          />
        </div>
      ) : null}
      {falha ? <Aviso tipo="warn">{falha}</Aviso> : null}
      {ficha.menor ? (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {ITENS.map((i) => (
              <button
                key={i.item}
                type="button"
                className="btn btn-soft"
                style={{ minHeight: 44 }}
                aria-pressed={aberto?.item === i.item}
                onClick={() => void ver(i.item)}
              >
                {i.rotulo}
              </button>
            ))}
          </div>
          {aberto ? <LeituraAluno item={aberto.item} dados={aberto.dados} /> : null}
        </>
      ) : null}
    </div>
  );
}
