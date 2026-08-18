import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import './index.css'; import './public.css'; import './landing-cinematic.css'; import App from './App'; import { useDemoStore } from './store/useDemoStore'
import { notificationService } from './services/notificationService'
import { pwaInstallService } from './services/pwaInstallService'
import { AuthProvider } from './providers/AuthProvider'
import { syncSystemChrome } from './lib/systemChrome'
const initialTheme=useDemoStore.getState().theme
document.documentElement.dataset.theme=initialTheme
syncSystemChrome(window.location.pathname,initialTheme)
pwaInstallService.initialize()
void notificationService.registerWorker()
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App/></AuthProvider></StrictMode>)
