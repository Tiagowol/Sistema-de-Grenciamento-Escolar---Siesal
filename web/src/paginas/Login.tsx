import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, type CadastroAguardando, ErroApi, type Eu } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';
import { TempoVisual } from '../componentes/TempoVisual';
import { paraTexto } from '../datas';
import { lerCodigoDoLink } from '../linkCadastro';
import { AceitarAcompanhamento } from './AceitarAcompanhamento';
import { AcessoPessoa } from './AcessoPessoa';
import { CadastroInstituicao } from './CadastroInstituicao';
import { ConfirmarEmail } from './ConfirmarEmail';
import { ConfirmarResponsavel } from './ConfirmarResponsavel';

type Props = { instituicaoPadrao: string | null; aoEntrar: (eu: Eu) => void };

// Menor de 18 anos pela data de nascimento (AAAA-MM-DD). Data incompleta não conta como menor.
export function ehMenor(nascimento: string, hoje: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento);
  if (!m || Number(m[1]) < 1900) return false;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia))
    idade -= 1;
  return idade < 18;
}

export function Login({ instituicaoPadrao, aoEntrar }: Props) {
  // 20c-1: uma pergunta, duas opções. "Sem instituição" pede só e-mail e senha.
  // Link de cadastro do aluno (/cadastro/aluno#CODIGO) já abre "Sem instituição" > Criar conta com o código preenchido
  const [dosLink] = useState(() => lerCodigoDoLink('/cadastro/aluno'));
  // Link de cadastro de instituição (/cadastro/instituicao#CODIGO): outra tela, só para o Admin novo
  const [dosLinkInstituicao] = useState(() => lerCodigoDoLink('/cadastro/instituicao'));
  // Link do e-mail do responsável (/confirmar/responsavel#LINK): outra tela, sem login
  const [dosLinkResponsavel] = useState(() => lerCodigoDoLink('/confirmar/responsavel'));
  // L22a-1b: link do e-mail do cadastro próprio (/confirmar/email#LINK) e a página /pessoa
  const [dosLinkEmail] = useState(() => lerCodigoDoLink('/confirmar/email'));
  // L22a-2: link do convite de acompanhamento (/acompanhar#LINK)
  const [dosLinkAcompanhar] = useState(() => lerCodigoDoLink('/acompanhar'));
  const [paginaPessoa] = useState(() => window.location.pathname.replace(/\/+$/, '') === '/pessoa');
  const [modo, setModo] = useState<'instituicao' | 'individual'>(
    dosLink ? 'individual' : 'instituicao',
  );
  const [instituicao, setInstituicao] = useState(instituicaoPadrao ?? '');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pedirCodigo, setPedirCodigo] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Criar conta com o convite do Master (só no modo "Sem instituição")
  const [criando, setCriando] = useState(dosLink !== null);
  const [convite, setConvite] = useState(dosLink ?? '');
  const [nome, setNome] = useState('');
  // 20c-2: data de nascimento, CPF (opcional) e, para menor de 18 anos, o responsável
  const [nascimento, setNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [escolas, setEscolas] = useState('');
  const [respNome, setRespNome] = useState('');
  const [respCpf, setRespCpf] = useState('');
  const [respNascimento, setRespNascimento] = useState('');
  const [respEmail, setRespEmail] = useState('');
  const [aguardando, setAguardando] = useState<CadastroAguardando | null>(null);
  const menor = ehMenor(nascimento);

  async function criarConta(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!convite.trim() || !nome.trim() || !email.trim() || !senha || !nascimento)
      return setErro('Preencha o convite, o nome, a data de nascimento, o e-mail e a senha.');
    if (menor && (!respNome.trim() || !respCpf.trim() || !respNascimento || !respEmail.trim()))
      return setErro(
        'Quem tem menos de 18 anos precisa informar o nome, o CPF, a data de nascimento e o e-mail do responsável.',
      );
    setEnviando(true);
    try {
      const r = await api.criarContaIndividual({
        codigo: convite.trim(),
        nome: nome.trim(),
        email: email.trim(),
        senha,
        nascimento,
        ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
        ...(matricula.trim() ? { matricula: matricula.trim() } : {}),
        ...(escolas.trim() ? { escolas: escolas.trim() } : {}),
        ...(menor
          ? {
              responsavel: {
                nome: respNome.trim(),
                cpf: respCpf.trim(),
                nascimento: respNascimento,
                email: respEmail.trim(),
              },
            }
          : {}),
      });
      if ('aguardando_responsavel' in r) setAguardando(r);
      else if ('usuario' in r) aoEntrar(r);
      else setCriando(false);
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível criar a conta. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const comuns = {
        email: email.trim(),
        senha,
        ...(codigo ? { codigo: codigo.trim() } : {}),
      };
      const eu = await api.login(
        modo === 'individual'
          ? { sem_instituicao: true, ...comuns }
          : { instituicao_id: instituicao.trim(), ...comuns },
      );
      aoEntrar(eu);
    } catch (x) {
      if (x instanceof ErroApi && x.message === 'segundo_fator_necessario') {
        setPedirCodigo(true);
        setErro('Digite o código do aplicativo de autenticação para continuar.');
      } else {
        setErro(x instanceof ErroApi ? x.message : 'Não foi possível entrar. Tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (dosLinkInstituicao !== null)
    return <CadastroInstituicao codigoInicial={dosLinkInstituicao} aoEntrar={aoEntrar} />;
  if (dosLinkResponsavel !== null) return <ConfirmarResponsavel token={dosLinkResponsavel} />;
  if (dosLinkEmail !== null) return <ConfirmarEmail token={dosLinkEmail} />;
  if (dosLinkAcompanhar !== null) return <AceitarAcompanhamento token={dosLinkAcompanhar} />;
  if (paginaPessoa) return <AcessoPessoa aoEntrar={aoEntrar} />;
  if (aguardando)
    return (
      <main
        className="content"
        style={{ maxWidth: 480, margin: '0 auto', paddingTop: 48 }}
        id="conteudo"
      >
        <div className="card">
          <div className="card-head">
            <h1 className="page-title" style={{ fontSize: 24 }}>
              Falta a autorização do responsável
            </h1>
          </div>
          <div className="stack" aria-live="polite">
            <p>
              Como você tem menos de 18 anos, o responsável precisa autorizar. Você ainda não pode
              entrar.
            </p>
            {aguardando.email_enviado ? (
              <p>O link foi enviado para o e-mail do responsável.</p>
            ) : (
              <Aviso tipo="warn">
                Não foi possível enviar o e-mail agora. Peça outro convite e tente de novo.
              </Aviso>
            )}
            <p className="muted small">
              O link vale uma vez, até{' '}
              <TempoVisual
                prazo={paraTexto(new Date(aguardando.expira_em))}
                hoje={paraTexto(new Date())}
              />
              .
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setAguardando(null);
                setCriando(false);
              }}
            >
              Voltar para entrar
            </button>
          </div>
        </div>
      </main>
    );

  return (
    <main
      className="content"
      style={{ maxWidth: 480, margin: '0 auto', paddingTop: 48 }}
      id="conteudo"
    >
      <div className="brand brand-login" style={{ marginBottom: 24 }}>
        <div className="brandmark" aria-hidden="true">
          S
        </div>
        <div>
          <strong>SIESAL</strong>
          <small>Educação e inclusão</small>
        </div>
      </div>
      <form className="card" onSubmit={criando ? criarConta : enviar} noValidate>
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            {criando ? 'Criar conta' : 'Entrar'}
          </h1>
        </div>
        <div className="stack">
          {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
          <fieldset className="login-modo">
            <legend>Como você usa o SIESAL?</legend>
            <label className="opcao">
              <input
                type="radio"
                name="login-modo"
                checked={modo === 'instituicao'}
                onChange={() => {
                  setModo('instituicao');
                  setCriando(false);
                }}
              />{' '}
              Vinculado a uma instituição
            </label>
            <label className="opcao">
              <input
                type="radio"
                name="login-modo"
                checked={modo === 'individual'}
                onChange={() => setModo('individual')}
              />{' '}
              Sem instituição
            </label>
          </fieldset>
          {/* L15, item extra: o campo aparece sempre; com instituição padrão ele já vem preenchido */}
          {criando && modo === 'individual' ? (
            <>
              <p className="muted small">
                Use o convite que o Master do SIESAL deu a você. Cada convite vale para uma conta e
                por 7 dias.
              </p>
              <Campo rotulo="Código do convite" dica="Exemplo: ABCD-EFGH-JKLM-NPQR">
                {({ id, descricao }) => (
                  <input
                    id={id}
                    aria-describedby={descricao}
                    value={convite}
                    autoComplete="off"
                    onChange={(e) => setConvite(e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="Seu nome">
                {({ id }) => (
                  <input
                    id={id}
                    value={nome}
                    maxLength={80}
                    autoComplete="name"
                    onChange={(e) => setNome(e.target.value)}
                  />
                )}
              </Campo>
              <Campo
                rotulo="Data de nascimento"
                dica="Quem tem menos de 18 anos precisa da autorização do responsável."
              >
                {({ id, descricao }) => (
                  <input
                    id={id}
                    aria-describedby={descricao}
                    type="date"
                    value={nascimento}
                    min="1900-01-01"
                    max={paraTexto(new Date())}
                    autoComplete="bday"
                    onChange={(e) => setNascimento(e.target.value)}
                  />
                )}
              </Campo>
              <Campo
                rotulo="CPF (opcional)"
                dica="Pode deixar em branco. Se informar, só os 2 últimos números aparecem depois."
              >
                {({ id, descricao }) => (
                  <input
                    id={id}
                    aria-describedby={descricao}
                    value={cpf}
                    inputMode="numeric"
                    maxLength={14}
                    autoComplete="off"
                    onChange={(e) => setCpf(e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="Matrícula (opcional)">
                {({ id }) => (
                  <input
                    id={id}
                    value={matricula}
                    maxLength={40}
                    autoComplete="off"
                    onChange={(e) => setMatricula(e.target.value)}
                  />
                )}
              </Campo>
              <Campo rotulo="Escola ou escolas (opcional)">
                {({ id }) => (
                  <input
                    id={id}
                    value={escolas}
                    maxLength={200}
                    autoComplete="off"
                    onChange={(e) => setEscolas(e.target.value)}
                  />
                )}
              </Campo>
              {menor ? (
                <fieldset className="login-modo">
                  <legend>Dados do responsável</legend>
                  <p className="muted small">
                    O SIESAL envia um link para o e-mail do responsável. Você só entra depois que
                    ele confirmar.
                  </p>
                  <Campo rotulo="Nome do responsável">
                    {({ id }) => (
                      <input
                        id={id}
                        value={respNome}
                        maxLength={80}
                        autoComplete="off"
                        onChange={(e) => setRespNome(e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="CPF do responsável">
                    {({ id }) => (
                      <input
                        id={id}
                        value={respCpf}
                        inputMode="numeric"
                        maxLength={14}
                        autoComplete="off"
                        onChange={(e) => setRespCpf(e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="Data de nascimento do responsável">
                    {({ id }) => (
                      <input
                        id={id}
                        type="date"
                        value={respNascimento}
                        min="1900-01-01"
                        max={paraTexto(new Date())}
                        autoComplete="off"
                        onChange={(e) => setRespNascimento(e.target.value)}
                      />
                    )}
                  </Campo>
                  <Campo rotulo="E-mail do responsável">
                    {({ id }) => (
                      <input
                        id={id}
                        type="email"
                        value={respEmail}
                        autoComplete="off"
                        onChange={(e) => setRespEmail(e.target.value)}
                      />
                    )}
                  </Campo>
                </fieldset>
              ) : null}
            </>
          ) : null}
          {modo === 'instituicao' ? (
            <Campo
              rotulo="Código da instituição"
              dica={
                instituicaoPadrao
                  ? 'Já preenchido com a instituição padrão. Troque se você é de outra escola.'
                  : 'Quem cadastrou você informa este código.'
              }
            >
              {({ id, descricao }) => (
                <input
                  id={id}
                  aria-describedby={descricao}
                  value={instituicao}
                  required
                  autoComplete="off"
                  onChange={(e) => setInstituicao(e.target.value)}
                />
              )}
            </Campo>
          ) : null}
          <Campo rotulo="E-mail">
            {({ id }) => (
              <input
                id={id}
                type="email"
                value={email}
                required
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Senha">
            {({ id }) => (
              <input
                id={id}
                type="password"
                value={senha}
                required
                autoComplete={criando ? 'new-password' : 'current-password'}
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>
          {pedirCodigo && !criando ? (
            <Campo
              rotulo="Código do aplicativo de autenticação"
              dica="6 números. Ou use um código de recuperação."
            >
              {({ id, descricao }) => (
                <input
                  id={id}
                  aria-describedby={descricao}
                  value={codigo}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onChange={(e) => setCodigo(e.target.value)}
                />
              )}
            </Campo>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {criando ? (enviando ? 'Criando…' : 'Criar conta') : enviando ? 'Entrando…' : 'Entrar'}
          </button>
          <a href="/pessoa" className="small">
            Professor ou pedagogo sem instituição? Entre ou cadastre-se aqui
          </a>
          {modo === 'individual' ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setCriando(!criando);
                setErro('');
              }}
            >
              {criando ? 'Já tenho conta' : 'Criar conta'}
            </button>
          ) : null}
        </div>
      </form>
    </main>
  );
}
