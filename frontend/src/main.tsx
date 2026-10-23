import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './components/UI/SiesalDialog';
import { loadAppearance, warmUpNotificationSound } from './utils/appearance';
import './index.css';

// Aplica o tema de cor e as preferências salvas ANTES do primeiro paint
// (evita "flash" da cor padrão antes do tema escolhido pelo usuário)
loadAppearance();

// Desbloqueia o áudio do navegador no primeiro clique/tecla (política de
// autoplay) — garante que o bipe de notificações toque mesmo quando
// disparado pelo polling em segundo plano
const warmUpAudio = () => warmUpNotificationSound();
window.addEventListener('pointerdown', warmUpAudio, { once: true });
window.addEventListener('keydown', warmUpAudio, { once: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DialogProvider>
  </React.StrictMode>
);
