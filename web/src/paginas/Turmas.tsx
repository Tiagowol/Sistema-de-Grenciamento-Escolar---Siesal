import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type DisciplinaLista,
  ErroApi,
  type NovoVinculo,
  type TipoVinculo,
  type TurmaLista,
  type Turno,
  type UsuarioLista,
  type VinculoLista,
} from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';
import { formatar } from '../datas';
import { Icone, type NomeIcone } from '../icones';

// Parte do dia com nome e ícone (nunca só a hora)
const TURNOS: { valor: Turno; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'manha', rotulo: 'Manhã', icone: 'sun' },
  { valor: 'tarde', rotulo: 'Tarde', icone: 'sunset' },
  { valor: 'noite', rotulo: 'Noite', icone: 'moon' },
];
const TIPOS: { valor: TipoVinculo; rotulo: string }[] = [
  { valor: 'professor_turma', rotulo: 'Professor em uma turma e disciplina' },
  { valor: 'aluno_turma', rotulo: 'Aluno em uma turma' },
  { valor: 'responsavel_aluno', rotulo: 'Responsável por um aluno' },
];
const PERFIL_DO_TIPO: Record<TipoVinculo, string> = {
  professor_turma: 'professor',
  aluno_turma: 'aluno',
  responsavel_aluno: 'responsavel',
};
const ROTULO_PESSOA: Record<TipoVinculo, string> = {
  professor_turma: 'Professor',
  aluno_turma: 'Aluno',
  responsavel_aluno: 'Responsável',
};

const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);

function descreverVinculo(v: VinculoLista): string {
  if (v.tipo === 'professor_turma')
    return `${v.usuario_nome} ensina ${v.disciplina_nome} na turma ${v.turma_nome}`;
  if (v.tipo === 'aluno_turma') return `${v.usuario_nome} está na turma ${v.turma_nome}`;
  return `${v.usuario_nome} é responsável por ${v.aluno_nome}`;
}

export function Turmas() {
  const [turmas, setTurmas] = useState<TurmaLista[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaLista[]>([]);
  const [vinculos, setVinculos] = useState<VinculoLista[]>([]);
  const [pessoas, setPessoas] = useState<UsuarioLista[]>([]);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  const [nomeTurma, setNomeTurma] = useState('');
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [turno, setTurno] = useState<Turno>('manha');
  const [nomeDisc, setNomeDisc] = useState('');

  const [tipo, setTipo] = useState<TipoVinculo>('aluno_turma');
  const [pessoa, setPessoa] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [discId, setDiscId] = useState('');
  const [alunoId, setAlunoId] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [t, d, v, u] = await Promise.all([
        api.turmas(),
        api.disciplinas(),
        api.vinculos(),
        api.usuarios(),
      ]);
      setTurmas(t.turmas);
      setDisciplinas(d.disciplinas);
      setVinculos(v.vinculos);
      setPessoas(u.usuarios);
    } catch (x) {
      setErro(mensagem(x, 'Não foi possível carregar. Tente de novo.'));
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Executa uma ação, mostra o resultado e recarrega as listas
  async function agir(acao: () => Promise<unknown>, feito: string, padrao: string) {
    setErro('');
    setOk('');
    try {
      await acao();
      setOk(feito);
      await carregar();
      return true;
    } catch (x) {
      setErro(mensagem(x, padrao));
      return false;
    }
  }

  async function criarTurma(e: FormEvent) {
    e.preventDefault();
    const anoNumero = Number(ano);
    if (!nomeTurma.trim() || !Number.isInteger(anoNumero)) {
      setErro('Informe o nome da turma e o ano.');
      return;
    }
    const feito = await agir(
      () => api.criarTurma({ nome: nomeTurma.trim(), ano_letivo: anoNumero, turno }),
      `Turma ${nomeTurma.trim()} cadastrada.`,
      'Não foi possível cadastrar a turma.',
    );
    if (feito) setNomeTurma('');
  }

  async function criarDisciplina(e: FormEvent) {
    e.preventDefault();
    if (!nomeDisc.trim()) {
      setErro('Informe o nome da disciplina.');
      return;
    }
    const feito = await agir(
      () => api.criarDisciplina({ nome: nomeDisc.trim() }),
      `Disciplina ${nomeDisc.trim()} cadastrada.`,
      'Não foi possível cadastrar a disciplina.',
    );
    if (feito) setNomeDisc('');
  }

  async function vincular(e: FormEvent) {
    e.preventDefault();
    let corpo: NovoVinculo | null = null;
    if (tipo === 'professor_turma' && pessoa && turmaId && discId)
      corpo = { tipo, usuario_id: pessoa, turma_id: turmaId, disciplina_id: discId };
    if (tipo === 'aluno_turma' && pessoa && turmaId)
      corpo = { tipo, usuario_id: pessoa, turma_id: turmaId };
    if (tipo === 'responsavel_aluno' && pessoa && alunoId)
      corpo = { tipo, usuario_id: pessoa, aluno_id: alunoId };
    if (!corpo) {
      setErro('Escolha todas as opções do vínculo.');
      return;
    }
    const novo = corpo;
    const feito = await agir(
      () => api.criarVinculo(novo),
      'Vínculo cadastrado.',
      'Não foi possível vincular.',
    );
    if (feito) {
      setPessoa('');
      setAlunoId('');
    }
  }

  const ativas = <T extends { ativa: boolean }>(lista: T[]) => lista.filter((i) => i.ativa);
  const pessoasDoTipo = pessoas.filter(
    (p) => p.perfil === PERFIL_DO_TIPO[tipo] && p.situacao === 'ativo',
  );
  const alunos = pessoas.filter((p) => p.perfil === 'aluno' && p.situacao === 'ativo');

  return (
    <div className="pag-turmas">
      <div className="page-title">
        <div>
          <div className="eyebrow">Administração</div>
          <h1>Turmas e vínculos</h1>
          <p>Use somente dados fictícios. Nada é apagado: a turma ou o vínculo fica inativo.</p>
        </div>
      </div>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}

      <div className="grid cols-2">
        <form className="card" onSubmit={criarTurma} noValidate>
          <div className="card-head">
            <h2>Cadastrar turma</h2>
          </div>
          <div className="form-grid">
            <Campo rotulo="Nome da turma" dica="Exemplo: 7º A" cheio>
              {({ id, descricao }) => (
                <input
                  id={id}
                  aria-describedby={descricao}
                  value={nomeTurma}
                  maxLength={80}
                  onChange={(e) => setNomeTurma(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Ano letivo">
              {({ id }) => (
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={2000}
                  max={2100}
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                />
              )}
            </Campo>
            <fieldset className="blocos cheio">
              <legend>Parte do dia</legend>
              {TURNOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  aria-pressed={turno === t.valor}
                  className={`btn btn-sm btn-bloco ${turno === t.valor ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setTurno(t.valor)}
                >
                  <Icone nome={t.icone} /> {t.rotulo}
                </button>
              ))}
            </fieldset>
          </div>
          <button type="submit" className="btn btn-primary mt-sm">
            <Icone nome="plus" /> Cadastrar turma
          </button>
        </form>

        <form className="card" onSubmit={criarDisciplina} noValidate>
          <div className="card-head">
            <h2>Cadastrar disciplina</h2>
          </div>
          <Campo rotulo="Nome da disciplina" dica="Exemplo: Matemática" cheio>
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                value={nomeDisc}
                maxLength={80}
                onChange={(e) => setNomeDisc(e.target.value)}
              />
            )}
          </Campo>
          <button type="submit" className="btn btn-primary mt-sm">
            <Icone nome="plus" /> Cadastrar disciplina
          </button>
        </form>
      </div>

      <form className="card mt" onSubmit={vincular} noValidate>
        <div className="card-head">
          <h2>Vincular pessoas</h2>
        </div>
        <div className="form-grid">
          <Campo rotulo="Tipo de vínculo" cheio>
            {({ id }) => (
              <select
                id={id}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoVinculo);
                  setPessoa('');
                }}
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo={ROTULO_PESSOA[tipo]}>
            {({ id }) => (
              <select id={id} value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
                <option value="">Escolha…</option>
                {pessoasDoTipo.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          {tipo !== 'responsavel_aluno' ? (
            <Campo rotulo="Turma">
              {({ id }) => (
                <select id={id} value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {ativas(turmas).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.ano_letivo})
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          ) : (
            <Campo rotulo="Aluno">
              {({ id }) => (
                <select id={id} value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {alunos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          )}
          {tipo === 'professor_turma' ? (
            <Campo rotulo="Disciplina">
              {({ id }) => (
                <select id={id} value={discId} onChange={(e) => setDiscId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {ativas(disciplinas).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary mt-sm">
          <Icone nome="plus" /> Vincular
        </button>
      </form>

      <section className="card mt" aria-labelledby="h-turmas">
        <div className="card-head">
          <h2 id="h-turmas">Turmas</h2>
        </div>
        {turmas.length === 0 ? <p className="muted">Nenhuma turma cadastrada ainda.</p> : null}
        <ul className="lista-adm">
          {turmas.map((t) => {
            const parte = TURNOS.find((x) => x.valor === t.turno);
            return (
              <li key={t.id} className={t.ativa ? '' : 'inativo'}>
                <div className="lista-adm-texto">
                  <strong>{t.nome}</strong> · {t.ano_letivo}
                  <div className="small muted">
                    {parte ? <Icone nome={parte.icone} /> : null} {parte?.rotulo} · {t.alunos}{' '}
                    {t.alunos === 1 ? 'aluno' : 'alunos'} · {t.professores}{' '}
                    {t.professores === 1 ? 'professor' : 'professores'} · criada em{' '}
                    {formatar(t.criado_em)}
                    {t.ativa ? '' : ' · inativa'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    void agir(
                      () => (t.ativa ? api.inativarTurma(t.id) : api.reativarTurma(t.id)),
                      t.ativa ? `Turma ${t.nome} inativada.` : `Turma ${t.nome} reativada.`,
                      'Não foi possível mudar a turma.',
                    )
                  }
                >
                  {t.ativa ? 'Inativar' : 'Reativar'}
                  <span className="sr-only"> turma {t.nome}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card mt" aria-labelledby="h-disc">
        <div className="card-head">
          <h2 id="h-disc">Disciplinas</h2>
        </div>
        {disciplinas.length === 0 ? (
          <p className="muted">Nenhuma disciplina cadastrada ainda.</p>
        ) : null}
        <ul className="lista-adm">
          {disciplinas.map((d) => (
            <li key={d.id} className={d.ativa ? '' : 'inativo'}>
              <div className="lista-adm-texto">
                <strong>{d.nome}</strong>
                <div className="small muted">
                  criada em {formatar(d.criado_em)}
                  {d.ativa ? '' : ' · inativa'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  void agir(
                    () => (d.ativa ? api.inativarDisciplina(d.id) : api.reativarDisciplina(d.id)),
                    d.ativa ? `Disciplina ${d.nome} inativada.` : `Disciplina ${d.nome} reativada.`,
                    'Não foi possível mudar a disciplina.',
                  )
                }
              >
                {d.ativa ? 'Inativar' : 'Reativar'}
                <span className="sr-only"> disciplina {d.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mt" aria-labelledby="h-vinc">
        <div className="card-head">
          <h2 id="h-vinc">Vínculos ativos</h2>
        </div>
        {vinculos.length === 0 ? <p className="muted">Nenhum vínculo ainda.</p> : null}
        <ul className="lista-adm">
          {vinculos.map((v) => (
            <li key={v.id}>
              <div className="lista-adm-texto">
                {descreverVinculo(v)}
                <div className="small muted">desde {formatar(v.criado_em)}</div>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  void agir(
                    () => api.inativarVinculo(v.id),
                    'Vínculo inativado.',
                    'Não foi possível inativar o vínculo.',
                  )
                }
              >
                Inativar<span className="sr-only"> vínculo: {descreverVinculo(v)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
