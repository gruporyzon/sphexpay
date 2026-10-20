import {T} from '../../i18n'
import { ArrowDown,CalendarDays,Target } from 'lucide-react'
import { competitionConfig,formatCompetitionMoney,type CompetitionStatus } from '../../config/competition'
import { CompetitionCountdown } from './CompetitionCountdown'
import { CompetitionStatusBadge } from './CompetitionStatusBadge'

export function CompetitionHero({status}:{status:CompetitionStatus}){
 return <section className="competition-hero"><div className="competition-hero-grid"/><div className="competition-hero-copy"><div className="competition-kicker"><span><T>COMPETIÇÃO SPHEXPAY</T></span><CompetitionStatusBadge status={status}/></div><h1>{competitionConfig.heroTitle}</h1><p>{competitionConfig.subtitle}</p><div className="competition-hero-facts"><span><CalendarDays/><T>01/09/2026 a 01/10/2026</T></span><span><Target/><T>Meta </T>{formatCompetitionMoney(competitionConfig.targetCents)}</span></div><CompetitionCountdown/><div className="competition-hero-actions"><a className="btn btn-primary" href="#meu-desempenho"><T>Ver meu desempenho </T><ArrowDown/></a><a className="btn competition-secondary" href="#regulamento"><T>Ler regulamento</T></a></div></div><div className="competition-hero-product" aria-hidden="true"><i/><img src={competitionConfig.image} alt=""/></div></section>
}
