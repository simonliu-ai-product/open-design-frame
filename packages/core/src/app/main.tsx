import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import './styles.css';

const host = document.getElementById('root');
if (!host) throw new Error('open-frame: #root is missing from index.html');
createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
