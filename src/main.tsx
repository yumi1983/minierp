import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './app/providers'
import './styles/globals.css'

// Aplicar tema guardado antes del primer render para evitar flash
;(function applyInitialTheme() {
  const theme = localStorage.getItem('theme') ?? 'system'
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    }
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>
)
