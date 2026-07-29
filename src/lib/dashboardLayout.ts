export type DashboardBreakpoint='desktop'|'tablet'|'mobile'
export type DashboardWidgetId='gross-revenue'|'net-revenue'|'fees'|'approved-sales'|'average-ticket'|'approval-rate'|'refunds'|'chargebacks'|'revenue-chart'|'recent-sales'
export type DashboardLayoutItem={widgetId:DashboardWidgetId;breakpoint:DashboardBreakpoint;order:number;columnStart:number;columnSpan:number;rowSpan:number;visible:true}
export type DashboardLayouts=Record<DashboardBreakpoint,DashboardLayoutItem[]>
export type DashboardLayoutPreset='default'|'metrics-first'|'chart-focus'|'sales-focus'|'compact'|'executive'
export type StoredDashboardLayout={version:1;userId:string;layouts:DashboardLayouts;preset:DashboardLayoutPreset;updatedAt:string}

export const DASHBOARD_LAYOUT_STORAGE_KEY='sphexpay_dashboard_layout_v1'
export const DASHBOARD_WIDGET_IDS:DashboardWidgetId[]=['gross-revenue','net-revenue','fees','approved-sales','average-ticket','approval-rate','refunds','chargebacks','revenue-chart','recent-sales']
export const DASHBOARD_WIDGET_LABELS:Record<DashboardWidgetId,string>={
 'gross-revenue':'Faturamento','net-revenue':'Resultado líquido',fees:'Taxas','approved-sales':'Vendas aprovadas','average-ticket':'Ticket médio','approval-rate':'Taxa de aprovação',refunds:'Reembolsos',chargebacks:'Chargebacks','revenue-chart':'Gráfico principal','recent-sales':'Vendas recentes'
}
export const BREAKPOINT_COLUMNS:Record<DashboardBreakpoint,number>={desktop:12,tablet:8,mobile:2}

const item=(widgetId:DashboardWidgetId,breakpoint:DashboardBreakpoint,order:number,columnSpan:number,rowSpan=1):DashboardLayoutItem=>({widgetId,breakpoint,order,columnStart:1,columnSpan,rowSpan,visible:true})
const metrics:DashboardWidgetId[]=DASHBOARD_WIDGET_IDS.slice(0,8) as DashboardWidgetId[]

export const createDefaultDashboardLayouts=():DashboardLayouts=>({
 desktop:[
  item('gross-revenue','desktop',0,6),item('net-revenue','desktop',1,6),
  ...metrics.slice(2).map((id,index)=>item(id,'desktop',index+2,2)),
  item('revenue-chart','desktop',8,8,3),item('recent-sales','desktop',9,4,3)
 ],
 tablet:[
  ...metrics.map((id,index)=>item(id,'tablet',index,2)),
  item('revenue-chart','tablet',8,8,3),item('recent-sales','tablet',9,8,3)
 ],
 mobile:[
  item('gross-revenue','mobile',0,2),item('net-revenue','mobile',1,2),
  ...metrics.slice(2).map((id,index)=>item(id,'mobile',index+2,1)),
  item('revenue-chart','mobile',8,2,3),item('recent-sales','mobile',9,2,3)
 ]
})

const limits=(id:DashboardWidgetId,breakpoint:DashboardBreakpoint)=>{
 const columns=BREAKPOINT_COLUMNS[breakpoint]
 if(breakpoint==='mobile'){
  const full=id==='revenue-chart'||id==='recent-sales'
  return{min:full?columns:1,max:columns,minRows:id==='revenue-chart'?3:1,maxRows:id==='revenue-chart'?4:id==='recent-sales'?5:2}
 }
 if(id==='revenue-chart')return{min:breakpoint==='desktop'?6:columns,max:columns,minRows:2,maxRows:4}
 if(id==='recent-sales')return{min:breakpoint==='desktop'?3:columns,max:breakpoint==='desktop'?6:columns,minRows:2,maxRows:5}
 if(id==='gross-revenue'||id==='net-revenue')return{min:2,max:breakpoint==='desktop'?6:4,minRows:1,maxRows:2}
 return{min:2,max:breakpoint==='desktop'?6:4,minRows:1,maxRows:2}
}

export function validateDashboardLayout(layout:DashboardLayoutItem[],breakpoint:DashboardBreakpoint){
 const errors:Record<string,string>={},columns=BREAKPOINT_COLUMNS[breakpoint],seen=new Set<string>()
 for(const id of DASHBOARD_WIDGET_IDS)if(!layout.some(entry=>entry.widgetId===id))errors[id]='Bloco obrigatório ausente.'
 for(const entry of layout){
  if(seen.has(entry.widgetId))errors[entry.widgetId]='Bloco duplicado.';seen.add(entry.widgetId)
  const range=limits(entry.widgetId,breakpoint)
  if(entry.breakpoint!==breakpoint)errors[entry.widgetId]='Configuração associada à tela incorreta.'
  else if(!Number.isInteger(entry.order)||entry.order<0)errors[entry.widgetId]='Ordem inválida.'
  else if(!Number.isInteger(entry.columnStart)||entry.columnStart<1||entry.columnStart>columns)errors[entry.widgetId]='Posição fora da área disponível.'
  else if(!Number.isInteger(entry.columnSpan)||entry.columnSpan<range.min||entry.columnSpan>range.max)errors[entry.widgetId]=entry.widgetId==='revenue-chart'?'O gráfico ficou menor que o tamanho mínimo.':'Largura inválida.'
  else if(entry.columnSpan>columns||entry.columnStart+entry.columnSpan-1>columns)errors[entry.widgetId]='O bloco ultrapassa a largura da tela.'
  else if(!Number.isInteger(entry.rowSpan)||entry.rowSpan<range.minRows||entry.rowSpan>range.maxRows)errors[entry.widgetId]='Altura inválida.'
 }
 return{valid:Object.keys(errors).length===0,errors}
}

const normalized=(items:DashboardLayoutItem[],breakpoint:DashboardBreakpoint)=>items.map((entry,order)=>({...entry,breakpoint,order,columnStart:1,visible:true as const}))

export function dashboardPreset(preset:DashboardLayoutPreset):DashboardLayouts{
 const base=createDefaultDashboardLayouts()
 if(preset==='default'||preset==='metrics-first')return base
 const reorder=(breakpoint:DashboardBreakpoint,ids:DashboardWidgetId[])=>normalized(ids.map(id=>base[breakpoint].find(entry=>entry.widgetId===id)!),breakpoint)
 for(const breakpoint of ['desktop','tablet','mobile'] as DashboardBreakpoint[]){
  if(preset==='chart-focus'){
   base[breakpoint]=reorder(breakpoint,['revenue-chart',...metrics,'recent-sales'])
   base[breakpoint]=base[breakpoint].map(entry=>entry.widgetId==='revenue-chart'?{...entry,columnSpan:BREAKPOINT_COLUMNS[breakpoint],rowSpan:4}:entry)
  }else if(preset==='sales-focus'){
   base[breakpoint]=reorder(breakpoint,['recent-sales',...metrics,'revenue-chart'])
   base[breakpoint]=base[breakpoint].map(entry=>entry.widgetId==='recent-sales'?{...entry,columnSpan:breakpoint==='desktop'?6:BREAKPOINT_COLUMNS[breakpoint],rowSpan:4}:entry)
  }else if(preset==='compact'){
   base[breakpoint]=base[breakpoint].map(entry=>({...entry,rowSpan:entry.widgetId==='revenue-chart'?(breakpoint==='mobile'?3:2):entry.widgetId==='recent-sales'?2:1,columnSpan:breakpoint==='desktop'&&!['gross-revenue','net-revenue','revenue-chart','recent-sales'].includes(entry.widgetId)?2:entry.columnSpan}))
  }else if(preset==='executive'){
   base[breakpoint]=reorder(breakpoint,['gross-revenue','net-revenue','revenue-chart','approved-sales','average-ticket','approval-rate','fees','refunds','chargebacks','recent-sales'])
  }
 }
 return base
}

export const moveDashboardWidget=(layout:DashboardLayoutItem[],id:DashboardWidgetId,to:number)=>{
 const ordered=layout.slice().sort((a,b)=>a.order-b.order),from=ordered.findIndex(entry=>entry.widgetId===id)
 if(from<0)return layout
 const [entry]=ordered.splice(from,1);ordered.splice(Math.max(0,Math.min(to,ordered.length)),0,entry)
 return normalized(ordered,entry.breakpoint)
}

export const resizeDashboardWidget=(layout:DashboardLayoutItem[],id:DashboardWidgetId,columnSpan:number,rowSpan:number)=>layout.map(entry=>entry.widgetId===id?{...entry,columnSpan,rowSpan}:entry)

export function loadDashboardLayouts(userId:string):StoredDashboardLayout|null{
 try{
  const parsed=JSON.parse(localStorage.getItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}:${userId}`)||'null') as StoredDashboardLayout|null
  if(!parsed||parsed.version!==1||parsed.userId!==userId)return null
  for(const breakpoint of ['desktop','tablet','mobile'] as DashboardBreakpoint[])if(!validateDashboardLayout(parsed.layouts?.[breakpoint]??[],breakpoint).valid)return null
  return parsed
 }catch{return null}
}

export function saveDashboardLayouts(userId:string,layouts:DashboardLayouts,preset:DashboardLayoutPreset){
 const value:StoredDashboardLayout={version:1,userId,layouts,preset,updatedAt:new Date().toISOString()}
 try{localStorage.setItem(`${DASHBOARD_LAYOUT_STORAGE_KEY}:${userId}`,JSON.stringify(value));return true}catch{return false}
}

export const breakpointForWidth=(width:number):DashboardBreakpoint=>width>1024?'desktop':width>=768?'tablet':'mobile'
export const dashboardWidgetLimits=limits
