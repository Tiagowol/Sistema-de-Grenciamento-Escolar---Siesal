import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ErroApi } from '../api';
import {
  BLOCOS,
  MINUTOS_MAXIMO,
  MINUTOS_MINIMO,
  MINUTOS_PADRAO_DOS_BLOCOS,
  type MinutosDosBlocos,
  PASSO_DOS_MINUTOS,
} from '../blocos';
import { Aviso } from '../componentes/Aviso';
import { Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { Icone, type NomeIcone } from '../icones';
import { CORES, combinacaoLegivel, ICONES_DE_TIPO } from '../paleta';
import { type Preferencias, temaDe } from '../preferencias';

// Personalizar (L17b, L20a): apelido, cor de destaque, tela inicial, tempo das atividades e tipos próprios.
// Tema, alto contraste, tamanho da letra e os ajustes de leitura ficam só em Acessibilidade (um controle, um lugar).
// Toda cor passa pelo contraste mínimo: cor que fica difícil de ler no tema escolhido não pode ser marcada.
type Props = {
  valor: Preferencias;
  aoMudar: (p: Preferencias) => void;
  aoPadrao: () => void;
};

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

export function Personalizar({ valor, aoMudar, aoPadrao }: Props) {
  const tema = temaDe(valor);
  const [msg, setMsg] = useState('');
  const mudar = (p: Partial<Preferencias>) => {
    setMsg('');
    const novo = { ...valor, ...p };
    // Trocar o tema nunca deixa uma cor difícil de ler: se a cor não serve no tema novo, volta à do tema
    if (novo.cor && !combinacaoLegivel(novo.cor, temaDe(novo))) novo.cor = null;
    aoMudar(novo);
  };

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
          <p>
            A cor muda o menu, os botões, os fundos suaves e o painel de boas-vindas. Só aparecem
            como escolha as cores que ficam legíveis no tema atual. Tema claro ou escuro, alto
            contraste e tamanho da letra ficam em Acessibilidade, no menu.
          </p>
        </fieldset>

        <TempoDasAtividades blocos={valor.blocos} aoMudar={(blocos) => mudar({ blocos })} />

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

// Tempo das atividades (L20a): os minutos dos 3 blocos. O aluno usa botões de mais e menos de 5 em 5;
// não digita minutos. Cada bloco aparece com nome, forma (barra) e os minutos pequenos ao lado.
function TempoDasAtividades({
  blocos,
  aoMudar,
}: {
  blocos: MinutosDosBlocos;
  aoMudar: (m: MinutosDosBlocos) => void;
}) {
  const ordem = ['curto', 'medio', 'longo'] as const;
  const nome = (id: (typeof ordem)[number]) => BLOCOS.find((b) => b.id === id)?.nome ?? id;
  // Limite de cada botão: dentro de 5 a 120 e sempre curto < médio < longo
  const piso = (id: (typeof ordem)[number]) =>
    id === 'curto'
      ? MINUTOS_MINIMO
      : blocos[id === 'medio' ? 'curto' : 'medio'] + PASSO_DOS_MINUTOS;
  const teto = (id: (typeof ordem)[number]) =>
    id === 'longo'
      ? MINUTOS_MAXIMO
      : blocos[id === 'curto' ? 'medio' : 'longo'] - PASSO_DOS_MINUTOS;
  const padrao = ordem.every((id) => blocos[id] === MINUTOS_PADRAO_DOS_BLOCOS[id]);
  return (
    <fieldset className="setting tempo-ajuste">
      <legend>
        <b>Tempo das atividades</b>
      </legend>
      <p>
        Escolha quanto tempo vale cada bloco. Use os botões de menos e de mais. Os blocos valem em
        Atividades, Agenda, Calendário e Foco.
      </p>
      {ordem.map((id) => {
        const v = blocos[id];
        const menos = v - PASSO_DOS_MINUTOS < piso(id);
        const mais = v + PASSO_DOS_MINUTOS > teto(id);
        return (
          <div className="tempo-bloco" key={id}>
            <span className="tempo-bloco-nome" id={`tb-${id}`}>
              {nome(id)}
            </span>
            <button
              type="button"
              className="btn btn-outline tempo-botao"
              aria-label={`Diminuir o bloco ${nome(id).toLowerCase()} em 5 minutos`}
              disabled={menos}
              onClick={() => aoMudar({ ...blocos, [id]: v - PASSO_DOS_MINUTOS })}
            >
              −
            </button>
            <span
              className="tempo-barra"
              role="img"
              aria-label={`Bloco ${nome(id).toLowerCase()}: ${v} minutos`}
            >
              <span
                className="tempo-barra-cheia"
                style={{ width: `${Math.round((v / MINUTOS_MAXIMO) * 100)}%` }}
              />
            </span>
            <button
              type="button"
              className="btn btn-outline tempo-botao"
              aria-label={`Aumentar o bloco ${nome(id).toLowerCase()} em 5 minutos`}
              disabled={mais}
              onClick={() => aoMudar({ ...blocos, [id]: v + PASSO_DOS_MINUTOS })}
            >
              +
            </button>
            <small className="muted tempo-minutos">{v} min</small>
          </div>
        );
      })}
      <p className="small muted">
        Curto fica sempre menor que Médio, e Médio menor que Longo. Cada bloco vai de{' '}
        {MINUTOS_MINIMO} a {MINUTOS_MAXIMO} minutos.
      </p>
      <button
        type="button"
        className="btn btn-outline"
        disabled={padrao}
        onClick={() => aoMudar({ ...MINUTOS_PADRAO_DOS_BLOCOS })}
      >
        Voltar ao padrão dos blocos
      </button>
    </fieldset>
  );
}
