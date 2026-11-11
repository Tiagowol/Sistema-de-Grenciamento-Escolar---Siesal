import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Operacao } from './paginas/Operacao';
import './estilos/prototipo.css';
import './estilos/extra.css';
import { aplicarPreferencias, carregarPreferencias } from './preferencias';

// Aplica as preferências antes de desenhar, para não piscar o tema
aplicarPreferencias(carregarPreferencias());

// Endereços: /gestao (e o antigo /operacao) e /cadastro/master são da gestão da plataforma
const caminho = window.location.pathname.replace(/\/+$/, '');
if (caminho === '/operacao')
  window.history.replaceState(null, '', `/gestao${window.location.hash}`);
const ehGestao = caminho === '/gestao' || caminho === '/operacao' || caminho === '/cadastro/master';

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      {/* /gestao é a entrada separada dos Masters (/operacao continua e leva para /gestao); /cadastro/master leva
          ao primeiro acesso; o resto é o aplicativo da escola (/cadastro/aluno abre o cadastro por convite) */}
      {ehGestao ? <Operacao /> : <App />}
    </StrictMode>,
  );
}
