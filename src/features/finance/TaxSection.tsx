import {useCallback,useEffect,useMemo,useState} from 'react'
import {Download,Info,Landmark,LoaderCircle,PiggyBank,ReceiptText,RotateCcw,Save,WalletCards} from 'lucide-react'
import {T,translate as uiText} from '../../i18n'
import {useAppLocale} from '../../i18n/localeStore'
import {Button,Card,Empty,Input,Loading,Select,StateMessage} from '../../components/ui'
import {PeriodSelector} from '../../components/common/PeriodSelector'
import {useActiveSeller} from '../../hooks/useActiveSeller'
import {useOptionalDashboardData} from '../../providers/DashboardDataProvider'
import {downloadCsv,shortDate} from '../../lib/utils'
import {centsMoney} from './financeSummary'
import {useFinanceData} from './useFinanceData'
import {DEFAULT_TAX_SETTINGS,TAX_REGIMES,bpsToPercent,percentToBps,summarizeTaxReserve,taxReportCsv,taxService,type TaxRegime,type TaxSettings} from './taxService'

// Aba Impostos do Financeiro: quanto de cada venda separar para imposto. Só cálculo e relatório;
// nenhum valor é retido pela SphexPay nem enviado ao Fisco.
export function TaxSection(){useAppLocale(state=>state.locale)
 const {sellerId,member}=useActiveSeller(),demoActive=Boolean(useOptionalDashboardData()?.active)
 const {transactions,transactionsError,reload}=useFinanceData({stripe:false})
 const [settings,setSettings]=useState<TaxSettings>(DEFAULT_TAX_SETTINGS),[regime,setRegime]=useState<TaxRegime>('mei'),[percent,setPercent]=useState('0')
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 const apply=useCallback((value:TaxSettings)=>{setSettings(value);setRegime(value.regime);setPercent(bpsToPercent(value.reserveBps))},[])
 const load=useCallback(()=>{
  if(demoActive||!sellerId){apply(DEFAULT_TAX_SETTINGS);setLoading(false);return}
  setLoading(true);setError('')
  taxService.getSettings(sellerId).then(apply).catch(()=>setError('Não foi possível carregar sua configuração de impostos agora.')).finally(()=>setLoading(false))
 },[sellerId,demoActive,apply])
 useEffect(()=>{load()},[load])
 const draftBps=percentToBps(percent),editable=!member&&!demoActive
 const dirty=regime!==settings.regime||draftBps!==settings.reserveBps
 const preview=draftBps??settings.reserveBps
 const summary=useMemo(()=>summarizeTaxReserve(transactions||[],preview),[transactions,preview])
 const save=async()=>{
  if(!sellerId||draftBps==null){setMessage('');setError('Informe uma porcentagem entre 0 e 100, com até duas casas decimais.');return}
  setSaving(true);setError('');setMessage('')
  try{const next={regime,reserveBps:draftBps};await taxService.saveSettings(sellerId,next);apply(next);setMessage('Configuração de impostos salva.')}
  catch{setError('Não foi possível salvar. Sua configuração continua nesta tela.')}
  finally{setSaving(false)}
 }
 const hint=TAX_REGIMES.find(item=>item.value===regime)?.hint
 const cards=[
  ['Vendido no período',centsMoney(summary.grossCents),ReceiptText,`${summary.count} ${summary.count===1?'venda aprovada':'vendas aprovadas'}`],
  ['Reservar para imposto',centsMoney(summary.reserveCents),PiggyBank,`${bpsToPercent(preview)}% de cada venda`],
  ['Taxa SphexPay',centsMoney(summary.feesCents),Landmark,'Já descontada das vendas.'],
  ['Líquido após imposto',centsMoney(summary.netAfterTaxCents),WalletCards,'O que sobra de fato para você.']
 ] as const
 return <section aria-label={uiText('Impostos')}>
  <header className="financial-section-heading"><h2><T>Impostos</T></h2><p><T>Quanto separar de cada venda para pagar seus impostos, e o relatório do mês para o contador.</T></p></header>
  {loading?<Loading label="Carregando impostos"/>:<>
  <Card className="p-5 mb-4">
   <div className="flex flex-wrap gap-4 items-end">
    <label className="flex flex-col gap-1 min-w-[200px]"><span className="label"><T>Regime da empresa</T></span>
     <Select aria-label={uiText('Regime da empresa')} value={regime} disabled={!editable} onChange={e=>{setRegime(e.target.value as TaxRegime);setMessage('')}}>{TAX_REGIMES.map(item=><option value={item.value} key={item.value}>{uiText(item.label)}</option>)}</Select></label>
    <label className="flex flex-col gap-1 w-[160px]"><span className="label"><T>Reservar de cada venda (%)</T></span>
     <Input aria-label={uiText('Porcentagem de reserva')} inputMode="decimal" value={percent} disabled={!editable} onChange={e=>{setPercent(e.target.value);setMessage('')}}/></label>
    {editable&&<Button variant="primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?<LoaderCircle className="spin"/>:<Save/>}<T>{saving?' Salvando...':dirty?' Salvar':' Salvo'}</T></Button>}
   </div>
   {hint&&<p className="muted text-sm mt-3"><T>{hint}</T></p>}
   {member&&<p className="muted text-xs mt-2"><T>Só o dono da conta altera esta configuração.</T></p>}
   {draftBps==null&&<p className="text-sm mt-2 text-red-500" role="alert"><T>Informe uma porcentagem entre 0 e 100, com até duas casas decimais.</T></p>}
  </Card>
  {error&&<div className="mb-4"><StateMessage title={uiText('Algo não funcionou')}><span><T>{error}</T></span> <Button onClick={load}><RotateCcw size={14}/><T> Tentar novamente</T></Button></StateMessage></div>}
  {message&&<div className="mb-4"><StateMessage tone="success" title={uiText(message)}><span><T>A reserva abaixo já usa a nova porcentagem.</T></span></StateMessage></div>}
  <div className="financial-overview-actions"><PeriodSelector/><Button disabled={!summary.rows.length} onClick={()=>downloadCsv('impostos-sphexpay.csv',taxReportCsv(summary,{regime,reserveBps:preview}))}><Download size={16}/><T> Relatório para o contador</T></Button></div>
  {transactionsError&&<div className="mb-4"><StateMessage title={uiText('Vendas não carregaram')}><span><T>{transactionsError}</T></span> <Button onClick={reload}><RotateCcw size={14}/><T> Tentar novamente</T></Button></StateMessage></div>}
  <div className="financial-balance-grid grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">{cards.map(([label,value,Icon,detail])=><Card className="financial-balance-card p-5" key={label}><Icon size={19} className="orange mb-4"/><span className="label"><T>{label}</T></span><b className="text-xl financial-money">{transactions?value:'...'}</b><small className="muted text-xs block mt-1"><T>{detail}</T></small></Card>)}</div>
  <Card className="financial-ledger-card"><div className="p-5 border-b border-[var(--line)]"><b><T>Reserva por venda</T></b></div>
   {transactions===null?<Loading label="Carregando vendas"/>:summary.rows.length===0?<Empty title={uiText('Nenhuma venda aprovada no período')} text={uiText('Cada venda aprovada aparece aqui com o valor a reservar para imposto.')}/>:
   <div className="table-wrap"><table className="table"><thead><tr><th><T>Data</T></th><th><T>Produto</T></th><th><T>Venda</T></th><th><T>Taxa SphexPay</T></th><th><T>Reservar</T></th><th><T>Líquido</T></th></tr></thead>
    <tbody>{summary.rows.map(row=><tr key={row.id}><td>{shortDate(row.date)}</td><td>{row.productName}</td><td className="financial-money">{centsMoney(row.grossCents)}</td><td className="financial-money muted">{centsMoney(row.feeCents)}</td><td className="financial-money font-bold">{centsMoney(row.reserveCents)}</td><td className="financial-money text-emerald-600 font-bold">{centsMoney(row.netCents)}</td></tr>)}</tbody></table></div>}
  </Card>
  <Card className="p-5 mt-4"><div className="flex gap-3"><Info size={18} className="orange shrink-0 mt-0.5"/><div className="text-sm">
   <p><b><T>O dinheiro não fica retido.</T></b><T> O valor de cada venda vai inteiro para sua conta na Stripe. A reserva mostra quanto separar; o imposto é pago pela guia (DAS ou DARF) no seu CNPJ.</T></p>
   <p className="mt-2"><b><T>Split payment (Reforma Tributária).</T></b><T> O recolhimento automático de IBS e CBS no pagamento está previsto para começar em 2027, de forma gradual, entre empresas. Quando for liberado pela Receita e pela Stripe, os dados fiscais dos seus produtos já estarão prontos. Confirme regime e porcentagem com seu contador.</T></p>
  </div></div></Card>
  </>}
 </section>
}
