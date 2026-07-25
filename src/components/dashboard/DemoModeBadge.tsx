import { FlaskConical,ShieldCheck } from 'lucide-react'
import type { DashboardDataMode } from '../../services/dashboardDataSource'

export function DemoModeBadge({mode}:{mode:DashboardDataMode}){
 return mode==='demo'?<span className="dashboard-mode-badge demo" title="Cenário local sem transações financeiras reais"><FlaskConical/> Dados de demonstração</span>:<span className="dashboard-mode-badge production" title="Somente dados persistidos do backend"><ShieldCheck/> Dados de produção</span>
}
