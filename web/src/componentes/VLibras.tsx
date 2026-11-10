import { useEffect, useId, useRef, useState } from 'react';
import { Icone } from '../icones';
import { abrirVLibras, carregarVLibras, mostrarVLibras } from '../vlibras';

// Ícone flutuante "Libras" (A-037). Aparece por padrão. No primeiro clique mostra o aviso;
// o script do governo só é carregado depois de "Ativar VLibras". Depois, o botão oficial assume o lugar.
type Props = {
  ligado: boolean; // false = a pessoa desligou em Acessibilidade ou Personalizar
  avisoAceito: boolean;
  aoAceitar: () => void;
};

export function BotaoVLibras({ ligado, avisoAceito, aoAceitar }: Props) {
  const [avisoAberto, setAvisoAberto] = useState(false);
  const [erro, setErro] = useState('');
  const idTitulo = useId();
  const idTexto = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const primeiro = useRef<HTMLButtonElement>(null);

  // Já aceito e ligado: carrega o widget oficial. Desligado: esconde o widget, se já tinha carregado.
  useEffect(() => {
    if (ligado && avisoAceito)
      carregarVLibras().catch(() =>
        setErro('O VLibras não abriu agora. Confira a internet e tente de novo mais tarde.'),
      );
    else mostrarVLibras(false);
  }, [ligado, avisoAceito]);

  useEffect(() => {
    if (avisoAberto) primeiro.current?.focus();
  }, [avisoAberto]);

  if (!ligado) return null;

  const fechar = () => {
    setAvisoAberto(false);
    botao.current?.focus();
  };
  const ativar = () => {
    setAvisoAberto(false);
    aoAceitar();
    // Abre o painel assim que o widget carregar, para a pessoa não precisar clicar de novo
    carregarVLibras()
      .then(() => abrirVLibras())
      .catch(() =>
        setErro('O VLibras não abriu agora. Confira a internet e tente de novo mais tarde.'),
      );
  };

  return (
    <div className="vlibras-siesal">
      {erro ? (
        <p className="vlibras-erro" role="status">
          {erro}
        </p>
      ) : null}
      {avisoAberto ? (
        <div
          className="vlibras-aviso"
          role="dialog"
          aria-modal="false"
          aria-labelledby={idTitulo}
          aria-describedby={idTexto}
          onKeyDown={(e) => {
            if (e.key === 'Escape') fechar();
          }}
        >
          <h2 id={idTitulo}>Tradução para Libras (VLibras)</h2>
          <div id={idTexto}>
            <p>O VLibras é do governo federal.</p>
            <p>
              Ao ativar, o texto que você clicar na tela vai para o servidor do governo federal
              (vlibras.gov.br) para ser traduzido. O endereço de internet do seu aparelho também
              vai.
            </p>
            <p>O VLibras não traduz o que você digita nos campos, como usuário e senha.</p>
            <p>Você pode desligar quando quiser, em Acessibilidade.</p>
          </div>
          <div className="vlibras-acoes">
            <button ref={primeiro} type="button" className="btn btn-primary" onClick={ativar}>
              Ativar VLibras
            </button>
            <button type="button" className="btn btn-outline" onClick={fechar}>
              Agora não
            </button>
          </div>
        </div>
      ) : null}
      {avisoAceito ? null : (
        <button
          ref={botao}
          type="button"
          className="vlibras-botao"
          aria-label="Libras: tradução com o VLibras"
          aria-expanded={avisoAberto}
          title="Libras"
          onClick={() => setAvisoAberto(!avisoAberto)}
        >
          <Icone nome="maos" />
          <span>Libras</span>
        </button>
      )}
    </div>
  );
}
