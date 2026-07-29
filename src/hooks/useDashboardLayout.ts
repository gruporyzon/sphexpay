import { useCallback,useEffect,useState } from 'react'
import { breakpointForWidth,createDefaultDashboardLayouts,dashboardPreset,loadDashboardLayouts,moveDashboardWidget,resizeDashboardWidget,saveDashboardLayouts,validateDashboardLayout,type DashboardBreakpoint,type DashboardLayoutPreset,type DashboardLayouts,type DashboardWidgetId } from '../lib/dashboardLayout'

const copy=(value:DashboardLayouts)=>structuredClone(value)

export function useDashboardLayout(userId:string|undefined){
 const [applied,setApplied]=useState<DashboardLayouts>(createDefaultDashboardLayouts),[draft,setDraft]=useState<DashboardLayouts>(createDefaultDashboardLayouts)
 const [editing,setEditing]=useState(false),[preview,setPreview]=useState(false),[breakpoint,setBreakpoint]=useState<DashboardBreakpoint>(()=>breakpointForWidth(typeof window==='undefined'?1280:window.innerWidth))
 const [preset,setPreset]=useState<DashboardLayoutPreset>('default'),[selected,setSelected]=useState<DashboardWidgetId|null>(null)
 const [past,setPast]=useState<DashboardLayouts[]>([]),[future,setFuture]=useState<DashboardLayouts[]>([]),[notice,setNotice]=useState('')
 useEffect(()=>{if(!userId)return;const stored=loadDashboardLayouts(userId),next=stored?.layouts??createDefaultDashboardLayouts();setApplied(next);setDraft(copy(next));setPreset(stored?.preset??'default')},[userId])
 useEffect(()=>{const resize=()=>{if(!editing)setBreakpoint(breakpointForWidth(window.innerWidth))};window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[editing])
 const commitDraft=useCallback((next:DashboardLayouts,message='')=>{setDraft(current=>{setPast(history=>[...history.slice(-39),copy(current)]);return next});setFuture([]);setNotice(message)},[])
 const enter=()=>{setDraft(copy(applied));setPast([]);setFuture([]);setEditing(true);setPreview(false);setNotice('Modo de edição ativado.')}
 const cancel=()=>{setDraft(copy(applied));setEditing(false);setPreview(false);setSelected(null);setNotice('Alterações canceladas.')}
 const save=()=>{if(!userId)return false;for(const bp of ['desktop','tablet','mobile'] as DashboardBreakpoint[]){const result=validateDashboardLayout(draft[bp],bp);if(!result.valid){setBreakpoint(bp);setSelected(Object.keys(result.errors)[0] as DashboardWidgetId);setNotice(Object.values(result.errors)[0]);return false}}if(!saveDashboardLayouts(userId,draft,preset)){setNotice('Não foi possível salvar neste dispositivo. O layout anterior foi preservado.');return false}setApplied(copy(draft));setEditing(false);setPreview(false);setSelected(null);setNotice('Layout salvo e aplicado.');return true}
 const undo=()=>setPast(history=>{const previous=history.at(-1);if(!previous)return history;setFuture(values=>[copy(draft),...values]);setDraft(copy(previous));setNotice('Alteração desfeita.');return history.slice(0,-1)})
 const redo=()=>setFuture(values=>{const next=values[0];if(!next)return values;setPast(history=>[...history,copy(draft)]);setDraft(copy(next));setNotice('Alteração refeita.');return values.slice(1)})
 const move=(id:DashboardWidgetId,to:number)=>{const next=copy(draft);next[breakpoint]=moveDashboardWidget(next[breakpoint],id,to);commitDraft(next,`${id} movido para a posição ${to+1}.`)}
 const resize=(id:DashboardWidgetId,width:number,height:number)=>{const next=copy(draft);next[breakpoint]=resizeDashboardWidget(next[breakpoint],id,width,height);const validation=validateDashboardLayout(next[breakpoint],breakpoint);if(!validation.valid){setNotice(validation.errors[id]||'Tamanho inválido.');return}commitDraft(next,'Tamanho atualizado.')}
 const applyPreset=(value:DashboardLayoutPreset)=>{setPreset(value);commitDraft(dashboardPreset(value),'Preset aplicado à visualização.')}
 const restore=(scope:'current'|'all')=>{const defaults=createDefaultDashboardLayouts(),next=copy(draft);if(scope==='all')Object.assign(next,defaults);else next[breakpoint]=defaults[breakpoint];setPreset('default');commitDraft(next,scope==='all'?'Todos os layouts foram restaurados.':'Layout desta tela restaurado.')}
 const restoreWidget=(id:DashboardWidgetId)=>{const defaults=createDefaultDashboardLayouts(),original=defaults[breakpoint].find(entry=>entry.widgetId===id);if(!original)return;const next=copy(draft),without=next[breakpoint].filter(entry=>entry.widgetId!==id);without.splice(original.order,0,original);next[breakpoint]=without.map((entry,order)=>({...entry,order}));commitDraft(next,'Bloco restaurado.')}
 const visible=editing?draft:applied
 return{layouts:visible,editing,preview,breakpoint,preset,selected,notice,canUndo:past.length>0,canRedo:future.length>0,setBreakpoint,setSelected,setPreview,enter,cancel,save,undo,redo,move,resize,applyPreset,restore,restoreWidget}
}
