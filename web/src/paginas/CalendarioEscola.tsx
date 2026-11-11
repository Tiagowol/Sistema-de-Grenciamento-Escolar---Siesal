import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import {
  api,
  ErroApi,
  type ItemEscolar,
  type NovoItemEscolar,
  type Perfil,
  type TipoItemEscolar,
  type TurmaLista,
} from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto } from '../datas';
import { Icone, type NomeIcone } from '../icones';

// Calendário da escola (L19). O Admin cadastra períodos letivos, feriados e eventos; os outros perfis leem.
// Nada se apaga: desativar grava uma versão. Os itens entram no Calendário e na Agenda do aluno, sem cópia.
const TIPOS: { valor: TipoItemEscolar; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'periodo_letivo', rotulo: 'Período letivo', icone: 'book' },
  { valor: 'feriado', rotulo: 'Feriado', icone: 'sun' },
  { valor: 'evento', rotulo: 'Evento da escola', icone: 'school' },
];
const nomeDoTipo = (t: TipoItemEscolar) => TIPOS.find((x) => x.valor === t) as (typeof TIPOS)[0];
const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);

const VAZIO = (dia: string): NovoItemEscolar => ({
  tipo: 'evento',
  titulo: '',
  dia_inicio: dia,
  dia_fim: dia,
  turma_id: null,
});

export function CalendarioEscola({ perfil }: { perfil: Perfil }) {
  const admin = perfil === 'admin';
  const hoje = paraTexto(new Date());
  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const { dados, erro, carregando, recarregar } = useCarregar(
    () => api.calendarioEscola(`${ano}-01-01`, `${ano}-12-31`),
    [ano],
  );
  const [turmas, setTurmas] = useState<TurmaLista[]>([]);
  const [rascunho, setRascunho] = useState<NovoItemEscolar>(VAZIO(hoje));
  const [editando, setEditando] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (admin)
      api
        .turmas()
        .then(({ turmas: t }) => setTurmas(t.filter((x) => x.ativa)))
        .catch(() => undefined);
  }, [admin]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk('');
    if (!rascunho.titulo.trim()) return setMsg('Escreva o nome do item.');
    if (rascunho.dia_fim < rascunho.dia_inicio)
      return setMsg('O último dia precisa ser igual ou depois do primeiro dia.');
    try {
      const corpo = { ...rascunho, titulo: rascunho.titulo.trim() };
      if (editando) await api.editarItemEscolar(editando, corpo);
      else await api.criarItemEscolar(corpo);
      setOk(editando ? 'Item alterado. A versão anterior ficou guardada.' : 'Item cadastrado.');
      setEditando(null);
      setRascunho(VAZIO(hoje));
      await recarregar();
    } catch (x) {
      setMsg(mensagem(x, 'Não foi possível salvar. Tente de novo.'));
    }
  }

  async function desativar(item: ItemEscolar) {
    setMsg('');
    setOk('');
    try {
      await api.desativarItemEscolar(item.id);
      setOk(
        `"${item.titulo}" foi desativado. Ele some dos calendários; o histórico fica guardado.`,
      );
      await recarregar();
    } catch (x) {
      setMsg(mensagem(x, 'Não foi possível desativar. Tente de novo.'));
    }
  }

  const itens = dados?.itens ?? [];
  return (
    <div className="pag-calendario-escola">
      <Titulo
        olho={admin ? 'Administração' : 'Escola'}
        titulo="Calendário da escola"
        sub={
          admin
            ? 'Períodos letivos, feriados e eventos. Eles aparecem no Calendário e na Agenda dos alunos. Use só dados fictícios.'
            : 'Períodos letivos, feriados e eventos cadastrados pela escola.'
        }
      />
      {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}

      <div className={admin ? 'grid cols-2' : ''}>
        <section className="card" aria-labelledby="cal-escola-lista">
          <div className="card-head">
            <h2 id="cal-escola-lista">Itens de {ano}</h2>
            <div className="actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAno(ano - 1)}
                aria-label={`Ver o ano ${ano - 1}`}
              >
                {ano - 1}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setAno(ano + 1)}
                aria-label={`Ver o ano ${ano + 1}`}
              >
                {ano + 1}
              </button>
            </div>
          </div>
          {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
          {carregando ? (
            <Carregando />
          ) : itens.length === 0 ? (
            <Vazio>Nenhum item neste ano.</Vazio>
          ) : (
            <ul className="lista-escola">
              {itens.map((i) => {
                const t = nomeDoTipo(i.tipo);
                return (
                  <li key={i.id} className="item-escola">
                    <div className="item-escola-tipo">
                      <Icone nome={t.icone} />
                      <span>{t.rotulo}</span>
                    </div>
                    <div className="item-escola-corpo">
                      <strong>{i.titulo}</strong>
                      <div className="small muted">
                        {i.turma_nome ? `Turma ${i.turma_nome}` : 'Escola toda'}
                        {i.dia_fim !== i.dia_inicio
                          ? ` · de ${formatar(i.dia_inicio)} a ${formatar(i.dia_fim)}`
                          : ''}
                      </div>
                      <div className="small">
                        <TempoVisual
                          prazo={i.dia_inicio}
                          hoje={hoje}
                          passado={i.dia_inicio < hoje}
                        />
                      </div>
                    </div>
                    {admin ? (
                      <div className="item-escola-acoes">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setEditando(i.id);
                            setRascunho({
                              tipo: i.tipo,
                              titulo: i.titulo,
                              dia_inicio: i.dia_inicio,
                              dia_fim: i.dia_fim,
                              turma_id: i.turma_id,
                            });
                          }}
                        >
                          Editar<span className="sr-only"> {i.titulo}</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => void desativar(i)}
                        >
                          Desativar<span className="sr-only"> {i.titulo}</span>
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {admin ? (
          <form className="card" onSubmit={salvar} noValidate aria-labelledby="cal-escola-form">
            <div className="card-head">
              <h2 id="cal-escola-form">{editando ? 'Alterar item' : 'Cadastrar item'}</h2>
            </div>
            <div className="form-grid">
              <Campo rotulo="Tipo" cheio>
                {({ id }) => (
                  <select
                    id={id}
                    value={rascunho.tipo}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, tipo: e.target.value as TipoItemEscolar })
                    }
                  >
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo
                rotulo="Nome"
                dica="Exemplo: 1º bimestre, Feriado municipal, Feira de ciências"
                cheio
              >
                {({ id, descricao }) => (
                  <input
                    id={id}
                    aria-describedby={descricao}
                    value={rascunho.titulo}
                    maxLength={120}
                    onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })}
                  />
                )}
              </Campo>
              <Campo rotulo="Primeiro dia">
                {({ id }) => (
                  <input
                    id={id}
                    type="date"
                    value={rascunho.dia_inicio}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        dia_inicio: e.target.value,
                        // O último dia acompanha o primeiro quando ficaria antes dele
                        dia_fim: [rascunho.dia_fim, e.target.value].sort()[1] ?? e.target.value,
                      })
                    }
                  />
                )}
              </Campo>
              <Campo rotulo="Último dia" dica="Igual ao primeiro, se for um dia só">
                {({ id, descricao }) => (
                  <input
                    id={id}
                    type="date"
                    aria-describedby={descricao}
                    value={rascunho.dia_fim}
                    min={rascunho.dia_inicio}
                    onChange={(e) => setRascunho({ ...rascunho, dia_fim: e.target.value })}
                  />
                )}
              </Campo>
              <Campo rotulo="Para quem" cheio>
                {({ id }) => (
                  <select
                    id={id}
                    value={rascunho.turma_id ?? ''}
                    onChange={(e) => setRascunho({ ...rascunho, turma_id: e.target.value || null })}
                  >
                    <option value="">Escola toda</option>
                    {turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        Só a turma {t.nome}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            </div>
            <div className="actions mt-sm">
              <button type="submit" className="btn btn-primary">
                {editando ? 'Salvar alteração' : 'Cadastrar'}
              </button>
              {editando ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setEditando(null);
                    setRascunho(VAZIO(hoje));
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
