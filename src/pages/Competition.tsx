import { Download,LockKeyhole,ShieldCheck } from 'lucide-react'
import { CompetitionHero } from '../components/competition/CompetitionHero'
import { CompetitionLeaderboard,CompetitionPodium } from '../components/competition/CompetitionLeaderboard'
import { CompetitionPrizeCards } from '../components/competition/CompetitionPrizeCards'
import { CompetitionRules } from '../components/competition/CompetitionRules'
import { CompetitionUserProgress } from '../components/competition/CompetitionUserProgress'
import { useCompetition } from '../hooks/useCompetition'
import { useAuth } from '../hooks/useAuth'

export default function CompetitionPage(){
 const {user}=useAuth(),competition=useCompetition(user?.id),admin=user?.app_metadata?.role==='admin'
 return <div className="page-enter competition-page"><CompetitionHero status={competition.status}/><CompetitionPrizeCards/><CompetitionPodium standings={competition.standings}/><CompetitionLeaderboard standings={competition.standings} loading={competition.loading} error={competition.error} realtime={competition.realtime} updatedAt={competition.updatedAt} onRefresh={()=>void competition.refresh()}/><CompetitionUserProgress row={competition.me} position={competition.position} status={competition.status}/><CompetitionRules/>{admin&&<section className="competition-section competition-admin"><header><span>ADMINISTRAÇÃO</span><h2>Auditoria da competição</h2><p>Controles protegidos por papel administrativo server-side.</p></header><div><ShieldCheck/><p>Revisão de participantes, elegibilidade, fraude, regulamento e publicação de resultados.</p><button className="btn" disabled><Download/> Exportar relatório</button></div></section>} {!admin&&<p className="competition-audit-note"><LockKeyhole/> Controles de auditoria são restritos à equipe autorizada.</p>}</div>
}
