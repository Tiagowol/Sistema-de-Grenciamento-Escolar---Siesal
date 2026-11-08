import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos/prototipo.css';
import './estilos/extra.css';
import { aplicarPreferencias, carregarPreferencias } from './preferencias';

// Aplica as preferências antes de desenhar, para não piscar o tema
aplicarPreferencias(carregarPreferencias());

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
