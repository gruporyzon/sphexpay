import { Banknote,Medal } from 'lucide-react'
import { competitionConfig,formatCompetitionMoney } from '../../config/competition'

export function CompetitionPrizeCards(){
 return <section className="competition-section"><header><span>PREMIAÇÃO</span><h2>Três posições. Uma campanha de alta performance.</h2></header><div className="competition-prizes">{competitionConfig.prizes.map(prize=><article className={`competition-prize place-${prize.position}`} key={prize.position}><div className="competition-prize-rank">{prize.position===1?<Medal/>:<Banknote/>}<span>{prize.position}º</span></div><small>{prize.label}</small><h3>{prize.position===1?prize.name:formatCompetitionMoney(prize.cashCents||0)}</h3>{prize.position===1?<><img src={competitionConfig.image} alt="iPhone 17 Pro Max"/><p>Primeiro participante elegível a alcançar R$ 30 mil.</p></>:<p>Premiação em dinheiro, sujeita à validação administrativa.</p>}</article>)}</div></section>
}
