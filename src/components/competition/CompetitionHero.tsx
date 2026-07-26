import { ArrowDown,CalendarDays,Target } from 'lucide-react'
import { competitionConfig,formatCompetitionMoney,type CompetitionStatus } from '../../config/competition'
import { CompetitionCountdown } from './CompetitionCountdown'
import { CompetitionStatusBadge } from './CompetitionStatusBadge'

export function CompetitionHero({status}:{status:CompetitionStatus}){
 return <section className="competition-hero"><div className="competition-hero-grid"/><div className="competition-hero-copy"><div className="competition-kicker"><span>COMPETIÇÃO SPHEXPAY</span><CompetitionStatusBadge status={status}/></div><h1>{competitionConfig.heroTitle}</h1><p>{competitionConfig.subtitle}</p><div className="competition-hero-facts"><span><CalendarDays/>01/09/2026 a 01/10/2026</span><span><Target/>Meta {formatCompetitionMoney(competitionConfig.targetCents)}</span></div><CompetitionCountdown/><div className="competition-hero-actions"><a className="btn btn-primary" href="#meu-desempenho">Ver meu desempenho <ArrowDown/></a><a className="btn competition-secondary" href="#regulamento">Ler regulamento</a></div></div><div className="competition-hero-product" aria-hidden="true"><i/><img src={competitionConfig.image} alt=""/></div></section>
}
