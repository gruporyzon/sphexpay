import { useCallback,useEffect,useState } from 'react'
import { BadgePercent,CalendarClock,CreditCard,ExternalLink,FileText,QrCode,RotateCcw } from 'lucide-react'
import { T,translate as uiText } from '../../i18n'
import { useAppLocale } from '../../i18n/localeStore'
import { Card,Loading,StateMessage } from '../../components/ui'
import { stripeConnectService,type StripeConnectFinance } from '../../services/stripeConnectService'
import { centsMoney,scheduleLabel } from './financeSummary'

// Taxas reais: a taxa da SphexPay vem da regra configurada no servidor; a taxa de
// processamento é cobrada pela Stripe na conta do vendedor, pela tabela pública dela.
// Prazos de confirmação e liberação seguem a documentação da Stripe Brasil.
const METHODS=[
 {key:'card',label:'Cartão de crédito',Icon:CreditCard,confirm:'Na hora',refund:'Até 180 dias'},
 {key:'pix',label:'Pix',Icon:QrCode,confirm:'Na hora',refund:'Até 90 dias'},
 {key:'boleto',label:'Boleto',Icon:FileText,confirm:'Até 1 dia útil após o pagamento',refund:'Até 30 dias'}
] as const

export function FeesSection(){useAppLocale(state=>state.locale)
 const [finance,setFinance]=useState<StripeConnectFinance|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const load=useCallback(()=>{setLoading(true);setError('');stripeConnectService.finance().then(setFinance).catch(reason=>{setFinance(null);setError(reason instanceof Error?reason.message:'Não foi possível consultar suas taxas agora.')}).finally(()=>setLoading(false))},[])
 useEffect(()=>{load()},[load])
 const bps=finance?.platformFeeBps??null,percent=bps==null?null:(bps/100).toLocaleString('pt-BR',{maximumFractionDigits:2})
 const delay=finance?.schedule?.delayDays
 return <section aria-label={uiText('Minhas taxas')}><header className="financial-section-heading"><h2><T>Minhas taxas</T></h2><p><T>Quanto custa cada venda e quando o dinheiro fica disponível.</T></p></header>
  {loading?<Loading label="Carregando taxas"/>:error?<StateMessage title={uiText('Taxas indisponíveis')}><span>{error}</span> <button className="btn" onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></button></StateMessage>:<>
  <div className="grid md:grid-cols-2 gap-4 mb-4">
   <Card className="p-5"><BadgePercent size={19} className="orange mb-3"/><span className="label"><T>Taxa SphexPay</T></span>
    {percent==null?<p className="text-sm mt-1"><T>A regra de taxa ainda não foi configurada pela plataforma. Nenhuma venda é cobrada enquanto isso.</T></p>:<>
    <b className="text-2xl block">{percent}%</b><small className="muted block mt-1"><T>Por venda aprovada, igual para cartão, Pix, boleto e cada cobrança de assinatura. Sem mensalidade.</T></small>
    <p className="text-sm mt-3"><T>Exemplo: numa venda de </T><b>{centsMoney(10000)}</b><T>, a taxa SphexPay é </T><b>{centsMoney(Math.floor(10000*bps!/10000))}</b>.</p></>}
   </Card>
   <Card className="p-5"><CreditCard size={19} className="orange mb-3"/><span className="label"><T>Taxa de processamento</T></span>
    <p className="text-sm mt-1"><T>Cobrada pela Stripe direto na sua conta, conforme a tabela pública dela para cada método. Ela aparece descontada em cada pagamento no seu painel da Stripe.</T></p>
    <a className="btn mt-3" href="https://stripe.com/br/pricing" target="_blank" rel="noreferrer"><ExternalLink size={15}/><T> Ver tabela da Stripe</T></a>
   </Card>
  </div>
  <Card className="mb-4"><div className="p-5 border-b border-[var(--line)] flex flex-wrap gap-3 items-center justify-between"><b><T>Métodos e prazos</T></b>
   <span className="text-sm"><CalendarClock size={14} className="inline mr-1"/><T>Agenda de repasses: </T><b><T>{scheduleLabel(finance?.schedule??null)}</T></b>{delay!=null&&<> · <T>liberação em </T>{delay}<T> dia(s)</T></>}</span></div>
   <div className="table-wrap"><table className="table"><caption className="sr-only"><T>Métodos e prazos</T></caption><thead><tr><th><T>Método</T></th><th><T>Na sua conta</T></th><th><T>Confirmação</T></th><th><T>Prazo para reembolsar</T></th></tr></thead>
    <tbody>{METHODS.map(({key,label,Icon,confirm,refund})=>{const active=Boolean(finance?.methods?.[key]);return <tr key={key}><td><span className="flex items-center gap-2"><Icon size={16}/><T>{label}</T></span></td><td><span className={`badge ${active?'badge-ok':''}`}><T>{active?'Ativo':finance?.connected?'Inativo':'Conta não conectada'}</T></span></td><td><T>{confirm}</T></td><td><T>{refund}</T></td></tr>})}</tbody></table></div>
  </Card>
  <p className="muted text-xs"><T>Pix e boleto só aceitam reais. Pix: de R$ 0,50 até o limite da Stripe por pagamento. Boleto: de R$ 5,00 a R$ 49.999,99. Assinaturas são cobradas no cartão. Para ativar Pix ou boleto, use Configurações → Métodos de pagamento no painel da Stripe.</T>{finance?.mode==='test'?<> <T>Conta em ambiente de teste.</T></>:null}</p>
  </>}
 </section>
}
