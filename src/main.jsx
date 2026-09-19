import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { verwerkResetParameter } from './lib/appVersion'

// Vóór het renderen: een deelbare ?reset=1-link wist de lokale opslag en
// herlaadt zonder die parameter. Rendert bewust niets meer in dat geval —
// anders flitst de oude state nog kort in beeld voordat de herlaadbeurt
// doorzet.
if (!verwerkResetParameter()) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
