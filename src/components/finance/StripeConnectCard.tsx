import {useCallback,useEffect,useState} from 'react'
import {useNavigate,useParams} from 'react-router-dom'
import {AlertCircle,ArrowRight,Check,Clock3,Landmark,LoaderCircle,RefreshCw,ShieldCheck} from 'lucide-react'
import {Button,Card} from '../ui'
import {stripeConnectService,type StripeConnectStatus} from '../../services/stripeConnectService'

const initial:StripeConnectStatus={connected:false,detailsSubmitted:false,chargesEnabled:false,payoutsEnabled:false,onboardingStatus:'not_connected',requirements:{currentlyDue:[],eventuallyDue:[]}}
const content={
 not_connected:{title:'Configure seus recebimentos',text:'Ative sua conta de pagamentos para começar a receber suas vendas pelo Sphex Pay.',action:'Ativar pagamentos',Icon:Landmark},
 pending:{title:'Configuração pendente',text:'Precisamos de mais algumas informações para habilitar seus recebimentos.',action:'Continuar configuração',Icon:Clock3},
 in_review:{title:'Conta em análise',text:'A Stripe está analisando as informações enviadas. Você pode acompanhar o status por aqui.',action:'Revisar informações',Icon:ShieldCheck},
 requirements_due:{title:'Informações necessárias',text:'Existem informações adicionais necessárias para habilitar seus recebimentos.',action:'Atualizar informações',Icon:AlertCircle},
 enabled:{title:'Conta de pagamentos ativa',text:'Sua configuração de recebimentos está ativa e pronta para as próximas etapas da integração.',action:'Atualizar informações',Icon:Check}
} as const

export function StripeConnectCard(){
 const [status,setStatus]=useState<StripeConnectStatus>(initial),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=useCallback(async()=>{setLoading(true);setError('');try{setStatus(await stripeConnectService.status())}catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar sua conta de pagamentos.')}finally{setLoading(false)}},[])
 useEffect(()=>{void load()},[load])
 const start=async()=>{if(busy)return;setBusy(true);setError('');try{if(!status.connected)await stripeConnectService.createAccount();const {url}=await stripeConnectService.onboarding();window.location.assign(url)}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a configuração.');setBusy(false)}}
 if(loading)return <Card className="stripe-connect-card stripe-connect-loading" role="status"><LoaderCircle className="spin"/><span>Consultando configuração de recebimentos...</span></Card>
 const state=content[status.onboardingStatus],Icon=state.Icon
 return <Card className={`stripe-connect-card is-${status.onboardingStatus}`}><div className="stripe-connect-icon"><Icon/></div><div className="stripe-connect-copy"><span>STRIPE CONNECT · MODO TESTE</span><h2>{state.title}</h2><p>{state.text}</p>{status.connected&&<dl><div><dt>Pagamentos</dt><dd>{status.chargesEnabled?<><Check/> Ativos</>:status.detailsSubmitted?'Em análise':'Pendentes'}</dd></div><div><dt>Repasses</dt><dd>{status.payoutsEnabled?<><Check/> Ativos</>:status.detailsSubmitted?'Em análise':'Pendentes'}</dd></div></dl>}{error&&<p className="stripe-connect-error" role="alert">{error}</p>}</div><div className="stripe-connect-actions"><Button variant="primary" disabled={busy} onClick={()=>void start()}>{busy?<LoaderCircle className="spin"/>:<RefreshCw/>}{state.action}<ArrowRight/></Button><small>Você será direcionado ao ambiente seguro da Stripe.</small></div></Card>
}

export function StripeConnectRedirect(){
 const {mode}=useParams(),navigate=useNavigate(),[message,setMessage]=useState(mode==='refresh'?'Gerando um novo acesso seguro...':'Atualizando o status da sua conta...'),[error,setError]=useState('')
 useEffect(()=>{let active=true
  const run=async()=>{try{if(mode==='refresh'){
    const key='sphex-stripe-refresh-attempts',now=Date.now(),stored=JSON.parse(sessionStorage.getItem(key)||'[]') as number[],recent=stored.filter(value=>now-value<120000)
    if(recent.length>=3)throw new Error('Não foi possível renovar o acesso automaticamente. Volte ao Financeiro e tente novamente.')
    sessionStorage.setItem(key,JSON.stringify([...recent,now]));const {url}=await stripeConnectService.onboarding();window.location.replace(url);return
   }
   sessionStorage.removeItem('sphex-stripe-refresh-attempts');await stripeConnectService.status();if(active){setMessage('Status atualizado. Redirecionando...');navigate('/app/financeiro',{replace:true})}
  }catch(e){if(active)setError(e instanceof Error?e.message:'Não foi possível concluir o retorno da Stripe.')}}
  void run();return()=>{active=false}
 },[mode,navigate])
 return <section className="stripe-connect-return"><Card>{error?<><AlertCircle/><h2>Não foi possível continuar</h2><p role="alert">{error}</p><Button onClick={()=>navigate('/app/financeiro',{replace:true})}>Voltar ao Financeiro</Button></>:<><LoaderCircle className="spin"/><h2>{message}</h2><p>Aguarde enquanto confirmamos sua configuração com segurança.</p></>}</Card></section>
}
