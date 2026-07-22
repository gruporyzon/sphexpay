import { useEffect, useRef, useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { Modal } from '../ui'
import { money } from '../../lib/utils'

type Props = { label:string; value:number; onSave:(value:number)=>void; currency?:boolean; admin?:boolean }

export function EditableValue({label,value,onSave,currency=false,admin=true}:Props){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(String(value)),[saved,setSaved]=useState(false)
 const timer=useRef<number|undefined>(undefined)
 useEffect(()=>()=>{if(timer.current)window.clearTimeout(timer.current)},[])
 if(!admin)return null
 const parsed=Number(draft),invalid=!draft||!Number.isFinite(parsed)||parsed<0||(!currency&&!Number.isInteger(parsed))
 const save=()=>{if(invalid)return;onSave(parsed);setOpen(false);setSaved(true);if(timer.current)window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setSaved(false),1400)}
 return <>
  <span className="editable-trigger-wrap"><button title="Editar" aria-label={`Editar ${label}`} className="editable-trigger" onClick={()=>{setDraft(String(value));setOpen(true)}}><Pencil size={12}/></button>{saved&&<span className="editable-confirm"><Check size={11}/></span>}</span>
  {open&&<Modal title={`Editar ${label}`} onClose={()=>setOpen(false)}>
   <label><span className="label">{label}</span><input autoFocus type="number" min="0" step={currency?'0.01':'1'} inputMode="decimal" className="input" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')save()}} aria-invalid={invalid}/></label>
   {invalid&&<p className="text-red-500 text-xs mt-2">Informe um valor válido e não negativo.</p>}
   {currency&&<p className="muted text-xs mt-2">Valor atual: {money(value)}</p>}
   <div className="flex justify-end gap-2 mt-6"><button className="btn" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={invalid}>Salvar</button></div>
  </Modal>}
 </>
}
