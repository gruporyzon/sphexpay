import { useEffect,useState,type FormEvent } from 'react'
import { Check,Copy,Link2,Plus,Trash2 } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Modal,StateMessage } from '../../components/ui'
import { affiliateService } from './affiliateService'
import { affiliateLink } from './affiliateLink'
import type { Affiliate,AffiliateProductOption,AffiliateStatus,CommissionType } from './types'

const STATUS:Record<AffiliateStatus,string>={active:'Ativo',pending:'Pendente',suspended:'Suspenso',inactive:'Inativo'}
const reais=(value:string)=>{const text=value.trim(),clean=!text.includes(',')&&/\.\d{1,2}$/.test(text)?text.replace(/[^\d.]/g,''):text.replace(/[^\d,]/g,'').replace(',','.');const number=Number(clean);return Number.isFinite(number)?number:NaN}

// Cadastro do afiliado e dos produtos que ele divulga, com a comissão de cada um.
// A venda só é atribuída quando o afiliado está Ativo e o produto está vinculado aqui.
export function AffiliateEditor({affiliate,onClose,onSaved}:{affiliate:Affiliate|null;onClose:()=>void;onSaved:()=>void}){useAppLocale(state=>state.locale)
 const [form,setForm]=useState({name:affiliate?.name||'',email:affiliate?.email||'',status:affiliate?.status||'active' as AffiliateStatus})
 const [current,setCurrent]=useState<{id:string;publicId:string}|null>(affiliate?{id:affiliate.id,publicId:affiliate.publicId}:null),[links,setLinks]=useState(affiliate?.products||[])
 const [products,setProducts]=useState<AffiliateProductOption[]>([]),[link,setLink]=useState({productId:'',type:'percentage' as CommissionType,value:''})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[copied,setCopied]=useState('')
 useEffect(()=>{affiliateService.products().then(setProducts).catch(()=>setProducts([]))},[])
 const save=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setError('');setSaved(false)
  try{const result=await affiliateService.save(form,current?.id);setCurrent(result);setSaved(true);onSaved()}
  catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar o afiliado.')}
  finally{setBusy(false)}
 }
 const product=products.find(item=>item.id===link.productId),amount=reais(link.value)
 const linkValid=Boolean(current&&product&&Number.isFinite(amount)&&amount>=0&&(link.type==='fixed'||amount<=100))
 const addLink=async()=>{
  if(!current||!product||!linkValid)return
  setBusy(true);setError('')
  try{
   const value=link.type==='fixed'?Math.round(amount*100):Math.round(amount*100)/100
   const id=await affiliateService.saveProduct(current.id,{productId:product.id,commissionType:link.type,commissionValue:value,currency:product.currency||'BRL'})
   setLinks(list=>[...list.filter(item=>item.productId!==product.id),{id,productId:product.id,productName:product.name,commissionType:link.type,commissionValue:value,currency:product.currency||'BRL'}])
   setLink({productId:'',type:link.type,value:''});onSaved()
  }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível vincular o produto.')}
  finally{setBusy(false)}
 }
 const removeLink=async(id:string)=>{
  setBusy(true);setError('')
  try{await affiliateService.removeProduct(id);setLinks(list=>list.filter(item=>item.id!==id));onSaved()}
  catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível remover o produto.')}
  finally{setBusy(false)}
 }
 const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setCopied(value)}catch{setCopied('')}}
 const format=(type:CommissionType,value:number,currency:string)=>type==='percentage'?`${value.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`:new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format(value/100)
 return <Modal title={uiText(affiliate?'Editar afiliado':'Novo afiliado')} onClose={onClose}>
  <form className="grid gap-3" onSubmit={event=>void save(event)}>
   <div className="grid sm:grid-cols-2 gap-3"><label><span className="label"><T>Nome</T></span><input className="input" required minLength={2} maxLength={160} value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label>
    <label><span className="label"><T>E-mail</T></span><input className="input" type="email" maxLength={254} value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label></div>
   <label><span className="label"><T>Status</T></span><select className="input" value={form.status} onChange={event=>setForm({...form,status:event.target.value as AffiliateStatus})}>{(Object.keys(STATUS) as AffiliateStatus[]).map(status=><option key={status} value={status}>{uiText(STATUS[status])}</option>)}</select></label>
   <p className="muted text-xs"><T>Só afiliados ativos recebem comissão. O e-mail do afiliado não ganha comissão comprando pelo próprio link.</T></p>
   <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}><T>Fechar</T></button><button className="btn btn-primary" disabled={busy||form.name.trim().length<2}><T>{current?'Salvar dados':'Cadastrar afiliado'}</T></button></div>
   {saved&&<p className="muted text-sm" role="status"><T>Afiliado salvo.</T></p>}
  </form>
  {current&&<section className="grid gap-3 mt-5 pt-4 border-t border-[var(--line)]"><b><T>Produtos e comissão</T></b>
   {links.length?<div className="grid gap-2">{links.map(item=>{const url=affiliateLink(item.productId,current.publicId);return <div key={item.id} className="grid gap-1 p-3 rounded-[var(--radius-md)] border border-[var(--line)]">
    <div className="flex items-center justify-between gap-2"><span><b>{item.productName}</b> · {format(item.commissionType,item.commissionValue,item.currency)}</span><button type="button" className="btn icon-btn" disabled={busy} aria-label={`${uiText('Remover produto')} ${item.productName}`} onClick={()=>void removeLink(item.id)}><Trash2/></button></div>
    <div className="flex items-center gap-2 text-xs"><Link2 size={14}/><code className="truncate flex-1">{url}</code><button type="button" className="btn icon-btn" aria-label={`${uiText('Copiar link de')} ${item.productName}`} onClick={()=>void copy(url)}>{copied===url?<Check/>:<Copy/>}</button></div></div>})}</div>:<p className="muted text-sm"><T>Vincule um produto para gerar o link de divulgação.</T></p>}
   <div className="grid sm:grid-cols-[1fr_130px_110px_auto] gap-2 items-end">
    <label><span className="label"><T>Produto</T></span><select className="input" value={link.productId} onChange={event=>setLink({...link,productId:event.target.value})}><option value="">{uiText('Escolha')}</option>{products.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label"><T>Tipo</T></span><select className="input" value={link.type} onChange={event=>setLink({...link,type:event.target.value as CommissionType})}><option value="percentage">{uiText('Percentual')}</option><option value="fixed">{uiText('Valor fixo')}</option></select></label>
    <label><span className="label"><T>{link.type==='percentage'?'Comissão (%)':'Comissão (valor)'}</T></span><input className="input" inputMode="decimal" value={link.value} onChange={event=>setLink({...link,value:event.target.value})} placeholder={link.type==='percentage'?'30':'50,00'}/></label>
    <button type="button" className="btn" disabled={busy||!linkValid} onClick={()=>void addLink()}><Plus size={15}/><T> Vincular</T></button></div>
  </section>}
  {error&&<div className="mt-3"><StateMessage title={uiText('Atenção')}><span>{error}</span></StateMessage></div>}
 </Modal>
}
