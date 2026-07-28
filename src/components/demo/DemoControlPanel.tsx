import {useEffect,useMemo,useState} from 'react'
import {Gauge,Pause,Play,RotateCcw,Settings2,Square,X} from 'lucide-react'
import {demoPresets,defaultDemoConfig,validateDemoConfig} from '../../demo/demoSimulationEngine'
import type {DemoConfig,DemoPreset} from '../../demo/types'
import {formatCents} from '../../lib/currencyFormat'
import {useDashboardData} from '../../providers/DashboardDataProvider'

const presetLabels:Record<DemoPreset,string>={light:'Movimento leve',normal:'Operação normal',high:'Alto volume',launch:'Lançamento',peak:'Pico de vendas',subscriptions:'Assinaturas',international:'Internacional',custom:'Cenário personalizado'}
const number=(value:string)=>Number.isFinite(Number(value))?Number(value):0
const moneyInput=(cents:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100)
const moneyCents=(value:string)=>Math.max(0,Math.round(Number(value.replace(/\./g,'').replace(',','.'))*100)||0)

export function DemoControlPanel(){
 const demo=useDashboardData(),[open,setOpen]=useState(false),[draft,setDraft]=useState<DemoConfig>(()=>structuredClone(demo.config)),[errors,setErrors]=useState<string[]>([]),[notice,setNotice]=useState('')
 useEffect(()=>{if(!open)setDraft(structuredClone(demo.config))},[demo.config,open])
 const frequencyHour=useMemo(()=>{const multiplier=draft.frequencyUnit==='minutes'?60:1,min=Math.max(1,draft.minFrequency*multiplier),max=Math.max(min,draft.maxFrequency*multiplier);return{min:Math.round(3600/max),max:Math.round(3600/min)}},[draft])
 const set=<K extends keyof DemoConfig>(key:K,value:DemoConfig[K])=>setDraft(current=>({...current,[key]:value,preset:key==='preset'?value:'custom'} as DemoConfig))
 const choosePreset=(preset:DemoPreset)=>{if(preset==='custom'){set('preset','custom');return}setDraft(structuredClone(demoPresets[preset]));setErrors([])}
 const apply=()=>{const failures=validateDemoConfig(draft);setErrors(failures);if(failures.length)return;demo.applyConfig(draft);setNotice('Configurações aplicadas.');window.setTimeout(()=>setNotice(''),1800)}
 const restore=()=>{setDraft(defaultDemoConfig());setErrors([])}
 const close=()=>{setOpen(false);setErrors([])}
 const updateWeight=<K extends 'methods'|'currencies'|'countries'>(key:K,index:number,field:'enabled'|'weight',value:boolean|number)=>setDraft(current=>({...current,preset:'custom',[key]:current[key].map((item,itemIndex)=>itemIndex===index?{...item,[field]:value}:item)}))
 if(!demo.allowed)return null
 return <>
  {demo.active&&<div className="demo-live-controls" aria-label="Controles do modo">
   <button className="btn" onClick={()=>setOpen(true)}><Settings2/> Configurar modo</button>
   <div className="demo-live-stats"><span>{presetLabels[demo.config.preset]}</span><b>{demo.eventCount} eventos · {demo.approvedCount} aprovadas</b><small>{formatCents(demo.sessionVolumeCents,'BRL')} acumulados</small></div>
   {demo.paused?<button className="btn" onClick={demo.resume}><Play/> Continuar</button>:<button className="btn" onClick={demo.pause}><Pause/> Pausar</button>}
   <button className="btn icon-btn" aria-label="Reduzir ritmo" onClick={()=>demo.adjustIntensity(-1)}>−</button><span>{demo.intensity.toFixed(2)}×</span><button className="btn icon-btn" aria-label="Aumentar ritmo" onClick={()=>demo.adjustIntensity(1)}>+</button>
  </div>}
  {open&&<div className="demo-config-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
   <section className="demo-config-panel" role="dialog" aria-modal="true" aria-labelledby="demo-config-title">
    <header><div><span>CONTROLE DA OPERAÇÃO</span><h2 id="demo-config-title">Configurar modo</h2><p>Personalize o ritmo sem misturar esta sessão com seus dados reais.</p></div><button className="btn icon-btn" aria-label="Fechar configuração" onClick={close}><X/></button></header>
    <div className="demo-config-summary"><Gauge/><p>Este cenário produzirá aproximadamente <b>{frequencyHour.min} a {frequencyHour.max} vendas por hora</b>, com ticket entre <b>{formatCents(draft.minAmountCents,'BRL')} e {formatCents(draft.maxAmountCents,'BRL')}</b>.</p></div>
    <div className="demo-config-scroll">
     <section><h3>Cenário</h3><div className="demo-preset-grid">{(Object.keys(presetLabels) as DemoPreset[]).map(id=><button type="button" className={draft.preset===id?'active':''} aria-pressed={draft.preset===id} onClick={()=>choosePreset(id)} key={id}>{presetLabels[id]}</button>)}</div></section>
     <details open><summary>Vendas</summary><div className="demo-config-grid">
      <Field label="Quantidade inicial"><input type="number" min="30" max="2000" value={draft.initialSales} onChange={event=>set('initialSales',number(event.target.value))}/></Field>
      <Field label="Limite em memória"><input type="number" min="100" max="2000" value={draft.memoryLimit} onChange={event=>set('memoryLimit',number(event.target.value))}/></Field>
      <Field label="Frequência mínima"><input type="number" min="1" value={draft.minFrequency} onChange={event=>set('minFrequency',number(event.target.value))}/></Field>
      <Field label="Frequência máxima"><input type="number" min="1" value={draft.maxFrequency} onChange={event=>set('maxFrequency',number(event.target.value))}/></Field>
      <Field label="Unidade"><select value={draft.frequencyUnit} onChange={event=>set('frequencyUnit',event.target.value as DemoConfig['frequencyUnit'])}><option value="seconds">Segundos</option><option value="minutes">Minutos</option></select></Field>
      <Field label="Valor mínimo"><input inputMode="decimal" value={moneyInput(draft.minAmountCents)} onChange={event=>set('minAmountCents',moneyCents(event.target.value))}/></Field>
      <Field label="Valor máximo"><input inputMode="decimal" value={moneyInput(draft.maxAmountCents)} onChange={event=>set('maxAmountCents',moneyCents(event.target.value))}/></Field>
      <Field label="Ticket desejado"><input inputMode="decimal" value={moneyInput(draft.targetTicketCents)} onChange={event=>set('targetTicketCents',moneyCents(event.target.value))}/></Field>
     </div></details>
     <details><summary>Pagamentos</summary><WeightEditor title="Métodos" values={draft.methods} onChange={(index,field,value)=>updateWeight('methods',index,field,value)}/></details>
     <details><summary>Público e regiões</summary><WeightEditor title="Moedas" values={draft.currencies} onChange={(index,field,value)=>updateWeight('currencies',index,field,value)}/><WeightEditor title="Países" values={draft.countries} onChange={(index,field,value)=>updateWeight('countries',index,field,value)}/></details>
     <details><summary>Resultados</summary><div className="demo-config-grid">
      {([['approvalRate','Aprovação'],['declinedRate','Recusa'],['pendingRate','Pendência'],['refundRate','Reembolso'],['chargebackRate','Chargeback']] as const).map(([key,label])=><Field label={`${label} (%)`} key={key}><input type="number" min="0" max="100" value={draft[key]} onChange={event=>set(key,number(event.target.value))}/></Field>)}
     </div></details>
     <details><summary>Premiações</summary><div className="demo-config-grid"><Field label="Meta da sessão"><select value={draft.sessionGoalCents} onChange={event=>set('sessionGoalCents',number(event.target.value))}><option value="1000000">R$ 10.000,00</option><option value="3000000">R$ 30.000,00</option><option value="10000000">R$ 100.000,00</option></select></Field><Field label="Ritmo das premiações"><input type="number" min=".25" max="3" step=".25" value={draft.awardMultiplier} onChange={event=>set('awardMultiplier',number(event.target.value))}/></Field></div></details>
     <details><summary>Automação</summary><div className="demo-config-grid"><Field label="Início do pico"><input type="number" min="0" max="23" value={draft.peakStartHour} onChange={event=>set('peakStartHour',number(event.target.value))}/></Field><Field label="Fim do pico"><input type="number" min="0" max="23" value={draft.peakEndHour} onChange={event=>set('peakEndHour',number(event.target.value))}/></Field><Field label="Multiplicador do pico"><input type="number" min="1" max="3" step=".1" value={draft.peakMultiplier} onChange={event=>set('peakMultiplier',number(event.target.value))}/></Field><label className="demo-config-check"><input type="checkbox" checked={draft.adaptive} onChange={event=>set('adaptive',event.target.checked)}/><span><b>Automação inteligente</b><small>Ajusta o ritmo gradualmente para evitar repetições.</small></span></label><label className="demo-config-check"><input type="checkbox" checked={draft.useProductPrices} onChange={event=>set('useProductPrices',event.target.checked)}/><span><b>Usar preços cadastrados</b><small>Somente como referência de leitura.</small></span></label></div></details>
     {draft.adaptive&&<p className="demo-adaptive-note">O ritmo será ajustado gradualmente conforme o horário e a intensidade escolhida.</p>}{errors.length>0&&<div className="demo-config-errors" role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}{notice&&<p className="demo-config-notice" role="status">{notice}</p>}
    </div>
    <footer><button className="btn" onClick={restore}><RotateCcw/> Restaurar padrão</button><button className="btn" onClick={demo.restart}><RotateCcw/> Reiniciar sessão</button>{demo.paused?<button className="btn" onClick={demo.resume}><Play/> Continuar atividade</button>:<button className="btn" onClick={demo.pause}><Pause/> Pausar atividade</button>}<button className="btn demo-end" onClick={()=>void demo.toggle()}><Square/> Encerrar modo</button><button className="btn btn-primary" onClick={apply}>Aplicar configurações</button></footer>
   </section>
  </div>}
 </>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="demo-config-field"><span>{label}</span>{children}</label>}
function WeightEditor<T extends string>({title,values,onChange}:{title:string;values:Array<{id:T;enabled:boolean;weight:number}>;onChange:(index:number,field:'enabled'|'weight',value:boolean|number)=>void}){
 const total=values.filter(item=>item.enabled).reduce((sum,item)=>sum+item.weight,0)
 const distribute=()=>{const enabled=values.map((item,index)=>({item,index})).filter(({item})=>item.enabled),base=Math.floor(100/Math.max(1,enabled.length));enabled.forEach(({index},position)=>onChange(index,'weight',position===enabled.length-1?100-base*(enabled.length-1):base))}
 return <div className="demo-weight-editor"><header><b>{title}</b><span>Total: {total}%</span><button type="button" onClick={distribute}>Distribuir automaticamente</button></header>{values.map((item,index)=><label key={item.id}><input type="checkbox" checked={item.enabled} onChange={event=>onChange(index,'enabled',event.target.checked)}/><span>{item.id}</span><input aria-label={`Peso de ${item.id}`} type="number" min="0" max="100" disabled={!item.enabled} value={item.weight} onChange={event=>onChange(index,'weight',number(event.target.value))}/><small>%</small></label>)}</div>
}
