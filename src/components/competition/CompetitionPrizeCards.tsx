import {T} from '../../i18n'
import { Banknote,Medal } from 'lucide-react'
import { competitionConfig,formatCompetitionMoney } from '../../config/competition'

export function CompetitionPrizeCards(){
 return <section className="competition-section"><header><span><T>PREMIAÇÃO</T></span><h2><T>Três posições. Uma campanha de alta performance.</T></h2></header><div className="competition-prizes">{competitionConfig.prizes.map(prize=><article className={`competition-prize place-${prize.position}`} key={prize.position}><div className="competition-prize-rank">{prize.position===1?<Medal/>:<Banknote/>}<span>{prize.position}º</span></div><small><T>{prize.label}</T></small><h3>{prize.position===1?prize.name:formatCompetitionMoney(prize.cashCents||0)}</h3>{prize.position===1?<><img src={competitionConfig.image} alt="iPhone 17 Pro Max"/><p><T>Primeiro participante elegível a alcançar R$ 30 mil.</T></p></>:<p><T>Premiação em dinheiro, sujeita à validação administrativa.</T></p>}</article>)}</div></section>
}
