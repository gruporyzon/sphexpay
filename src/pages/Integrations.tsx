import {translate as uiText} from '../i18n'
import {useAppLocale} from '../i18n/localeStore'
import {T} from '../i18n'
import { Check,ChevronRight,Code2,Copy,KeyRound,Link2,Pause,Play,Plus,RefreshCw,RotateCcw,Send,Settings2,ShieldCheck,Trash2,Webhook,Workflow } from 'lucide-react'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { Badge,Card,Loading,PageTitle,StateMessage } from '../components/ui'
import { shortDate } from '../lib/utils'
import { WEBHOOK_EVENTS,sellerWebhookService,type SellerWebhook,type WebhookDelivery,type WebhookEvent,type WebhookInput } from '../services/sellerWebhookService'

// Integrações reais: webhooks de saída assinados com HMAC, histórico de entregas e
// documentação para validar a assinatura. Ferramentas de automação (Zapier, Make, n8n,
// Pipedream) se conectam pelo mesmo webhook — não há conexão direta simulada.
type Tab='Webhooks'|'Entregas'|'Apps'|'Documentação'
const EVENT_LABEL:Record<string,string>={...Object.fromEntries(WEBHOOK_EVENTS.map(item=>[item.value,item.label])),'webhook.test':'Teste'}
const DELIVERY:Record<WebhookDelivery['status'],{label:string;tone:'ok'|'warn'|'bad'|'info'}>={succeeded:{label:'Entregue',tone:'ok'},pending:{label:'Aguardando nova tentativa',tone:'warn'},sending:{label:'Enviando',tone:'info'},failed:{label:'Falhou',tone:'bad'}}
const AUTOMATION_APPS=[
 {name:'Zapier',mark:'Z',text:'Use o gatilho "Webhooks by Zapier · Catch Hook" e cole a URL gerada pelo Zapier aqui.'},
 {name:'Make',mark:'M',text:'Crie um cenário com o módulo "Webhooks · Custom webhook" e cadastre o endereço gerado.'},
 {name:'n8n',mark:'n',text:'Adicione um nó "Webhook" (método POST) e use a URL de produção do fluxo.'},
 {name:'Pipedream',mark:'P',text:'Crie um workflow com gatilho "HTTP / Webhook" e cadastre a URL do endpoint.'}
]
const EXAMPLE_PAYLOAD=`{
  "id": "evt_3f1c...",
  "type": "sale.approved",
  "created_at": "2026-10-21T13:05:12.481Z",
  "livemode": true,
  "data": {
    "transaction_id": "stripe:acct_...:pi_...",
    "status": "approved",
    "amount_cents": 49700,
    "currency": "BRL",
    "product_id": "4b0f...",
    "product_name": "Mentoria",
    "customer_name": "Ana L.",
    "payment_method": "card",
    "occurred_at": "2026-10-21T13:05:10Z"
  }
}`
const VERIFY_SNIPPET=`import crypto from 'node:crypto'

// rawBody: o corpo exatamente como chegou (texto, sem reformatar)
function assinaturaValida(rawBody, headers, segredo) {
  const ts = headers['x-sphexpay-timestamp']
  const recebida = String(headers['x-sphexpay-signature'] || '').replace('v1=', '')
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const esperada = crypto.createHmac('sha256', segredo).update(ts + '.' + rawBody).digest('hex')
  return recebida.length === esperada.length &&
    crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada))
}`

export default function Integrations(){useAppLocale(state=>state.locale)
 const [tab,setTab]=useState<Tab>('Webhooks'),[webhooks,setWebhooks]=useState<SellerWebhook[]|null>(null),[deliveries,setDeliveries]=useState<WebhookDelivery[]>([]),[error,setError]=useState('')
 const [form,setForm]=useState<{id?:string;initial:WebhookInput&{active:boolean}}|null>(null),[newSecret,setNewSecret]=useState<{name:string;secret:string}|null>(null),[copied,setCopied]=useState('')
 const load=useCallback(()=>{setError('');Promise.all([sellerWebhookService.list(),sellerWebhookService.deliveries()]).then(([hooks,items])=>{setWebhooks(hooks);setDeliveries(items)}).catch(reason=>{setWebhooks(current=>current??[]);setError(reason instanceof Error?reason.message:'Não foi possível carregar as integrações.')})},[])
 useEffect(()=>{load()},[load])
 const copy=async(value:string,key:string)=>{try{await navigator.clipboard.writeText(value);setCopied(key);window.setTimeout(()=>setCopied(current=>current===key?'':current),1800)}catch{setError('Não foi possível copiar. Selecione e copie manualmente.')}}
 const openCreate=(name='')=>{setTab('Webhooks');setNewSecret(null);setForm({initial:{name,url:'',events:['sale.approved'],active:true}})}
 const active=webhooks?.filter(item=>item.active).length??0,succeeded=deliveries.filter(item=>item.status==='succeeded').length,failed=deliveries.filter(item=>item.status==='failed').length
 return <div className="page-enter integrations-page"><PageTitle title={uiText("Integrações")} subtitle={uiText("Envie as vendas da SphexPay para os seus sistemas assim que acontecem.")} action={<button className="btn btn-primary" onClick={()=>openCreate()}><Plus size={16}/><T> Criar webhook</T></button>}/>
  {error&&<div className="mb-4"><StateMessage title={uiText('Integrações indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage></div>}
  <div className="integrations-overview"><Card><span><T>Webhooks ativos</T></span><strong>{active}</strong><small><Webhook size={12}/><T> de </T>{webhooks?.length??0}<T> cadastrados</T></small></Card><Card><span><T>Entregas com sucesso</T></span><strong>{succeeded}</strong><small><Check size={12}/><T> Últimas 50 entregas</T></small></Card><Card><span><T>Entregas com falha</T></span><strong>{failed}</strong><small><RefreshCw size={12}/><T> Após 7 tentativas</T></small></Card><Card><span><T>Assinatura das entregas</T></span><strong><T>Ativa</T></strong><small><ShieldCheck size={12}/><T> HMAC-SHA256 por webhook</T></small></Card></div>
  <div className="integration-tabs" role="tablist">{(['Webhooks','Entregas','Apps','Documentação'] as Tab[]).map(item=><button role="tab" aria-selected={tab===item} className={tab===item?'active':''} onClick={()=>setTab(item)} key={item}>{item==='Webhooks'?<Webhook size={15}/>:item==='Entregas'?<Send size={15}/>:item==='Apps'?<Workflow size={15}/>:<Code2 size={15}/>} <T>{item}</T><ChevronRight size={13}/></button>)}</div>
  {webhooks===null?<Loading label="Carregando integrações"/>:<>
   {tab==='Webhooks'&&<WebhooksPanel webhooks={webhooks} form={form} setForm={setForm} newSecret={newSecret} setNewSecret={setNewSecret} openCreate={openCreate} reload={load} copy={copy} copied={copied} setError={setError}/>}
   {tab==='Entregas'&&<DeliveriesPanel deliveries={deliveries} webhooks={webhooks} reload={load}/>}
   {tab==='Apps'&&<AppsPanel connect={name=>openCreate(name)}/>}
   {tab==='Documentação'&&<DocsPanel copy={copy} copied={copied}/>}
  </>}
 </div>
}

function WebhooksPanel({webhooks,form,setForm,newSecret,setNewSecret,openCreate,reload,copy,copied,setError}:{webhooks:SellerWebhook[];form:{id?:string;initial:WebhookInput&{active:boolean}}|null;setForm:(value:{id?:string;initial:WebhookInput&{active:boolean}}|null)=>void;newSecret:{name:string;secret:string}|null;setNewSecret:(value:{name:string;secret:string}|null)=>void;openCreate:()=>void;reload:()=>void;copy:(value:string,key:string)=>void;copied:string;setError:(value:string)=>void}){useAppLocale(state=>state.locale)
 const [busy,setBusy]=useState(''),[secrets,setSecrets]=useState<Record<string,string>>({}),[confirmRemove,setConfirmRemove]=useState(''),[notice,setNotice]=useState('')
 const run=async(key:string,action:()=>Promise<void>)=>{setBusy(key);setError('');setNotice('');try{await action()}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir a ação.')}finally{setBusy('')}}
 const save=(input:WebhookInput&{active:boolean})=>run('form',async()=>{
  if(form?.id){await sellerWebhookService.update(form.id,input);setNotice('Webhook atualizado.')}
  else{const created=await sellerWebhookService.create(input);setNewSecret({name:input.name,secret:created.secret})}
  setForm(null);reload()
 })
 return <section className="integration-panel"><div className="integration-section-head"><div><span className="section-eyebrow"><Webhook size={13}/><T> EVENTOS</T></span><h2><T>Webhooks</T></h2><p><T>Cada venda aprovada, reembolsada ou contestada é enviada por POST para os endereços cadastrados.</T></p></div><button className="btn btn-primary" onClick={openCreate}><Plus size={15}/><T> Criar webhook</T></button></div>
  {notice&&<p className="muted text-sm mb-3" role="status">{notice}</p>}
  {newSecret&&<Card className="webhook-form" role="status"><b><T>Webhook criado: </T>{newSecret.name}</b><p className="muted text-sm mt-1"><T>Guarde este segredo no seu sistema para validar a assinatura de cada entrega. Você pode consultá-lo de novo ou gerar outro quando quiser.</T></p><label className="api-key-field mt-3"><span className="label"><T>Segredo de assinatura</T></span><div><KeyRound size={15}/><input readOnly value={newSecret.secret} aria-label={uiText('Segredo de assinatura')}/><button aria-label={uiText('Copiar segredo')} onClick={()=>copy(newSecret.secret,'new-secret')}>{copied==='new-secret'?<Check size={14}/>:<Copy size={14}/>}</button></div></label><div className="integration-form-actions"><button className="btn" onClick={()=>setNewSecret(null)}><T>Concluir</T></button></div></Card>}
  {form&&<WebhookForm key={form.id||'new'} initial={form.initial} editing={Boolean(form.id)} saving={busy==='form'} cancel={()=>setForm(null)} save={save}/>}
  {webhooks.length?<div className="webhook-list">{webhooks.map(item=><article key={item.id}><div className="webhook-icon"><Webhook size={18}/></div><div className="webhook-main"><div><h3>{item.name}</h3><span>{item.url}</span></div><div className="webhook-events">{item.events.map(event=><em key={event}><T>{EVENT_LABEL[event]}</T></em>)}</div>
   {secrets[item.id]&&<label className="api-key-field mt-2"><span className="label"><T>Segredo de assinatura</T></span><div><KeyRound size={15}/><input readOnly value={secrets[item.id]} aria-label={`${uiText('Segredo de')} ${item.name}`}/><button aria-label={`${uiText('Copiar segredo de')} ${item.name}`} onClick={()=>copy(secrets[item.id],`secret-${item.id}`)}>{copied===`secret-${item.id}`?<Check size={14}/>:<Copy size={14}/>}</button></div></label>}
   {confirmRemove===item.id&&<div className="integration-form-actions"><span className="muted text-sm"><T>Remover este webhook e o histórico de entregas?</T></span><button className="btn" onClick={()=>setConfirmRemove('')}><T>Cancelar</T></button><button className="btn btn-primary" disabled={busy===`remove-${item.id}`} onClick={()=>run(`remove-${item.id}`,async()=>{await sellerWebhookService.remove(item.id);setConfirmRemove('');reload()})}><T>Remover</T></button></div>}
  </div><div className="webhook-last"><Badge tone={item.active?'ok':'warn'}><T>{item.active?'Ativo':'Pausado'}</T></Badge><small><T>Criado em </T>{shortDate(item.createdAt)}</small></div>
   <div className="webhook-actions">
    <button aria-label={`${uiText('Enviar teste para')} ${item.name}`} title={uiText('Enviar teste')} disabled={busy===`test-${item.id}`} onClick={()=>run(`test-${item.id}`,async()=>{await sellerWebhookService.test(item.id);setNotice('Teste enviado. Confira o resultado na aba Entregas em alguns segundos.');reload()})}><Send size={15}/></button>
    <button aria-label={`${uiText(secrets[item.id]?'Gerar novo segredo para':'Ver segredo de')} ${item.name}`} title={uiText(secrets[item.id]?'Gerar novo segredo':'Ver segredo')} onClick={()=>run(`secret-${item.id}`,async()=>{const rotate=Boolean(secrets[item.id]);if(rotate&&!window.confirm(uiText('Gerar um novo segredo? O anterior deixa de valer imediatamente.')))return;const value=await sellerWebhookService.secret(item.id,rotate);setSecrets(current=>({...current,[item.id]:value}));if(rotate)setNotice('Novo segredo gerado. Atualize-o no seu sistema.')})}>{secrets[item.id]?<RefreshCw size={15}/>:<KeyRound size={15}/>}</button>
    <button aria-label={`${uiText(item.active?'Pausar':'Ativar')} ${item.name}`} title={uiText(item.active?'Pausar':'Ativar')} onClick={()=>run(`toggle-${item.id}`,async()=>{await sellerWebhookService.update(item.id,{name:item.name,url:item.url,events:item.events,active:!item.active});reload()})}>{item.active?<Pause size={15}/>:<Play size={15}/>}</button>
    <button aria-label={`${uiText('Editar')} ${item.name}`} title={uiText('Editar')} onClick={()=>{setNewSecret(null);setForm({id:item.id,initial:{name:item.name,url:item.url,events:item.events,active:item.active}})}}><Settings2 size={15}/></button>
    <button aria-label={`${uiText('Remover')} ${item.name}`} title={uiText('Remover')} onClick={()=>setConfirmRemove(item.id)}><Trash2 size={15}/></button>
   </div></article>)}</div>:!form&&<div className="integration-empty"><Webhook/><p><T>Nenhum webhook configurado. Crie um para receber suas vendas no seu sistema, planilha ou automação.</T></p></div>}
 </section>
}

function WebhookForm({initial,editing,saving,cancel,save}:{initial:WebhookInput&{active:boolean};editing:boolean;saving:boolean;cancel:()=>void;save:(input:WebhookInput&{active:boolean})=>void}){useAppLocale(state=>state.locale)
 const [name,setName]=useState(initial.name),[url,setUrl]=useState(initial.url),[events,setEvents]=useState<WebhookEvent[]>(initial.events),[localError,setLocalError]=useState('')
 const submit=()=>{
  if(!name.trim())return setLocalError('Dê um nome ao webhook.')
  if(!/^https:\/\/\S+$/.test(url.trim()))return setLocalError('Informe um endereço que comece com https://')
  if(!events.length)return setLocalError('Escolha pelo menos um evento.')
  setLocalError('');save({name:name.trim(),url:url.trim(),events,active:initial.active})
 }
 return <Card className="webhook-form"><div className="integration-form-grid"><label><span className="label"><T>Nome</T></span><input className="input" maxLength={60} value={name} onChange={event=>setName(event.target.value)} placeholder={uiText("Ex.: Planilha de vendas")}/></label><label><span className="label"><T>URL do endpoint</T></span><input className="input" type="url" inputMode="url" maxLength={500} value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://"/></label></div>
  <fieldset className="webhook-event-picker"><legend className="label"><T>Eventos enviados</T></legend>{WEBHOOK_EVENTS.map(item=><label key={item.value}><input type="checkbox" checked={events.includes(item.value)} onChange={event=>setEvents(current=>event.target.checked?[...new Set([...current,item.value])]:current.filter(value=>value!==item.value))}/><T>{item.label}</T> <code>{item.value}</code></label>)}</fieldset>
  {localError&&<p className="withdrawal-error" role="alert">{localError}</p>}
  <div className="integration-form-actions"><button className="btn" onClick={cancel}><T>Cancelar</T></button><button className="btn btn-primary" disabled={saving} onClick={submit}><T>{saving?'Salvando...':editing?'Salvar alterações':'Criar webhook'}</T></button></div></Card>
}

function DeliveriesPanel({deliveries,webhooks,reload}:{deliveries:WebhookDelivery[];webhooks:SellerWebhook[];reload:()=>void}){useAppLocale(state=>state.locale)
 const names=useMemo(()=>new Map(webhooks.map(item=>[item.id,item.name])),[webhooks])
 return <section className="integration-panel"><div className="integration-section-head"><div><span className="section-eyebrow"><Send size={13}/><T> HISTÓRICO</T></span><h2><T>Entregas</T></h2><p><T>Últimas 50 entregas. Falhas são reenviadas com espera crescente (2, 4, 8, 16, 32 e 64 minutos).</T></p></div><button className="btn" onClick={reload}><RefreshCw size={15}/><T> Atualizar</T></button></div>
  {deliveries.length?<Card><div className="table-wrap"><table className="table"><thead><tr><th><T>Data</T></th><th><T>Webhook</T></th><th><T>Evento</T></th><th><T>Status</T></th><th><T>Tentativas</T></th><th><T>Resposta</T></th></tr></thead><tbody>{deliveries.map(item=><tr key={item.id}><td>{shortDate(item.createdAt)}</td><td>{names.get(item.webhookId)||'—'}</td><td><T>{EVENT_LABEL[item.eventType]||item.eventType}</T></td><td><Badge tone={DELIVERY[item.status].tone}><T>{DELIVERY[item.status].label}</T></Badge>{item.status==='pending'&&item.attempts>0&&<small className="muted block"><T>Nova tentativa </T>{shortDate(item.nextAttemptAt)}</small>}</td><td>{item.attempts}</td><td>{item.responseStatus?`HTTP ${item.responseStatus}`:''}{item.lastError&&<small className="muted block">{item.lastError}</small>}</td></tr>)}</tbody></table></div></Card>:<div className="integration-empty"><Send/><p><T>Nenhuma entrega ainda. Use "Enviar teste" em um webhook para conferir a integração.</T></p></div>}
 </section>
}

function AppsPanel({connect}:{connect:(name:string)=>void}){useAppLocale(state=>state.locale)
 return <section className="integration-panel"><div className="integration-section-head"><div><span className="section-eyebrow"><Link2 size={13}/><T> AUTOMAÇÕES</T></span><h2><T>Conecte por webhook</T></h2><p><T>Estas ferramentas recebem webhooks. Gere a URL nelas e cadastre aqui para levar suas vendas a planilhas, CRMs e mensagens.</T></p></div></div>
  <div className="integration-app-grid">{AUTOMATION_APPS.map(app=><article className="integration-app-card" key={app.name}><div className="integration-app-top"><i>{app.mark}</i><Badge tone="info"><T>Via webhook</T></Badge></div><h3>{app.name}</h3><p><T>{app.text}</T></p><button className="btn btn-primary" onClick={()=>connect(app.name)}><Plus size={14}/><T> Cadastrar URL</T></button></article>)}</div>
 </section>
}

function DocsPanel({copy,copied}:{copy:(value:string,key:string)=>void;copied:string}){useAppLocale(state=>state.locale)
 return <section className="integration-panel"><div className="integration-section-head"><div><span className="section-eyebrow"><Code2 size={13}/><T> DESENVOLVEDORES</T></span><h2><T>Como receber os eventos</T></h2><p><T>Cada entrega é um POST com JSON. Responda com status 2xx em até 5 segundos para confirmar o recebimento.</T></p></div></div>
  <div className="api-doc-grid"><Card><div className="api-doc-head"><ShieldCheck size={17}/><div><h3><T>Cabeçalhos</T></h3><p><T>Valide a assinatura antes de processar o evento.</T></p></div></div><ul className="text-sm grid gap-2 mt-2"><li><code>X-SphexPay-Event</code> <T>— tipo do evento</T></li><li><code>X-SphexPay-Delivery</code> <T>— identificador da entrega (use para evitar duplicidade)</T></li><li><code>X-SphexPay-Timestamp</code> <T>— horário do envio, em segundos</T></li><li><code>X-SphexPay-Signature</code> <T>— </T><code>v1=</code><T> + HMAC-SHA256 de </T><code>timestamp.corpo</code><T> com o segredo do webhook</T></li></ul><p className="muted text-xs mt-3"><T>Eventos: </T><code>sale.approved</code>, <code>sale.refunded</code>, <code>sale.chargeback</code><T> e </T><code>webhook.test</code><T>. O mesmo evento pode chegar mais de uma vez; use o campo </T><code>id</code><T> para ignorar repetições.</T></p></Card>
   <Card><div className="api-doc-head"><Code2 size={17}/><div><h3><T>Exemplo de evento</T></h3><p><T>Venda aprovada.</T></p></div></div><pre>{EXAMPLE_PAYLOAD}</pre><button className="btn" onClick={()=>copy(EXAMPLE_PAYLOAD,'payload')}>{copied==='payload'?<Check size={14}/>:<Copy size={14}/>}<T> Copiar exemplo</T></button></Card>
   <Card><div className="api-doc-head"><KeyRound size={17}/><div><h3><T>Validar a assinatura (Node.js)</T></h3><p><T>Rejeite entregas com assinatura inválida ou horário com mais de 5 minutos de diferença.</T></p></div></div><pre>{VERIFY_SNIPPET}</pre><button className="btn" onClick={()=>copy(VERIFY_SNIPPET,'verify')}>{copied==='verify'?<Check size={14}/>:<Copy size={14}/>}<T> Copiar código</T></button></Card></div>
 </section>
}
