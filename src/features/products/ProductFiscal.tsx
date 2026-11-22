import {useCallback,useEffect,useState} from 'react'
import {Info,LoaderCircle,Save} from 'lucide-react'
import {T,translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {Button,Card,Input,Loading,Select,Textarea} from '../../components/ui'
import {useCatalogUser} from '../../hooks/useActiveSeller'
import {DEFAULT_FISCAL_PROFILE,ITEM_KINDS,taxService,type FiscalProfile,type ItemKind} from '../finance/taxService'
import type {Product} from './types'

// Tipo do item e código fiscal (NCM para mercadoria, NBS para serviço e digital). Ficam guardados
// para a nota fiscal e para o recolhimento de IBS/CBS na liquidação, quando ele for liberado.
const kindFromProduct=(product:Product):ItemKind=>product.billingType==='subscription'?'subscription':product.productType==='physical'?'physical':product.productType==='service'?'service':'digital'

export function ProductFiscalPage({product}:{product:Product}){useAppLocale(state=>state.locale)
 const {user}=useCatalogUser()
 const [saved,setSaved]=useState<FiscalProfile|null>(null),[form,setForm]=useState<FiscalProfile>(DEFAULT_FISCAL_PROFILE)
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 const load=useCallback(async()=>{
  setLoading(true)
  try{const profile=await taxService.getFiscalProfile(product.id);setSaved(profile);setForm(profile??{...DEFAULT_FISCAL_PROFILE,itemKind:kindFromProduct(product)});setMessage('')}
  catch{setMessage('Não foi possível carregar os dados fiscais.')}
  finally{setLoading(false)}
 },[product])
 useEffect(()=>{void load()},[load])
 const code=form.fiscalCode.trim(),codeValid=!code||/^[0-9.]{1,20}$/.test(code)
 const dirty=!saved||saved.itemKind!==form.itemKind||saved.fiscalCode!==code||saved.notes!==form.notes.trim()
 const save=async()=>{
  if(!user||!codeValid)return
  setSaving(true);setMessage('')
  try{const next={itemKind:form.itemKind,fiscalCode:code,notes:form.notes.trim()};await taxService.saveFiscalProfile(user.id,product.id,next);setSaved(next);setForm(next);setMessage('Salvo. Dados fiscais atualizados.')}
  catch{setMessage('Não foi possível salvar. Suas alterações continuam nesta tela.')}
  finally{setSaving(false)}
 }
 const codeLabel=ITEM_KINDS.find(item=>item.value===form.itemKind)?.code||'NBS'
 if(loading)return <Loading label="Carregando dados fiscais"/>
 return <div>
  <div className="pv2-section-head"><div><h2><T>Dados fiscais</T></h2><p><T>Como este produto é classificado para impostos. Usado na nota fiscal e, a partir da Reforma Tributária, no recolhimento automático de IBS e CBS.</T></p></div>
   <Button variant="primary" disabled={!dirty||saving||!codeValid} onClick={()=>void save()}>{saving?<LoaderCircle className="spin"/>:<Save/>}<T>{saving?' Salvando...':dirty?' Salvar':' Salvo'}</T></Button></div>
  {message&&<div className={`pv2-notice ${message.startsWith('Salvo')?'success':''}`} role="status"><T>{message}</T></div>}
  <Card className="p-5"><div className="pv2-form-grid">
   <label><span><T>Tipo do item</T></span><Select aria-label={uiText('Tipo do item')} value={form.itemKind} onChange={e=>setForm(x=>({...x,itemKind:e.target.value as ItemKind}))}>{ITEM_KINDS.map(item=><option value={item.value} key={item.value}>{uiText(item.label)}</option>)}</Select></label>
   <label><span><T>{`Código fiscal (${codeLabel})`}</T></span><Input aria-label={uiText('Código fiscal')} inputMode="numeric" placeholder={codeLabel==='NCM'?'Ex.: 6109.10.00':'Ex.: 1.1502.10.00'} value={form.fiscalCode} onChange={e=>setForm(x=>({...x,fiscalCode:e.target.value}))}/>{!codeValid&&<small className="text-red-500" role="alert"><T>Use só números e pontos.</T></small>}</label>
   <label className="wide"><span><T>Observações para o contador</T></span><Textarea rows={3} maxLength={500} value={form.notes} onChange={e=>setForm(x=>({...x,notes:e.target.value}))}/></label>
  </div></Card>
  <Card className="p-5 mt-4"><div className="flex gap-3"><Info size={18} className="orange shrink-0 mt-0.5"/><p className="text-sm"><T>{codeLabel==='NCM'?'NCM é o código de mercadorias que aparece na nota fiscal do produto físico.':'NBS é a classificação de serviços e intangíveis, usada também para produtos digitais e assinaturas.'}</T><T> Se não souber o código, peça ao seu contador. Preencher é opcional e não muda nada nas suas vendas hoje.</T></p></div></Card>
 </div>
}
