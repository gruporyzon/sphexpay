import {useEffect,useMemo,useRef,useState} from 'react'
import {Activity,ArrowRight,Bell,Gauge,Pause,Play,RotateCcw,Settings2,Square} from 'lucide-react'
import {useNavigate} from 'react-router-dom'
import {demoPresets,defaultDemoConfig,validateDemoConfig} from '../../demo/demoSimulationEngine'
import type {DemoConfig,DemoPreset} from '../../demo/types'
import {formatCents} from '../../lib/currencyFormat'
import {useDashboardData} from '../../providers/DashboardDataProvider'
import {pushSubscriptionService,type PushDevice} from '../../services/pushSubscriptionService'

const presetLabels:Record<DemoPreset,string>={light:'Movimento leve',normal:'Operação normal',high:'Alto volume',launch:'Lançamento',peak:'Pico de vendas',subscriptions:'Assinaturas',international:'Internacional',custom:'Personalizado'}
const number=(value:string)=>Number.isFinite(Number(value))?Number(value):0
const moneyInput=(cents:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)
const moneyCents=(value:string)=>Math.max(0,Math.round(Number(value.replace(/\./g,'').replace(',','.'))*100)||0)
const time=(value:string|number|null)=>value?new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:typeof value==='number'?'2-digit':undefined}):'—'
const speed=(value:number)=>`${value.toFixed(2).replace('.',',')}x`

export function DemoControlPanel(){
 const demo=useDashboardData(),navigate=useNavigate(),configRef=useRef<HTMLDivElement>(null),noticeTimer=useRef<number|undefined>(undefined)
 const [draft,setDraft]=useState<DemoConfig>(()=>structuredClone(demo.config)),[errors,setErrors]=useState<string[]>([]),[notice,setNotice]=useState(''),[devices,setDevices]=useState<PushDevice[]>([])
 useEffect(()=>setDraft(structuredClone(demo.config)),[demo.config])
 useEffect(()=>{let alive=true;void pushSubscriptionService.devices().then(value=>{if(alive)setDevices(value.filter(device=>device.enabled))});return()=>{alive=false}},[])
 useEffect(()=>()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current)},[])
 const announce=(message:string)=>{setNotice(message);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=window.setTimeout(()=>setNotice(''),2200)}
 const frequencyHour=useMemo(()=>{const multiplier=draft.frequencyUnit==='minutes'?60:1,min=Math.max(1,draft.minFrequency*multiplier),max=Math.max(min,draft.maxFrequency*multiplier);return{min:Math.round(3600/max),max:Math.round(3600/min)}},[draft])
 const set=<K extends keyof DemoConfig>(key:K,value:DemoConfig[K])=>setDraft(current=>({...current,[key]:value,preset:key==='preset'?value:'custom'} as DemoConfig))
 const choosePreset=(preset:DemoPreset)=>{if(preset==='custom'){set('preset','custom');return}setDraft(current=>({...structuredClone(demoPresets[preset]),pushNotifications:structuredClone(current.pushNotifications)}));setErrors([])}
 const apply=()=>{const failures=validateDemoConfig(draft);setErrors(failures);if(failures.length)return;demo.applyConfig(draft);announce('Configurações aplicadas.')}
 const restore=()=>{setDraft(defaultDemoConfig());setErrors([])}
 const cancel=()=>{setDraft(structuredClone(demo.config));setErrors([])}
 const activate=async()=>{await demo.toggle();announce('Ativado.')}
 const end=async()=>{if(!window.confirm('Encerrar a sessão atual?'))return;await demo.toggle();announce('Operação encerrada.')}
 const pause=()=>{demo.pause();announce('Operação pausada.')}
 const resume=()=>{demo.resume();announce('Operação continuada.')}
 const restart=()=>{demo.restart();announce('Sessão reiniciada.')}
 const changeSpeed=(direction:-1|1)=>{const next=Math.min(3,Math.max(.25,Number((demo.intensity+direction*.25).toFixed(2))));demo.adjustIntensity(direction);announce(`Velocidade alterada para ${speed(next)}.`)}
 const updateWeight=<K extends 'methods'|'currencies'|'countries'>(key:K,index:number,field:'enabled'|'weight',value:boolean|number)=>setDraft(current=>({...current,preset:'custom',[key]:current[key].map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item)}))
 const setPush=<K extends keyof DemoConfig['pushNotifications']>(key:K,value:DemoConfig['pushNotifications'][K])=>setDraft(current=>({...current,preset:'custom',pushNotifications:{...current.pushNotifications,[key]:value}}))
 if(demo.loadingPermission)return <div className="mode-access-state" role="status">Validando acesso administrativo...</div>
 if(!demo.allowed)return null
 const status=demo.paused?'Pausado':demo.active?'Ativo':'Inativo'
 return <section className="mode-settings" aria-labelledby="mode-settings-title">
  <header className="mode-settings-header"><div><span>CONTROLE DA OPERAÇÃO</span><h2 id="mode-settings-title">Modo</h2><p>Configure uma operação dinâmica para visualizar o funcionamento da plataforma.</p></div><strong className={`mode-status ${status.toLowerCase()}`}><i/>{status}</strong></header>
  <div className="mode-overview">
   <div className="mode-command-card" aria-labelledby="mode-control-title">
    <span>CONTROLE DA OPERAÇÃO</span><h3 id="mode-control-title">Controle da operação</h3>
    {!demo.active?<div className="mode-primary-actions"><button className="btn btn-primary" onClick={()=>void activate()}><Play/> Ativar</button><button className="btn" onClick={()=>navigate('/app')}><ArrowRight/> Ver Dashboard</button></div>:<>
     <div className="mode-session-actions">{demo.paused?<button className="btn" onClick={resume}><Play/> Continuar</button>:<button className="btn" onClick={pause}><Pause/> Pausar</button>}<button className="btn" onClick={()=>configRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}><Settings2/> Configurar</button><button className="btn" onClick={()=>navigate('/app')}><ArrowRight/> Ver Dashboard</button></div>
     <div className="mode-rhythm"><span>Velocidade</span><div><button className="btn icon-btn" aria-label="Reduzir velocidade" disabled={demo.intensity<=.25} onClick={()=>changeSpeed(-1)}>−</button><strong aria-live="polite">{speed(demo.intensity)}</strong><button className="btn icon-btn" aria-label="Aumentar velocidade" disabled={demo.intensity>=3} onClick={()=>changeSpeed(1)}>+</button></div></div>
    </>}
   </div>
   <div className="mode-session-card" aria-labelledby="mode-summary-title">
    <header><Activity/><div><span>Estado atual</span><strong>{status}</strong></div></header>
    <h3 id="mode-summary-title" className="sr-only">Resumo da sessão</h3>
    <dl><div><dt>Cenário</dt><dd>{presetLabels[demo.config.preset]}</dd></div><div><dt>Eventos</dt><dd>{demo.eventCount}</dd></div><div><dt>Aprovadas</dt><dd>{demo.approvedCount}</dd></div><div><dt>Volume acumulado</dt><dd>{formatCents(demo.sessionVolumeCents,'BRL')}</dd></div><div><dt>Velocidade</dt><dd>{speed(demo.intensity)}</dd></div><div><dt>Início da sessão</dt><dd>{time(demo.startedAt)}</dd></div><div><dt>Próximo evento</dt><dd>{demo.paused?'Pausado':time(demo.nextEventAt)}</dd></div></dl>
   </div>
  </div>
  <div className="mode-config-card" ref={configRef}>
   <header><div><span>CONFIGURAÇÃO EDITÁVEL</span><h3>Personalize o comportamento</h3></div><Gauge/></header>
   <div className="demo-config-summary"><Gauge/><p>Este cenário produzirá aproximadamente <b>{frequencyHour.min} a {frequencyHour.max} vendas por hora</b>, com ticket entre <b>{formatCents(draft.minAmountCents,'BRL')} e {formatCents(draft.maxAmountCents,'BRL')}</b>.</p></div>
   <div className="demo-config-scroll">
    <section><h3>Cenários</h3><div className="demo-preset-grid">{(Object.keys(presetLabels) as DemoPreset[]).map(id=><button type="button" className={draft.preset===id?'active':''} aria-pressed={draft.preset===id} onClick={()=>choosePreset(id)} key={id}>{id==='normal'?'Normal':presetLabels[id]}</button>)}</div></section>
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
    <details open><summary>Notificações da operação</summary><div className="mode-push-settings">
     <label className="demo-config-check"><input type="checkbox" checked={draft.pushNotifications.enabled} onChange={event=>setPush('enabled',event.target.checked)}/><span><b>Notificações automáticas</b><small>Envia somente novas vendas aprovadas produzidas por esta operação.</small></span></label>
     <div className="demo-config-grid">
      <Field label="Enviar para"><select value={draft.pushNotifications.destination} onChange={event=>setPush('destination',event.target.value as DemoConfig['pushNotifications']['destination'])}><option value="all">Todos os meus dispositivos</option><option value="current">Este dispositivo</option><option value="selected">Dispositivos selecionados</option></select></Field>
      <Field label="Frequência das notificações"><select value={draft.pushNotifications.frequency} onChange={event=>setPush('frequency',event.target.value as DemoConfig['pushNotifications']['frequency'])}><option value="each">Cada venda</option><option value="5s">No máximo uma a cada 5 segundos</option><option value="15s">No máximo uma a cada 15 segundos</option><option value="60s">No máximo uma por minuto</option><option value="summary">Resumo por período</option></select></Field>
      <Field label="Limite por sessão"><input type="number" min="1" max="500" value={draft.pushNotifications.maxPerSession} onChange={event=>setPush('maxPerSession',Math.min(500,Math.max(1,number(event.target.value))))}/></Field>
     </div>
     <div className="mode-push-methods" aria-label="Tipos de vendas aprovadas">{draft.methods.map(item=><label key={item.id}><input type="checkbox" checked={draft.pushNotifications.methods.includes(item.id)} onChange={event=>setPush('methods',event.target.checked?[...draft.pushNotifications.methods,item.id]:draft.pushNotifications.methods.filter(method=>method!==item.id))}/><span>{item.id}</span></label>)}</div>
     {(draft.pushNotifications.destination==='current'||draft.pushNotifications.destination==='selected')&&<div className="mode-push-devices">{devices.map(device=><label key={device.deviceId}><input type={draft.pushNotifications.destination==='current'?'radio':'checkbox'} name="mode-push-device" checked={draft.pushNotifications.deviceIds.includes(device.deviceId)} onChange={event=>setPush('deviceIds',draft.pushNotifications.destination==='current'?[device.deviceId]:event.target.checked?[...draft.pushNotifications.deviceIds,device.deviceId]:draft.pushNotifications.deviceIds.filter(id=>id!==device.deviceId))}/><span><b>{device.name}</b><small>{device.platform} · {device.browser}</small></span></label>)}</div>}
     <label className="demo-config-check"><input type="checkbox" checked={draft.pushNotifications.vary} onChange={event=>setPush('vary',event.target.checked)}/><span><b>Variar mensagens automaticamente</b><small>Usa variações locais curtas, sem chamar IA a cada venda.</small></span></label>
     <div className="mode-push-status" role="status" aria-live="polite"><Bell/><div><b>{devices.length===0?'Nenhum dispositivo conectado':demo.paused?'Notificações pausadas':draft.pushNotifications.enabled?'Notificações ativas':'Notificações desativadas'}</b><small>{devices.length===0?'O modo continua funcionando normalmente.':demo.paused?'Operação pausada. Novas notificações também foram pausadas.':'As novas vendas aprovadas serão enviadas aos seus dispositivos.'}</small></div><dl><span>{demo.pushStats.attempted} tentativas</span><span>{demo.pushStats.sent} entregas</span><span>{demo.pushStats.failed} falhas</span></dl></div>
     {draft.minFrequency<5&&draft.frequencyUnit==='seconds'&&draft.pushNotifications.frequency==='each'&&<p className="demo-adaptive-note">Um ritmo alto pode gerar muitas notificações.</p>}
     <button type="button" className="btn" onClick={()=>navigate('/app/configuracoes?secao=Notificações')}><ArrowRight/> Abrir configurações de notificações</button>
    </div></details>
    {draft.adaptive&&<p className="demo-adaptive-note">O ritmo será ajustado gradualmente conforme o horário e a intensidade escolhida.</p>}{errors.length>0&&<div className="demo-config-errors" role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}
   </div>
   <footer><button className="btn" onClick={restore}><RotateCcw/> Restaurar padrão</button><button className="btn" onClick={cancel}>Cancelar</button><button className="btn btn-primary" onClick={apply}>Aplicar</button></footer>
  </div>
  <section className="mode-advanced-actions" aria-labelledby="mode-advanced-title"><div><span>AÇÕES AVANÇADAS</span><h3 id="mode-advanced-title">Ações avançadas</h3><p>Reinicie a atividade preservando as configurações ou encerre a sessão atual.</p></div><div><button className="btn" disabled={!demo.active} onClick={restart}><RotateCcw/> Reiniciar sessão</button><button className="btn mode-end" disabled={!demo.active} onClick={()=>void end()}><Square/> Encerrar</button></div></section>
  <p className="mode-announcement" role="status" aria-live="polite">{notice}</p>
 </section>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="demo-config-field"><span>{label}</span>{children}</label>}
function WeightEditor<T extends string>({title,values,onChange}:{title:string;values:Array<{id:T;enabled:boolean;weight:number}>;onChange:(index:number,field:'enabled'|'weight',value:boolean|number)=>void}){
 const total=values.filter(item=>item.enabled).reduce((sum,item)=>sum+item.weight,0)
 const distribute=()=>{const enabled=values.map((item,index)=>({item,index})).filter(({item})=>item.enabled),base=Math.floor(100/Math.max(1,enabled.length));enabled.forEach(({index},position)=>onChange(index,'weight',position===enabled.length-1?100-base*(enabled.length-1):base))}
 return <div className="demo-weight-editor"><header><b>{title}</b><span>Total: {total}%</span><button type="button" onClick={distribute}>Distribuir automaticamente</button></header>{values.map((item,index)=><label key={item.id}><input type="checkbox" checked={item.enabled} onChange={event=>onChange(index,'enabled',event.target.checked)}/><span>{item.id}</span><input aria-label={`Peso de ${item.id}`} type="number" min="0" max="100" disabled={!item.enabled} value={item.weight} onChange={event=>onChange(index,'weight',number(event.target.value))}/><small>%</small></label>)}</div>
}
