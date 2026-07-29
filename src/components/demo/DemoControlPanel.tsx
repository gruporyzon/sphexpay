import {useEffect,useMemo,useRef,useState} from 'react'
import {Activity,ArrowRight,Gauge,Pause,Play,RotateCcw,Settings2,Square} from 'lucide-react'
import {useNavigate} from 'react-router-dom'
import {demoPresets,defaultDemoConfig,validateDemoConfig} from '../../demo/demoSimulationEngine'
import type {DemoConfig,DemoPreset} from '../../demo/types'
import {formatCents} from '../../lib/currencyFormat'
import {useDashboardData} from '../../providers/DashboardDataProvider'

const presetLabels:Record<DemoPreset,string>={light:'Movimento leve',normal:'Operação normal',high:'Alto volume',launch:'Lançamento',peak:'Pico de vendas',subscriptions:'Assinaturas',international:'Internacional',custom:'Personalizado'}
const number=(value:string)=>Number.isFinite(Number(value))?Number(value):0
const moneyInput=(cents:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)
const moneyCents=(value:string)=>Math.max(0,Math.round(Number(value.replace(/\./g,'').replace(',','.'))*100)||0)
const time=(value:string|number|null)=>value?new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:typeof value==='number'?'2-digit':undefined}):'—'

export function DemoControlPanel(){
 const demo=useDashboardData(),navigate=useNavigate(),configRef=useRef<HTMLDivElement>(null),noticeTimer=useRef<number|undefined>(undefined)
 const [draft,setDraft]=useState<DemoConfig>(()=>structuredClone(demo.config)),[errors,setErrors]=useState<string[]>([]),[notice,setNotice]=useState('')
 useEffect(()=>setDraft(structuredClone(demo.config)),[demo.config])
 useEffect(()=>()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current)},[])
 const announce=(message:string)=>{setNotice(message);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=window.setTimeout(()=>setNotice(''),2200)}
 const frequencyHour=useMemo(()=>{const multiplier=draft.frequencyUnit==='minutes'?60:1,min=Math.max(1,draft.minFrequency*multiplier),max=Math.max(min,draft.maxFrequency*multiplier);return{min:Math.round(3600/max),max:Math.round(3600/min)}},[draft])
 const set=<K extends keyof DemoConfig>(key:K,value:DemoConfig[K])=>setDraft(current=>({...current,[key]:value,preset:key==='preset'?value:'custom'} as DemoConfig))
 const choosePreset=(preset:DemoPreset)=>{if(preset==='custom'){set('preset','custom');return}setDraft(structuredClone(demoPresets[preset]));setErrors([])}
 const apply=()=>{const failures=validateDemoConfig(draft);setErrors(failures);if(failures.length)return;demo.applyConfig(draft);announce('Configurações aplicadas.')}
 const restore=()=>{setDraft(defaultDemoConfig());setErrors([])}
 const cancel=()=>{setDraft(structuredClone(demo.config));setErrors([])}
 const activate=async()=>{await demo.toggle();announce('Ativado.')}
 const end=async()=>{if(!window.confirm('Encerrar a sessão atual?'))return;await demo.toggle();announce('Encerrado.')}
 const pause=()=>{demo.pause();announce('Pausado.')}
 const resume=()=>{demo.resume();announce('Continuado.')}
 const restart=()=>{demo.restart();announce('Sessão reiniciada.')}
 const updateWeight=<K extends 'methods'|'currencies'|'countries'>(key:K,index:number,field:'enabled'|'weight',value:boolean|number)=>setDraft(current=>({...current,preset:'custom',[key]:current[key].map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item)}))
 if(demo.loadingPermission)return <div className="mode-access-state" role="status">Validando acesso administrativo...</div>
 if(!demo.allowed)return null
 const status=demo.paused?'Pausado':demo.active?'Ativo':'Inativo'
 return <section className="mode-settings" aria-labelledby="mode-settings-title">
  <header className="mode-settings-header"><div><span>CONTROLE DA OPERAÇÃO</span><h2 id="mode-settings-title">Modo</h2><p>Configure uma operação dinâmica para visualizar o funcionamento da plataforma.</p></div><strong className={`mode-status ${status.toLowerCase()}`}><i/>{status}</strong></header>
  <div className="mode-overview">
   <div className="mode-session-card">
    <header><Activity/><div><span>Estado atual</span><strong>{status}</strong></div></header>
    <dl><div><dt>Cenário</dt><dd>{presetLabels[demo.config.preset]}</dd></div><div><dt>Intensidade</dt><dd>{demo.intensity.toFixed(2)}×</dd></div><div><dt>Eventos da sessão</dt><dd>{demo.eventCount}</dd></div><div><dt>Vendas aprovadas</dt><dd>{demo.approvedCount}</dd></div><div><dt>Volume acumulado</dt><dd>{formatCents(demo.sessionVolumeCents,'BRL')}</dd></div><div><dt>Próximo evento</dt><dd>{demo.paused?'Pausado':time(demo.nextEventAt)}</dd></div><div><dt>Velocidade</dt><dd>{demo.intensity.toFixed(2)}×</dd></div><div><dt>Horário de início</dt><dd>{time(demo.startedAt)}</dd></div></dl>
   </div>
   <div className="mode-command-card">
    <span>AÇÕES DA SESSÃO</span><h3>{demo.active?'Gerencie a atividade em andamento.':'Pronto para começar.'}</h3>
    <div className="mode-primary-actions">{!demo.active?<button className="btn btn-primary" onClick={()=>void activate()}><Play/> Ativar</button>:<button className="btn mode-end" onClick={()=>void end()}><Square/> Encerrar</button>}<button className="btn" onClick={()=>navigate('/app')}><ArrowRight/> Ver Dashboard</button></div>
    {demo.active&&<div className="mode-session-actions">{demo.paused?<button className="btn" onClick={resume}><Play/> Continuar</button>:<button className="btn" onClick={pause}><Pause/> Pausar</button>}<button className="btn" onClick={()=>configRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}><Settings2/> Configurar</button><button className="btn" onClick={restart}><RotateCcw/> Reiniciar</button></div>}
    <div className="mode-rhythm"><span>Ritmo da atividade</span><div><button className="btn icon-btn" aria-label="Reduzir ritmo" disabled={!demo.active} onClick={()=>demo.adjustIntensity(-1)}>−</button><strong>{demo.intensity.toFixed(2)}×</strong><button className="btn icon-btn" aria-label="Aumentar ritmo" disabled={!demo.active} onClick={()=>demo.adjustIntensity(1)}>+</button></div></div>
   </div>
  </div>
  <div className="mode-config-card" ref={configRef}>
   <header><div><span>CONFIGURAÇÃO EDITÁVEL</span><h3>Personalize o comportamento</h3></div><Gauge/></header>
   <div className="demo-config-summary"><Gauge/><p>Este cenário produzirá aproximadamente <b>{frequencyHour.min} a {frequencyHour.max} vendas por hora</b>, com ticket entre <b>{formatCents(draft.minAmountCents,'BRL')} e {formatCents(draft.maxAmountCents,'BRL')}</b>.</p></div>
   <div className="demo-config-scroll">
    <section><h3>Cenário</h3><div className="demo-preset-grid">{(Object.keys(presetLabels) as DemoPreset[]).map(id=><button type="button" className={draft.preset===id?'active':''} aria-pressed={draft.preset===id} onClick={()=>choosePreset(id)} key={id}>{presetLabels[id]}</button>)}</div></section>
    <details open><summary>Vendas</summary><div className="demo-config-grid">
     <Field label="Quantidade inicial"><input type="number" min="30" max="2000" value={draft.initialSales} onChange={event=>set('initialSales',number(event.target.value))}/></Field>
     <Field label="Limite da sessão"><input type="number" min="100" max="2000" value={draft.memoryLimit} onChange={event=>set('memoryLimit',number(event.target.value))}/></Field>
     <Field label="Frequência mínima"><input type="number" min="1" value={draft.minFrequency} onChange={event=>set('minFrequency',number(event.target.value))}/></Field>
     <Field label="Frequência máxima"><input type="number" min="1" value={draft.maxFrequency} onChange={event=>set('maxFrequency',number(event.target.value))}/></Field>
     <Field label="Unidade"><select value={draft.frequencyUnit} onChange={event=>set('frequencyUnit',event.target.value as DemoConfig['frequencyUnit'])}><option value="seconds">Segundos</option><option value="minutes">Minutos</option></select></Field>
     <Field label="Valor mínimo"><input inputMode="decimal" value={moneyInput(draft.minAmountCents)} onChange={event=>set('minAmountCents',moneyCents(event.target.value))}/></Field>
     <Field label="Valor máximo"><input inputMode="decimal" value={moneyInput(draft.maxAmountCents)} onChange={event=>set('maxAmountCents',moneyCents(event.target.value))}/></Field>
     <Field label="Ticket desejado"><input inputMode="decimal" value={moneyInput(draft.targetTicketCents)} onChange={event=>set('targetTicketCents',moneyCents(event.target.value))}/></Field>
    </div></details>
    <details><summary>Pagamentos</summary><WeightEditor title="Métodos" values={draft.methods} onChange={(index,field,value)=>updateWeight('methods',index,field,value)}/></details>
    <details><summary>Regiões</summary><WeightEditor title="Moedas" values={draft.currencies} onChange={(index,field,value)=>updateWeight('currencies',index,field,value)}/><WeightEditor title="Países" values={draft.countries} onChange={(index,field,value)=>updateWeight('countries',index,field,value)}/></details>
    <details><summary>Resultados</summary><div className="demo-config-grid">{([['approvalRate','Aprovação'],['declinedRate','Recusa'],['pendingRate','Pendência'],['refundRate','Reembolso'],['chargebackRate','Chargeback']] as const).map(([key,label])=><Field label={`${label} (%)`} key={key}><input type="number" min="0" max="100" value={draft[key]} onChange={event=>set(key,number(event.target.value))}/></Field>)}</div></details>
    <details><summary>Premiações</summary><div className="demo-config-grid"><Field label="Meta da sessão"><select value={draft.sessionGoalCents} onChange={event=>set('sessionGoalCents',number(event.target.value))}><option value="1000000">R$ 10.000,00</option><option value="3000000">R$ 30.000,00</option><option value="10000000">R$ 100.000,00</option></select></Field><Field label="Ritmo das premiações"><input type="number" min=".25" max="3" step=".25" value={draft.awardMultiplier} onChange={event=>set('awardMultiplier',number(event.target.value))}/></Field></div></details>
    <details><summary>Automação</summary><div className="demo-config-grid"><Field label="Início do pico"><input type="number" min="0" max="23" value={draft.peakStartHour} onChange={event=>set('peakStartHour',number(event.target.value))}/></Field><Field label="Fim do pico"><input type="number" min="0" max="23" value={draft.peakEndHour} onChange={event=>set('peakEndHour',number(event.target.value))}/></Field><Field label="Multiplicador do pico"><input type="number" min="1" max="3" step=".1" value={draft.peakMultiplier} onChange={event=>set('peakMultiplier',number(event.target.value))}/></Field><label className="demo-config-check"><input type="checkbox" checked={draft.adaptive} onChange={event=>set('adaptive',event.target.checked)}/><span><b>Automação inteligente</b><small>Ajusta o ritmo gradualmente para evitar repetições.</small></span></label><label className="demo-config-check"><input type="checkbox" checked={draft.useProductPrices} onChange={event=>set('useProductPrices',event.target.checked)}/><span><b>Usar preços cadastrados</b><small>Somente como referência de leitura.</small></span></label></div></details>
    {draft.adaptive&&<p className="demo-adaptive-note">O ritmo será ajustado gradualmente conforme o horário e a intensidade escolhida.</p>}{errors.length>0&&<div className="demo-config-errors" role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}
   </div>
   <footer><button className="btn" onClick={restore}><RotateCcw/> Restaurar padrão</button><button className="btn" onClick={cancel}>Cancelar</button><button className="btn" disabled={!demo.active} onClick={restart}><RotateCcw/> Reiniciar sessão</button><button className="btn btn-primary" onClick={apply}>Aplicar</button></footer>
  </div>
  <p className="mode-announcement" role="status" aria-live="polite">{notice}</p>
 </section>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="demo-config-field"><span>{label}</span>{children}</label>}
function WeightEditor<T extends string>({title,values,onChange}:{title:string;values:Array<{id:T;enabled:boolean;weight:number}>;onChange:(index:number,field:'enabled'|'weight',value:boolean|number)=>void}){
 const total=values.filter(item=>item.enabled).reduce((sum,item)=>sum+item.weight,0)
 const distribute=()=>{const enabled=values.map((item,index)=>({item,index})).filter(({item})=>item.enabled),base=Math.floor(100/Math.max(1,enabled.length));enabled.forEach(({index},position)=>onChange(index,'weight',position===enabled.length-1?100-base*(enabled.length-1):base))}
 return <div className="demo-weight-editor"><header><b>{title}</b><span>Total: {total}%</span><button type="button" onClick={distribute}>Distribuir automaticamente</button></header>{values.map((item,index)=><label key={item.id}><input type="checkbox" checked={item.enabled} onChange={event=>onChange(index,'enabled',event.target.checked)}/><span>{item.id}</span><input aria-label={`Peso de ${item.id}`} type="number" min="0" max="100" disabled={!item.enabled} value={item.weight} onChange={event=>onChange(index,'weight',number(event.target.value))}/><small>%</small></label>)}</div>
}
