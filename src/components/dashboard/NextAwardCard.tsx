import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { money } from '../../lib/utils'
import { useAwardProgress } from '../../hooks/useAwardProgress'
import { useDemoStore } from '../../store/useDemoStore'
import { AwardDisplay } from '../awards/AwardDisplay'
import { highestRevenueAward } from '../../config/revenueAwards'

export function NextAwardCard({currentRevenue}:{currentRevenue?:number}){useAppLocale(state=>state.locale);const storedRevenue=useDemoStore(s=>s.revenue),achievements=useDemoStore(s=>s.achievements),revenue=currentRevenue??storedRevenue,award=useAwardProgress(revenue,achievements);if(!award.next){const highest=achievements.find(item=>item.id===highestRevenueAward().id)||achievements.at(-1)!;return <section className="next-award-card next-award-complete"><div className="next-award-plaque"><AwardDisplay achievement={highest} unlocked state="unlocked"/></div><div className="next-award-copy"><span><T>JORNADA DE PREMIAÇÕES</T></span><h2>{highest.title}<T> conquistada</T></h2><p>{money(revenue)}<T> em faturamento · todas as plaquinhas conquistadas.</T></p><div className="next-award-progress"><i style={{width:'100%'}}/></div><div className="next-award-values"><span>{money(revenue)}<T> atuais</T></span><strong>100%</strong><span><T>Meta </T>{money(highest.target)}</span></div></div><Link to="/app/premiacoes" aria-label={uiText("Ver premiações")}><ArrowRight/></Link></section>}return <section className="next-award-card"><div className="next-award-plaque"><AwardDisplay achievement={award.next} unlocked={false} state="next"/></div><div className="next-award-copy"><span><T>SUA PRÓXIMA PREMIAÇÃO</T></span><h2>{award.next.title}</h2><p>{money(award.remaining)}<T> restantes · meta de </T>{money(award.next.target)}</p><div className="next-award-progress"><i style={{width:`${award.progress}%`}}/></div><div className="next-award-values"><span>{money(award.current)}<T> atuais</T></span><strong>{award.progress.toFixed(1)}%</strong><span><T>Meta </T>{money(award.next.target)}</span></div></div><Link to="/app/premiacoes" aria-label={uiText("Ver premiações")}><ArrowRight/></Link></section>}
