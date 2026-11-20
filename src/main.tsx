import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ui/Fallback'
import { useStore } from './store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary onHome={() => useStore.getState().goHome()}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
