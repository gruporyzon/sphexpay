import { StrictMode } from 'react'; import { createRoot } from 'react-dom/client'; import './index.css'; import './public.css'; import App from './App'; import { useDemoStore } from './store/useDemoStore'
import { notificationService } from './services/notificationService'
import { pwaInstallService } from './services/pwaInstallService'
import { AuthProvider } from './providers/AuthProvider'
document.documentElement.dataset.theme=useDemoStore.getState().theme
pwaInstallService.initialize()
void notificationService.registerWorker()
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App/></AuthProvider></StrictMode>)
