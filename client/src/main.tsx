// main.tsx — the browser entry point. Vite loads this from index.html.
// It mounts <App /> into <div id="root"> and pulls in the global CSS.
// StrictMode runs effects twice in development to surface bugs; it does nothing in production.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
