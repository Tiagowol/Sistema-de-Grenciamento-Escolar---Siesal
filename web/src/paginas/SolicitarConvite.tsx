import { type FormEvent, useState } from 'react';
import { api, ErroApi } from '../api';
import { Aviso } from '../componentes/Aviso';
import { Campo } from '../componentes/Campo';

// L22i (item 2): quem não tem código pede um convite (nome, e-mail e motivo). Não cria conta; o pedido espera uma pessoa decidir.
export function SolicitarConvite({ aoVoltar }: { aoVoltar: () => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recebido, setRecebido] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!nome.trim() || !email.trim() || !motivo.trim())
      return setErro('Preencha o nome, o e-mail e o motivo.');
    if (motivo.trim().length < 5) return setErro('Escreva o motivo com pelo menos 5 letras.');
    if (/(https?:|www\.|:\/\/)/i.test(motivo)) return setErro('Não coloque links no motivo.');
    setEnviando(true);
    try {
      await api.solicitarConvite({ nome: nome.trim(), email: email.trim(), motivo: motivo.trim() });
      setRecebido(true);
    } catch (x) {
      setErro(
        x instanceof ErroApi ? x.message : 'Não foi possível enviar o pedido. Tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

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
      <form className="card" onSubmit={enviar} noValidate>
        <div className="card-head">
          <h1 className="page-title" style={{ fontSize: 24 }}>
            Solicitar convite
          </h1>
        </div>
        <div className="stack">
          {recebido ? (
            <>
              <div role="status">
                <Aviso>
                  Pedido recebido. Se for aprovado, o convite chega no e-mail informado. Isso pode
                  levar alguns dias. Nenhuma conta foi criada ainda.
                </Aviso>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: 44 }}
                onClick={aoVoltar}
              >
                Voltar para a entrada
              </button>
            </>
          ) : (
            <>
              <p className="muted small">
                Use este pedido se você não tem um código de convite. Uma pessoa da equipe do SIESAL
                vai ler o pedido. Os dados servem só para analisar o pedido.
              </p>
              {erro ? <Aviso tipo="warn">{erro}</Aviso> : null}
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
              <Campo rotulo="E-mail" dica="O convite será enviado para este e-mail.">
                {({ id, descricao }) => (
                  <input
                    id={id}
                    aria-describedby={descricao}
                    type="email"
                    value={email}
                    maxLength={254}
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
              </Campo>
              <Campo
                rotulo="Motivo"
                dica="Conte em poucas palavras por que você quer usar o SIESAL."
              >
                {({ id, descricao }) => (
                  <textarea
                    id={id}
                    aria-describedby={descricao}
                    value={motivo}
                    rows={4}
                    maxLength={300}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                )}
              </Campo>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ minHeight: 44 }}
                disabled={enviando}
              >
                {enviando ? 'Enviando…' : 'Enviar pedido'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ minHeight: 44 }}
                onClick={aoVoltar}
              >
                Voltar
              </button>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
