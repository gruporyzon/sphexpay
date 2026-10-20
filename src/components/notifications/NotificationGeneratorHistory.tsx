import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { Copy,RotateCcw,Search,Trash2 } from 'lucide-react'
import { useMemo,useState } from 'react'
import { formatGeneratorValue,type GeneratorConfig,type GeneratorHistory } from '../../lib/notificationGenerator'

const statusLabel={completed:'Concluída',running:'Em execução',paused:'Pausada',cancelled:'Cancelada',scheduled:'Agendada',failed:'Falhou'}
export function NotificationGeneratorHistory({history,onClear,onReuse}:{history:GeneratorHistory[];onClear:()=>void;onReuse:(config:GeneratorConfig)=>void}){useAppLocale(state=>state.locale);
 const [query,setQuery]=useState(''),filtered=useMemo(()=>history.filter(item=>`${item.title} ${item.currency} ${item.status}`.toLowerCase().includes(query.toLowerCase())),[history,query])
 return <section className="generator-history"><div className="generator-section-head"><div><span><T>ATIVIDADE</T></span><h3><T>Histórico de disparos</T></h3></div><button className="btn btn-ghost" onClick={onClear} disabled={!history.length}><Trash2/><T> Limpar</T></button></div><label className="generator-history-search"><Search/><input aria-label={uiText("Buscar no histórico do gerador")} placeholder={uiText("Buscar campanha, moeda ou status")} value={query} onChange={event=>setQuery(event.target.value)}/></label><div className="generator-history-list">{filtered.slice(0,20).map(item=><article key={item.id}><div><i className={item.status}/><span><b>{item.title}</b><small>{new Date(item.createdAt).toLocaleString('pt-BR')}<T> · Dispositivo</T></small></span></div><dl><div><dt><T>Valor</T></dt><dd>{formatGeneratorValue(item.value,item.currency)}</dd></div><div><dt><T>Progresso</T></dt><dd>{item.sent}/{item.requested||'∞'}</dd></div><div><dt><T>Status</T></dt><dd>{statusLabel[item.status]}</dd></div></dl><div><button aria-label={`Reenviar ${item.title}`} onClick={()=>onReuse({...item.config,mode:'single',quantity:1})}><RotateCcw/></button><button aria-label={`Duplicar configuração ${item.title}`} onClick={()=>onReuse({...item.config})}><Copy/></button></div></article>)}{!filtered.length&&<p><T>Nenhum disparo encontrado.</T></p>}</div></section>
}
