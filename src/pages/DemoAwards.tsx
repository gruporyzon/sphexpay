import { Card,PageTitle } from '../components/ui'
import AwardsPage from './Awards'
import { useDashboardData } from '../providers/DashboardDataProvider'
import { useDemoStore } from '../store/useDemoStore'
import { convertDemoCents } from '../demo/demoSimulationEngine'
import { money } from '../lib/utils'
import { AwardDisplay } from '../components/awards/AwardDisplay'
import { awardState } from '../config/revenueAwards'

export default function DemoAwareAwards(){
 const demo=useDashboardData(),achievements=useDemoStore(state=>state.achievements)
 if(!demo.active)return <AwardsPage/>
 const revenue=demo.ledger.filter(item=>item.status==='approved').reduce((sum,item)=>sum+convertDemoCents(item.amountCents,item.currency,'BRL')/100,0),next=achievements.find(item=>revenue<item.target),journey=Math.min(100,revenue/(achievements.at(-1)?.target||1)*100)
 return <div className="page-enter awards-page"><PageTitle title="Premiações" subtitle="Progresso exclusivamente demonstrativo. Nenhuma conquista é gravada no banco."/><Card className="journey-overview"><div><span>JORNADA DEMONSTRATIVA SPHEXPAY</span><h2>{next?`${money(Math.max(0,next.target-revenue))} para ${next.title}`:'Todas as metas demonstrativas alcançadas'}</h2><p>{money(revenue)} em vendas demonstrativas elegíveis</p></div><div className="journey-score"><strong>{journey.toFixed(1)}%</strong><span>da jornada demonstrativa</span></div><div className="journey-overview-line"><i style={{width:`${journey}%`}}/><b style={{left:`${journey}%`}}/></div></Card><section className="award-timeline">{achievements.map((achievement,index)=>{const state=awardState(revenue,index),progress=Math.min(100,revenue/achievement.target*100);return <article className={`timeline-milestone ${index%2?'right':'left'} ${state}`} key={achievement.id}><Card className="journey-award-card"><div className="journey-level"><span>META DEMONSTRATIVA {String(index+1).padStart(2,'0')}</span><b>{state==='unlocked'?'ALCANÇADA':state==='next'?'PRÓXIMA META':'BLOQUEADA'}</b></div><AwardDisplay achievement={achievement} unlocked={state==='unlocked'} state={state}/><div className="journey-award-info"><div><h3>{achievement.title}</h3><p>{money(Math.max(0,achievement.target-revenue))} restantes em demonstração.</p></div><div className="award-state"><strong>{progress.toFixed(1)}%</strong><span>Sem registro real</span></div></div><div className="award-mini-progress"><i style={{width:`${progress}%`}}/></div></Card></article>})}</section></div>
}
