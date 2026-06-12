import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ChildProvider } from './context/ChildContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChildProvider>
          <App />
        </ChildProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
