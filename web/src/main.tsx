import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Operacao } from './paginas/Operacao';
import './estilos/prototipo.css';
import './estilos/extra.css';
import { aplicarPreferencias, carregarPreferencias } from './preferencias';

// Aplica as preferências antes de desenhar, para não piscar o tema
aplicarPreferencias(carregarPreferencias());

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      {/* L18: /operacao é a entrada separada dos Masters; o resto é o aplicativo da escola */}
      {window.location.pathname.startsWith('/operacao') ? <Operacao /> : <App />}
    </StrictMode>,
  );
}
