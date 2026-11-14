import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { api, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Titulo } from '../componentes/Basicos';
import { Campo } from '../componentes/Campo';
import { TempoVisual } from '../componentes/TempoVisual';
import { useCarregar } from '../componentes/useCarregar';
import { formatar, paraTexto } from '../datas';

// Minha conta (L17c): trocar senha e e-mail, encerrar conta e pedir suporte.
// Texto literal, sem pressão. Aluno é menor de idade: e-mail e encerramento precisam do Responsável ou do Admin.
export const ASSUNTOS: { id: string; nome: string }[] = [
  { id: 'acesso', nome: 'Não consigo entrar' },
  { id: 'nao_consigo_usar', nome: 'Não consigo usar uma tela' },
  { id: 'duvida_nota', nome: 'Dúvida sobre uma nota' },
  { id: 'erro_na_tela', nome: 'Apareceu um erro' },
  { id: 'outro', nome: 'Outro assunto' },
];

function mensagem(x: unknown, padrao: string) {
  return x instanceof ErroApi ? x.message : padrao;
}

function Secao({ titulo, id, children }: { titulo: string; id: string; children: ReactNode }) {
  return (
    <section className="card mt" aria-labelledby={id}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </section>
  );
}

function TrocarSenhaForm() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'info' | 'warn'; texto: string } | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!atual || !nova) return setMsg({ tipo: 'warn', texto: 'Preencha as duas senhas.' });
    try {
      await api.trocarSenha({ senha_atual: atual, senha_nova: nova });
      setAtual('');
      setNova('');
      setMsg({ tipo: 'info', texto: 'Pronto. Sua senha foi trocada.' });
    } catch (x) {
      setMsg({ tipo: 'warn', texto: mensagem(x, 'Não foi possível trocar a senha.') });
    }
  }
  return (
    <Secao titulo="Trocar a senha" id="cc-senha">
      <form onSubmit={enviar} noValidate>
        {msg ? <Aviso tipo={msg.tipo}>{msg.texto}</Aviso> : null}
        <div className="stack">
          <Campo rotulo="Senha atual">
            {({ id }) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Senha nova" dica="Use uma senha longa que só você conhece.">
            {({ id, descricao }) => (
              <input
                id={id}
                aria-describedby={descricao}
                type="password"
                autoComplete="new-password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
              />
            )}
          </Campo>
          <button type="submit" className="btn btn-primary">
            Trocar senha
          </button>
        </div>
      </form>
    </Secao>
  );
}

type PedidoAberto = {
  id: string;
  tipo: 'email' | 'encerramento';
  email_novo: string | null;
  exige_aprovacao: boolean;
  dia: string;
};

function PedidoEmAndamento({
  p,
  aoMudar,
  aoEncerrar,
}: {
  p: PedidoAberto;
  aoMudar: () => void;
  aoEncerrar: () => void;
}) {
  const [msg, setMsg] = useState('');
  const hoje = paraTexto(new Date());
  return (
    <div className="notice info" role="status">
      <p>
        {p.tipo === 'email'
          ? `Pedido para trocar o e-mail para ${p.email_novo}.`
          : 'Pedido para encerrar a sua conta.'}
      </p>
      <p className="small">
        Feito <TempoVisual prazo={p.dia} hoje={hoje} passado />
      </p>
      {p.exige_aprovacao ? (
        <p>Esperando a aprovação do seu Responsável ou do Admin. Nada muda até lá.</p>
      ) : (
        <p>Falta confirmar. Enquanto você não confirmar, nada muda.</p>
      )}
      {msg ? <p role="alert">{msg}</p> : null}
      <div className="chip-row">
        {p.exige_aprovacao ? null : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              setMsg('');
              try {
                await api.confirmarPedidoConta(p.id);
                if (p.tipo === 'encerramento') aoEncerrar();
                else aoMudar();
              } catch (x) {
                setMsg(mensagem(x, 'Não foi possível confirmar.'));
              }
            }}
          >
            {p.tipo === 'email' ? 'Confirmar a troca de e-mail' : 'Confirmar: encerrar minha conta'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={async () => {
            await api.cancelarPedidoConta(p.id);
            aoMudar();
          }}
        >
          Cancelar o pedido
        </button>
      </div>
    </div>
  );
}

function PedirComSenha({
  titulo,
  id,
  menor,
  aviso,
  rotuloBotao,
  campoEmail,
  enviar,
}: {
  titulo: string;
  id: string;
  menor: boolean;
  aviso: string;
  rotuloBotao: string;
  campoEmail?: boolean;
  enviar: (d: { senha: string; email: string }) => Promise<void>;
}) {
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  async function submeter(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (campoEmail && !email.trim()) return setMsg('Escreva o e-mail novo.');
    if (!senha) return setMsg('Escreva a sua senha atual.');
    try {
      await enviar({ senha, email: email.trim() });
      setSenha('');
      setEmail('');
    } catch (x) {
      setMsg(mensagem(x, 'Não foi possível enviar o pedido.'));
    }
  }
  return (
    <Secao titulo={titulo} id={id}>
      <p className="muted small">{aviso}</p>
      {menor ? (
        <p className="small">
          Você é menor de idade. O seu Responsável ou o Admin precisa aprovar este pedido.
        </p>
      ) : null}
      <form onSubmit={submeter} noValidate>
        {msg ? <Aviso tipo="warn">{msg}</Aviso> : null}
        <div className="stack">
          {campoEmail ? (
            <Campo rotulo="E-mail novo">
              {({ id: i }) => (
                <input
                  id={i}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Campo>
          ) : null}
          <Campo rotulo="Sua senha atual">
            {({ id: i }) => (
              <input
                id={i}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            )}
          </Campo>
          <button type="submit" className="btn btn-outline">
            {rotuloBotao}
          </button>
        </div>
      </form>
    </Secao>
  );
}

export function Suporte() {
  const [assunto, setAssunto] = useState('acesso');
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'info' | 'warn'; texto: string } | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!texto.trim()) return setMsg({ tipo: 'warn', texto: 'Escreva o que aconteceu.' });
    try {
      await api.pedirSuporte({ assunto, texto: texto.trim() });
      setTexto('');
      setMsg({ tipo: 'info', texto: 'Pedido enviado. A equipe da escola vai ver.' });
    } catch (x) {
      setMsg({ tipo: 'warn', texto: mensagem(x, 'Não foi possível enviar.') });
    }
  }
  return (
    <Secao titulo="Pedir suporte" id="cc-suporte">
      <p className="muted small">
        Conte o que aconteceu. A mensagem vai para a equipe pedagógica e para o Admin da escola. Não
        escreva senhas nem links.
      </p>
      <form onSubmit={enviar} noValidate>
        {msg ? <Aviso tipo={msg.tipo}>{msg.texto}</Aviso> : null}
        <div className="stack">
          <Campo rotulo="Assunto">
            {({ id }) => (
              <select id={id} value={assunto} onChange={(e) => setAssunto(e.target.value)}>
                {ASSUNTOS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="O que aconteceu" dica="Até 500 letras.">
            {({ id, descricao }) => (
              <textarea
                id={id}
                aria-describedby={descricao}
                rows={4}
                maxLength={500}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            )}
          </Campo>
          <button type="submit" className="btn btn-primary">
            Enviar pedido
          </button>
        </div>
      </form>
    </Secao>
  );
}

// Dados do cadastro (20c-2). O CPF só aparece mascarado. Quem não tem esses dados (aluno de escola) não vê o bloco.
function DadosDoCadastro() {
  const { dados } = useCarregar(api.dadosCadastro);
  if (dados?.cadastrado !== true) return null;
  return (
    <section className="card mt" aria-labelledby="cc-cadastro">
      <h2 id="cc-cadastro">Dados do cadastro</h2>
      <p>
        <b>Data de nascimento:</b>{' '}
        {formatar(dados.nascimento, { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </p>
      <p>
        <b>CPF:</b> {dados.cpf ?? 'não informado'}
      </p>
      {dados.matricula ? (
        <p>
          <b>Matrícula:</b> {dados.matricula}
        </p>
      ) : null}
      {dados.escolas ? (
        <p>
          <b>Escola(s):</b> {dados.escolas}
        </p>
      ) : null}
    </section>
  );
}

export function Conta({ aoSair }: { aoSair: () => void }) {
  const { dados, erro, recarregar } = useCarregar(api.conta);
  const hoje = paraTexto(new Date());
  const menor = dados?.conta.menor ?? false;
  const pedidoEmail = dados?.pedidos.find((p) => p.tipo === 'email');
  const pedidoFim = dados?.pedidos.find((p) => p.tipo === 'encerramento');
  return (
    <>
      <Titulo
        olho="Preferências"
        titulo="Minha conta"
        sub="Troque a senha e o e-mail, peça suporte ou encerre a conta."
      />
      {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
      {dados ? (
        <section className="card" aria-labelledby="cc-dados">
          <h2 id="cc-dados">Seus dados</h2>
          <p>
            <b>Nome:</b> {dados.conta.nome}
          </p>
          <p>
            <b>E-mail:</b> {dados.conta.email}
          </p>
        </section>
      ) : null}
      <DadosDoCadastro />

      {dados && dados.decisoes.length > 0 ? (
        <Secao titulo="Pedidos para você decidir" id="cc-decisoes">
          <ul className="cal-lista">
            {dados.decisoes.map((d) => (
              <li key={d.id} className="cal-evento">
                <div>
                  <strong>{d.aluno_nome}</strong>
                  <p>
                    {d.tipo === 'email'
                      ? `Quer trocar o e-mail para ${d.email_novo}.`
                      : 'Quer encerrar a conta. Os dados pessoais serão apagados e não voltam.'}
                  </p>
                  <small>
                    <TempoVisual prazo={d.dia} hoje={hoje} passado />
                  </small>
                </div>
                <div className="cal-acoes">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      await api.decidirPedidoConta(d.id, true);
                      await recarregar();
                    }}
                  >
                    Aprovar<span className="sr-only"> o pedido de {d.aluno_nome}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={async () => {
                      await api.decidirPedidoConta(d.id, false);
                      await recarregar();
                    }}
                  >
                    Recusar<span className="sr-only"> o pedido de {d.aluno_nome}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <TrocarSenhaForm />

      {pedidoEmail ? (
        <Secao titulo="Trocar o e-mail" id="cc-email-andamento">
          <PedidoEmAndamento
            p={pedidoEmail}
            aoMudar={() => void recarregar()}
            aoEncerrar={aoSair}
          />
        </Secao>
      ) : (
        <PedirComSenha
          titulo="Trocar o e-mail"
          id="cc-email"
          menor={menor}
          campoEmail
          aviso="Você escolhe o e-mail novo e confirma com a senha. O e-mail só muda depois da confirmação."
          rotuloBotao="Pedir a troca de e-mail"
          enviar={async ({ senha, email }) => {
            await api.pedirTrocaEmail({ email_novo: email, senha_atual: senha });
            await recarregar();
          }}
        />
      )}

      <Suporte />

      {pedidoFim ? (
        <Secao titulo="Encerrar a conta" id="cc-fim-andamento">
          <PedidoEmAndamento p={pedidoFim} aoMudar={() => void recarregar()} aoEncerrar={aoSair} />
        </Secao>
      ) : (
        <PedirComSenha
          titulo="Encerrar a conta"
          id="cc-fim"
          menor={menor}
          aviso="Ao encerrar, você não entra mais. Seu nome, e-mail e textos pessoais são apagados e não voltam. O registro de ações da escola e as notas oficiais ficam, sem ligação com o seu nome. Você confirma em uma segunda etapa."
          rotuloBotao="Pedir para encerrar a conta"
          enviar={async ({ senha }) => {
            await api.pedirEncerramento({ senha_atual: senha });
            await recarregar();
          }}
        />
      )}
    </>
  );
}
