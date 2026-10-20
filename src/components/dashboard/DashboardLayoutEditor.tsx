import {translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {T} from '../../i18n'
import { useState,type CSSProperties,type DragEvent,type ReactNode } from 'react'
import { ArrowDown,ArrowUp,Eye,GripVertical,LayoutGrid,Redo2,RotateCcw,Save,Undo2,X } from 'lucide-react'
import { BREAKPOINT_COLUMNS,DASHBOARD_WIDGET_LABELS,dashboardWidgetLimits,type DashboardBreakpoint,type DashboardLayoutItem,type DashboardLayoutPreset,type DashboardWidgetId } from '../../lib/dashboardLayout'
import type { useDashboardLayout } from '../../hooks/useDashboardLayout'

type Editor=ReturnType<typeof useDashboardLayout>
const breakpointLabels:Record<DashboardBreakpoint,string>={desktop:'Computador',tablet:'Tablet',mobile:'Celular'}
const presetLabels:Record<DashboardLayoutPreset,string>={default:'Padrão','metrics-first':'Métricas primeiro','chart-focus':'Gráfico em destaque','sales-focus':'Vendas recentes em destaque',compact:'Compacto',executive:'Executivo'}

export function DashboardLayoutButton({editor}:{editor:Editor}){useAppLocale(state=>state.locale);return <button className="btn dashboard-layout-trigger" aria-label={uiText("Editar layout")} onClick={editor.enter}><LayoutGrid/><span className="dashboard-layout-label"><T>Editar layout</T></span></button>}

export function DashboardLayoutEditor({editor,widgets}:{editor:Editor;widgets:Record<DashboardWidgetId,ReactNode>}){useAppLocale(state=>state.locale);
 const [dragging,setDragging]=useState<DashboardWidgetId|null>(null),items=editor.layouts[editor.breakpoint].slice().sort((a,b)=>a.order-b.order)
 const drop=(event:DragEvent,id:DashboardWidgetId)=>{event.preventDefault();if(!dragging||dragging===id)return;editor.move(dragging,items.findIndex(entry=>entry.widgetId===id));setDragging(null)}
 return <>
  {editor.editing&&<div className="layout-editor-toolbar" aria-label={uiText("Ferramentas do editor")}>
   <div className="layout-editor-breakpoints" aria-label={uiText("Visualizar como")}>{(['desktop','tablet','mobile'] as DashboardBreakpoint[]).map(value=><button key={value} className={editor.breakpoint===value?'active':''} onClick={()=>editor.setBreakpoint(value)}>{breakpointLabels[value]}</button>)}</div>
   <select aria-label={uiText("Preset de layout")} value={editor.preset} onChange={event=>editor.applyPreset(event.target.value as DashboardLayoutPreset)}>{Object.entries(presetLabels).map(([value,label])=><option key={value} value={value}><T>{label}</T></option>)}</select>
   <button className="btn" onClick={editor.undo} disabled={!editor.canUndo} aria-label={uiText("Desfazer")}><Undo2/> <span><T>Desfazer</T></span></button>
   <button className="btn" onClick={editor.redo} disabled={!editor.canRedo} aria-label={uiText("Refazer")}><Redo2/> <span><T>Refazer</T></span></button>
   <button className="btn" onClick={()=>editor.setPreview(!editor.preview)}><Eye/> <T>{editor.preview?'Voltar ao editor':'Visualizar'}</T></button>
   <RestoreButton editor={editor}/>
   <button className="btn" onClick={editor.cancel}><X/><T> Cancelar</T></button>
   <button className="btn btn-primary" onClick={editor.save}><Save/><T> Salvar</T></button>
  </div>}
  <div className={`dashboard-layout-grid breakpoint-${editor.breakpoint} ${editor.editing?'is-editing':''} ${editor.preview?'is-preview':''}`} style={{'--layout-columns':BREAKPOINT_COLUMNS[editor.breakpoint]} as CSSProperties}>
   {items.map((entry,index)=><WidgetFrame key={entry.widgetId} entry={entry} index={index} editing={editor.editing&&!editor.preview} selected={editor.selected===entry.widgetId} onSelect={()=>editor.setSelected(entry.widgetId)} onDragStart={()=>{setDragging(entry.widgetId);editor.setSelected(entry.widgetId)}} onDragEnd={()=>setDragging(null)} onDrop={event=>drop(event,entry.widgetId)} onMove={to=>editor.move(entry.widgetId,to)}>{widgets[entry.widgetId]}</WidgetFrame>)}
  </div>
  {editor.editing&&!editor.preview&&editor.selected&&<Properties editor={editor} item={items.find(entry=>entry.widgetId===editor.selected)!}/>}
  <p className="sr-only" aria-live="polite">{editor.notice}</p>
 </>
}

function WidgetFrame({entry,index,editing,selected,onSelect,onDragStart,onDragEnd,onDrop,onMove,children}:{entry:DashboardLayoutItem;index:number;editing:boolean;selected:boolean;onSelect:()=>void;onDragStart:()=>void;onDragEnd:()=>void;onDrop:(event:DragEvent)=>void;onMove:(to:number)=>void;children:ReactNode}){useAppLocale(state=>state.locale);
 return <article className={`dashboard-layout-widget ${editing?'editable':''} ${selected?'selected':''}`} style={{gridColumn:`span ${entry.columnSpan}`,gridRow:`span ${entry.rowSpan}`}} data-widget-id={entry.widgetId} onClick={editing?onSelect:undefined} onDragOver={event=>{if(editing)event.preventDefault()}} onDrop={onDrop}>
  {editing&&<div className="layout-widget-controls"><button draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label={`Arrastar ${DASHBOARD_WIDGET_LABELS[entry.widgetId]}`}><GripVertical/></button><span>{DASHBOARD_WIDGET_LABELS[entry.widgetId]}</span><button onClick={event=>{event.stopPropagation();onMove(index-1)}} disabled={index===0} aria-label={`Mover ${DASHBOARD_WIDGET_LABELS[entry.widgetId]} para cima`}><ArrowUp/></button><button onClick={event=>{event.stopPropagation();onMove(index+1)}} aria-label={`Mover ${DASHBOARD_WIDGET_LABELS[entry.widgetId]} para baixo`}><ArrowDown/></button></div>}
  <div className="dashboard-widget-content">{children}</div>
 </article>
}

function RestoreButton({editor}:{editor:Editor}){useAppLocale(state=>state.locale);
 const restore=()=>{const all=window.confirm('Restaurar todos os tamanhos de tela? Se cancelar, somente a tela atual será restaurada.');const confirmed=window.confirm(all?'Confirmar restauração de todos os layouts?':'Confirmar restauração do layout desta tela?');if(confirmed)editor.restore(all?'all':'current')}
 return <button className="btn" onClick={restore}><RotateCcw/><T> Restaurar padrão</T></button>
}

function Properties({editor,item}:{editor:Editor;item:DashboardLayoutItem}){useAppLocale(state=>state.locale);
 const limits=dashboardWidgetLimits(item.widgetId,editor.breakpoint),widths=[...new Set([limits.min,Math.round((limits.min+limits.max)/2),limits.max,BREAKPOINT_COLUMNS[editor.breakpoint]].filter(value=>value>=limits.min&&value<=limits.max))],labels=['Pequeno','Médio','Grande','Largura total'],ordered=editor.layouts[editor.breakpoint].slice().sort((a,b)=>a.order-b.order),index=ordered.findIndex(entry=>entry.widgetId===item.widgetId)
 return <aside className="layout-properties" aria-label={uiText("Propriedades do bloco")}><header><div><small><T>BLOCO SELECIONADO</T></small><h3>{DASHBOARD_WIDGET_LABELS[item.widgetId]}</h3></div><button aria-label={uiText("Fechar propriedades")} onClick={()=>editor.setSelected(null)}><X/></button></header>
  <label><span><T>Largura</T></span><select value={item.columnSpan} disabled={editor.breakpoint==='mobile'} onChange={event=>editor.resize(item.widgetId,Number(event.target.value),item.rowSpan)}>{widths.map((value,i)=><option key={value} value={value}>{labels[i]??'Grande'}</option>)}</select></label>
  <label><span><T>Altura</T></span><select value={item.rowSpan} onChange={event=>editor.resize(item.widgetId,item.columnSpan,Number(event.target.value))}>{Array.from({length:limits.maxRows-limits.minRows+1},(_,i)=>limits.minRows+i).map((value,i)=><option key={value} value={value}>{['Padrão','Confortável','Alta','Máxima'][i]??`Altura ${i+1}`}</option>)}</select></label>
  <p><T>Posição </T>{index+1}<T> de </T>{ordered.length}</p><div><button className="btn" disabled={index===0} onClick={()=>editor.move(item.widgetId,index-1)}><ArrowUp/><T> Mover para cima</T></button><button className="btn" disabled={index===ordered.length-1} onClick={()=>editor.move(item.widgetId,index+1)}><ArrowDown/><T> Mover para baixo</T></button></div>
  <button className="btn" onClick={()=>editor.restoreWidget(item.widgetId)}><RotateCcw/><T> Restaurar este bloco</T></button>
 </aside>
}
