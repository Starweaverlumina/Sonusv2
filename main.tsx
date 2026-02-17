import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster 
      position="top-center"
      toastOptions={{
        style: {
          background: '#1c1c2e',
          border: '1px solid #24243a',
          color: '#eeeef5',
        },
      }}
    />
  </StrictMode>,
)
