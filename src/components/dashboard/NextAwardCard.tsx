import { ArrowRight,Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { money } from '../../lib/utils'
import { useAwardProgress } from '../../hooks/useAwardProgress'
import { useDemoStore } from '../../store/useDemoStore'

export function NextAwardCard(){const revenue=useDemoStore(s=>s.revenue),achievements=useDemoStore(s=>s.achievements),award=useAwardProgress(revenue,achievements);if(!award.next)return null;return <section className="next-award-card"><div className="next-award-icon"><Trophy/></div><div className="next-award-copy"><span>SUA PRÓXIMA PREMIAÇÃO</span><h2>{award.complete?'Coleção completa':award.next.title}</h2><p>{award.complete?'Você alcançou o maior nível disponível.':`${money(award.remaining)} para alcançar ${money(award.next.target)}`}</p><div className="next-award-progress"><i style={{width:`${award.progress}%`}}/></div><div className="next-award-values"><span>{money(award.current)} atuais</span><strong>{award.progress.toFixed(1)}%</strong><span>Meta {money(award.next.target)}</span></div></div><Link to="/premiacoes" aria-label="Ver premiações"><ArrowRight/></Link></section>}
