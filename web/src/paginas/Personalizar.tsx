import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi } from '../api';
import { AjustesInterface } from '../componentes/AjustesInterface';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { Icone, type NomeIcone } from '../icones';
import { INTERFACE_PADRAO, type Interface } from '../interface';
import { CORES, combinacaoLegivel, ICONES_DE_TIPO, type Tema } from '../paleta';
import { type Preferencias, temaDe } from '../preferencias';

// Personalizar (L17b): aparência, apelido, tela inicial e tipos de atividade próprios.
// Toda cor passa pelo contraste mínimo: cor que fica difícil de ler no tema escolhido não pode ser marcada.
type Props = {
  valor: Preferencias;
  aoMudar: (p: Preferencias) => void;
  aoPadrao: () => void;
  interfaceAtual?: Interface; // L17d; sem valor, vale o padrão
  aoMudarInterface?: (p: Interface) => void;
};

const TEMAS: { id: Tema; nome: string; texto: string }[] = [
  { id: 'claro', nome: 'Claro', texto: 'Fundo claro.' },
  { id: 'escuro', nome: 'Escuro', texto: 'Fundo escuro, bom para pouca luz.' },
  { id: 'alto_contraste', nome: 'Alto contraste', texto: 'Cores mais fortes e bordas marcadas.' },
];
const TELAS: { id: Preferencias['telaInicial']; nome: string }[] = [
  { id: 'meudia', nome: 'Meu dia' },
  { id: 'agenda', nome: 'Agenda' },
  { id: 'calendario', nome: 'Calendário' },
];
const NOMES_ICONES: Record<(typeof ICONES_DE_TIPO)[number], string> = {
  book: 'Livro',
  tasks: 'Lista',
  focus: 'Foco',
  spark: 'Faísca',
  heart: 'Coração',
  school: 'Escola',
  clock: 'Relógio',
  chart: 'Gráfico',
  file: 'Papel',
  message: 'Mensagem',
  calendar: 'Calendário',
};

function Chave({
  titulo,
  texto,
  ligado,
  aoMudar,
}: {
  titulo: string;
  texto: string;
  ligado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  const id = `pz-${titulo.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="setting">
      <div className="flex-between">
        <label id={`${id}-r`} htmlFor={id}>
          <b>{titulo}</b>
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          className="switch"
          aria-checked={ligado}
          aria-labelledby={`${id}-r`}
          onClick={() => aoMudar(!ligado)}
        />
      </div>
      <p>{texto}</p>
    </div>
  );
}

function TiposDeAtividade() {
  const { dados, erro, recarregar } = useCarregar(api.tiposAtividade);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState<string>(CORES[0].id);
  const [icone, setIcone] = useState<string>(ICONES_DE_TIPO[0]);
  const [msg, setMsg] = useState('');

  async function criar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!nome.trim()) return setMsg('Escreva o nome do tipo.');
    try {
      await api.criarTipoAtividade({ nome: nome.trim(), cor, icone });
      setNome('');
      await recarregar();
    } catch (x) {
      setMsg(x instanceof ErroApi ? x.message : 'Não foi possível salvar.');
    }
  }

  return (
    <section className="card mt" aria-labelledby="pz-tipos">
      <h2 id="pz-tipos">Seus tipos de atividade</h2>
      <p className="muted small">
        Crie tipos como "leitura", "projeto" ou "treino". Só você vê os seus. Eles aparecem em
        Atividades e no Calendário.
      </p>
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {dados && dados.tipos.length === 0 ? <Vazio>Você ainda não criou tipos.</Vazio> : null}
      <ul className="cal-lista mt-sm">
        {(dados?.tipos ?? []).map((t) => (
          <li key={t.id} className="cal-evento">
            <div className="cal-parte">
              <Icone nome={t.icone as NomeIcone} />
              <strong>{t.nome}</strong>
            </div>
            <div className="small muted">
              Cor: {CORES.find((c) => c.id === t.cor)?.nome ?? t.cor}
            </div>
            <div className="cal-acoes">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  await api.removerTipoAtividade(t.id);
                  await recarregar();
                }}
              >
                Remover<span className="sr-only"> o tipo {t.nome}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={criar} noValidate aria-label="Novo tipo de atividade" className="mt">
        {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
        <div className="stack">
          <Campo rotulo="Nome do tipo">
            {({ id }) => (
              <input
                id={id}
                value={nome}
                maxLength={40}
                onChange={(e) => setNome(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Cor do tipo">
            {({ id }) => (
              <select id={id} value={cor} onChange={(e) => setCor(e.target.value)}>
                {CORES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Ícone do tipo">
            {({ id }) => (
              <select id={id} value={icone} onChange={(e) => setIcone(e.target.value)}>
                {ICONES_DE_TIPO.map((i) => (
                  <option key={i} value={i}>
                    {NOMES_ICONES[i]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <button type="submit" className="btn btn-primary">
            <Icone nome="plus" /> Criar tipo
          </button>
        </div>
      </form>
    </section>
  );
}

export function Personalizar({
  valor,
  aoMudar,
  aoPadrao,
  interfaceAtual = INTERFACE_PADRAO,
  aoMudarInterface = () => undefined,
}: Props) {
  const tema = temaDe(valor);
  const [msg, setMsg] = useState('');
  const mudar = (p: Partial<Preferencias>) => {
    setMsg('');
    const novo = { ...valor, ...p };
    // Trocar o tema nunca deixa uma cor difícil de ler: se a cor não serve no tema novo, volta à do tema
    if (novo.cor && !combinacaoLegivel(novo.cor, temaDe(novo))) novo.cor = null;
    aoMudar(novo);
  };
  const escolherTema = (t: Tema) =>
    mudar({ escuro: t === 'escuro', contraste: t === 'alto_contraste' });

  return (
    <>
      <Titulo
        olho="Preferências"
        titulo="Personalizar"
        sub="Escolha como o SIESAL aparece para você. Suas escolhas ficam salvas na sua conta."
      />
      {msg ? <Aviso tipo="info">{msg}</Aviso> : null}
      <div className="settings-grid">
        <div className="setting">
          <label htmlFor="pz-apelido">
            <b>Como quer ser chamado</b>
          </label>
          <input
            id="pz-apelido"
            value={valor.apelido ?? ''}
            maxLength={40}
            onChange={(e) => {
              const v = e.target.value;
              // Link e e-mail não entram no apelido: a tecla é ignorada
              if (/(https?:|www\.|:\/\/|@)/i.test(v)) return;
              mudar({ apelido: v.trim() ? v : null });
            }}
          />
          <p>Um apelido que aparece nas suas telas. Vazio: usamos seu primeiro nome.</p>
        </div>

        <fieldset className="setting">
          <legend>
            <b>Tema</b>
          </legend>
          {TEMAS.map((t) => (
            <label key={t.id} className="opcao">
              <input
                type="radio"
                name="pz-tema"
                checked={tema === t.id}
                onChange={() => escolherTema(t.id)}
              />{' '}
              {t.nome} <small className="muted">{t.texto}</small>
            </label>
          ))}
        </fieldset>

        <fieldset className="setting">
          <legend>
            <b>Cor de destaque</b>
          </legend>
          <label className="opcao">
            <input
              type="radio"
              name="pz-cor"
              checked={valor.cor === null}
              onChange={() => mudar({ cor: null })}
            />{' '}
            Cor do tema
          </label>
          {CORES.map((c) => {
            const legivel = combinacaoLegivel(c.id, tema);
            return (
              <label key={c.id} className="opcao">
                <input
                  type="radio"
                  name="pz-cor"
                  disabled={!legivel}
                  checked={valor.cor === c.id}
                  onChange={() => mudar({ cor: c.id })}
                />{' '}
                <span className="amostra" style={{ background: c[tema] }} aria-hidden="true" />{' '}
                {c.nome}
                {legivel ? null : <small className="muted"> difícil de ler neste tema</small>}
              </label>
            );
          })}
          <p>Só aparecem como escolha as cores que ficam legíveis no tema.</p>
        </fieldset>

        <div className="setting">
          <label htmlFor="pz-fonte">
            <b>Tamanho da letra: {valor.fonte}%</b>
          </label>
          <input
            id="pz-fonte"
            className="slider"
            type="range"
            min={90}
            max={150}
            step={10}
            value={valor.fonte}
            onChange={(e) => mudar({ fonte: Number(e.target.value) })}
          />
          <p>De 90% a 150%.</p>
        </div>

        <AjustesInterface valor={interfaceAtual} aoMudar={aoMudarInterface} />

        <Chave
          titulo="Reduzir movimento"
          texto="Sem animações e transições."
          ligado={valor.movimento}
          aoMudar={(v) => mudar({ movimento: v })}
        />
        <Chave
          titulo="Mostrar o tempo de forma visual"
          texto="Palavras, datas e formas no lugar de só números."
          ligado={valor.tempoVisual}
          aoMudar={(v) => mudar({ tempoVisual: v })}
        />

        <div className="setting">
          <label htmlFor="pz-tela">
            <b>Tela que abre primeiro</b>
          </label>
          <select
            id="pz-tela"
            value={valor.telaInicial}
            onChange={(e) => mudar({ telaInicial: e.target.value as Preferencias['telaInicial'] })}
          >
            {TELAS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <p>A tela que você vê logo depois de entrar.</p>
        </div>

        <div className="setting">
          <b>Voltar ao padrão</b>
          <p>Desfaz tudo o que você personalizou. Seus tipos de atividade continuam.</p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              aoPadrao();
              setMsg('Pronto. As preferências voltaram ao padrão.');
            }}
          >
            Voltar ao padrão
          </button>
        </div>
      </div>
      <TiposDeAtividade />
    </>
  );
}
