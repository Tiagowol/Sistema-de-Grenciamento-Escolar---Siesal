import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { api, ErroApi, type NovaIdentidade, URL_LOGOTIPO } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Carregando, Titulo, Vazio } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { useCarregar } from '../componentes/useCarregar';
import { formatar } from '../datas';
import { corDaEscolaLegivel } from '../identidade';

// Identidade visual da escola (L19): nome de exibição, cor (uma para o tema claro, outra para o escuro) e logotipo.
// A cor só é aceita com contraste de 4,5:1. A cor escolhida pelo aluno sempre vence a da escola.
const LOGOTIPO_MAXIMO = 200 * 1024;
const mensagem = (x: unknown, padrao: string) => (x instanceof ErroApi ? x.message : padrao);

type EscolhaLogo = 'manter' | 'novo' | 'sem';

// Lê o arquivo escolhido como base64 (sem o prefixo "data:")
const lerBase64 = (arquivo: File) =>
  new Promise<string>((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result).split(',')[1] ?? '');
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(arquivo);
  });

function CampoCor({
  rotulo,
  tema,
  valor,
  aoMudar,
}: {
  rotulo: string;
  tema: 'claro' | 'escuro';
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const valida = /^#[0-9a-fA-F]{6}$/.test(valor);
  const legivel = valida && corDaEscolaLegivel(valor.toLowerCase(), tema);
  return (
    <Campo
      rotulo={rotulo}
      dica={
        !valor
          ? 'Sem cor: vale a cor padrão do SIESAL.'
          : legivel
            ? 'Contraste bom: pode ser usada.'
            : tema === 'claro'
              ? 'Pouco contraste: escolha uma cor mais escura.'
              : 'Pouco contraste: escolha uma cor mais clara.'
      }
    >
      {({ id, descricao }) => (
        <div className="cor-escola">
          <input
            id={id}
            aria-describedby={descricao}
            value={valor}
            placeholder="#155bb4"
            maxLength={7}
            onChange={(e) => aoMudar(e.target.value.trim())}
          />
          <span
            className={`amostra-cor amostra-${tema}`}
            style={valida ? { background: valor } : undefined}
            aria-hidden="true"
          />
        </div>
      )}
    </Campo>
  );
}

export function IdentidadeEscola({ aoMudar }: { aoMudar?: () => void }) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.identidade());
  const [nome, setNome] = useState('');
  const [corClaro, setCorClaro] = useState('');
  const [corEscuro, setCorEscuro] = useState('');
  const [logo, setLogo] = useState<EscolhaLogo>('manter');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState('');

  // O formulário começa com a identidade atual
  useEffect(() => {
    const i = dados?.identidade;
    if (!i) return;
    setNome(i.nome_exibicao);
    setCorClaro(i.cor_claro ?? '');
    setCorEscuro(i.cor_escuro ?? '');
    setLogo(i.tem_logotipo ? 'manter' : 'sem');
  }, [dados]);

  function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    setMsg('');
    const f = e.target.files?.[0] ?? null;
    if (f && !['image/png', 'image/jpeg'].includes(f.type)) {
      setMsg('O logotipo precisa ser uma imagem PNG ou JPEG.');
      return setArquivo(null);
    }
    if (f && f.size > LOGOTIPO_MAXIMO) {
      setMsg('O logotipo precisa ter até 200 KB.');
      return setArquivo(null);
    }
    setArquivo(f);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk('');
    if (!nome.trim()) return setMsg('Escreva o nome da escola.');
    for (const [cor, tema] of [
      [corClaro, 'claro'],
      [corEscuro, 'escuro'],
    ] as const)
      if (cor && !(/^#[0-9a-fA-F]{6}$/.test(cor) && corDaEscolaLegivel(cor.toLowerCase(), tema)))
        return setMsg(`A cor do tema ${tema} precisa ser no formato #rrggbb e ter contraste bom.`);
    if (logo === 'novo' && !arquivo) return setMsg('Escolha o arquivo do logotipo.');
    try {
      const corpo: NovaIdentidade = {
        nome_exibicao: nome.trim(),
        cor_claro: corClaro || null,
        cor_escuro: corEscuro || null,
        logotipo:
          logo === 'manter'
            ? 'manter'
            : logo === 'sem' || !arquivo
              ? null
              : {
                  tipo: arquivo.type as 'image/png' | 'image/jpeg',
                  dados: await lerBase64(arquivo),
                },
      };
      await api.salvarIdentidade(corpo);
      setOk('Identidade gravada como versão nova. As anteriores continuam guardadas.');
      setArquivo(null);
      await recarregar();
      aoMudar?.();
    } catch (x) {
      setMsg(mensagem(x, 'Não foi possível gravar. Tente de novo.'));
    }
  }

  const atual = dados?.identidade;
  return (
    <div className="pag-identidade">
      <Titulo
        olho="Administração"
        titulo="Identidade da escola"
        sub="Nome, cor e logotipo que aparecem no menu. A cor escolhida pelo aluno sempre vale mais que a da escola."
      />
      {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
      {ok ? <Aviso>{ok}</Aviso> : null}
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}

      <div className="grid cols-2">
        <form className="card" onSubmit={salvar} noValidate aria-labelledby="ident-form">
          <div className="card-head">
            <h2 id="ident-form">Nova versão</h2>
          </div>
          <div className="form-grid">
            <Campo rotulo="Nome da escola" dica="Aparece no menu, no lugar de SIESAL" cheio>
              {({ id, descricao }) => (
                <input
                  id={id}
                  aria-describedby={descricao}
                  value={nome}
                  maxLength={80}
                  onChange={(e) => setNome(e.target.value)}
                />
              )}
            </Campo>
            <CampoCor
              rotulo="Cor para o tema claro"
              tema="claro"
              valor={corClaro}
              aoMudar={setCorClaro}
            />
            <CampoCor
              rotulo="Cor para o tema escuro"
              tema="escuro"
              valor={corEscuro}
              aoMudar={setCorEscuro}
            />
          </div>
          <fieldset className="mt-sm">
            <legend>Logotipo</legend>
            {(
              [
                ['manter', 'Manter o logotipo atual'],
                ['novo', 'Enviar um logotipo novo (PNG ou JPEG, até 200 KB)'],
                ['sem', 'Sem logotipo'],
              ] as const
            ).map(([v, r]) => (
              <label key={v} className="opcao-radio">
                <input
                  type="radio"
                  name="logotipo"
                  value={v}
                  checked={logo === v}
                  onChange={() => setLogo(v)}
                />
                <span>{r}</span>
              </label>
            ))}
            {logo === 'novo' ? (
              <Campo rotulo="Arquivo do logotipo">
                {({ id }) => (
                  <input
                    id={id}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={escolherArquivo}
                  />
                )}
              </Campo>
            ) : null}
          </fieldset>
          <div className="actions mt-sm">
            <button type="submit" className="btn btn-primary">
              Gravar nova versão
            </button>
          </div>
        </form>

        <section className="card" aria-labelledby="ident-atual">
          <div className="card-head">
            <h2 id="ident-atual">Identidade atual</h2>
          </div>
          {carregando ? (
            <Carregando />
          ) : atual ? (
            <div className="ident-atual">
              {atual.tem_logotipo ? (
                <img
                  className="logo-escola"
                  src={`${URL_LOGOTIPO}?v=${atual.numero}`}
                  alt={`Logotipo de ${atual.nome_exibicao}`}
                />
              ) : null}
              <p>
                <strong>{atual.nome_exibicao}</strong> (versão {atual.numero})
              </p>
              <p className="small">
                Tema claro: {atual.cor_claro ?? 'cor padrão'} · Tema escuro:{' '}
                {atual.cor_escuro ?? 'cor padrão'}
              </p>
            </div>
          ) : (
            <Vazio>A escola ainda usa a identidade padrão do SIESAL.</Vazio>
          )}
          <h3 className="mt-sm">Versões guardadas</h3>
          {dados?.versoes.length ? (
            <ol className="lista-versoes">
              {dados.versoes.map((v) => (
                <li key={v.numero}>
                  Versão {v.numero}: {v.nome_exibicao} · gravada em {formatar(v.criada_em)} por{' '}
                  {v.autor_nome}
                </li>
              ))}
            </ol>
          ) : (
            <Vazio>Nenhuma versão ainda.</Vazio>
          )}
        </section>
      </div>
    </div>
  );
}
