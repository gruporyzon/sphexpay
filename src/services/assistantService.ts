import type { DemoState } from '../types'
import { filterSales } from './analyticsService'
import { money } from '../lib/utils'
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export const assistantService={
 answer(question:string,state:DemoState){const text=normalize(question),sales=filterSales(state.sales,state.period),approved=sales.filter(s=>s.status==='Aprovado'),pending=sales.filter(s=>s.status==='Pendente'||s.status==='Em análise'),today=state.sales.filter(s=>new Date(s.date).toDateString()===new Date().toDateString()&&s.status==='Aprovado'),todayRevenue=today.reduce((sum,s)=>sum+s.amount,0),activeSubs=state.subscriptions.filter(s=>s.status==='Ativa'),top=[...state.products].sort((a,b)=>b.sales-a.sales)[0],fees=sales.reduce((sum,s)=>sum+s.fee,0)
  if(text.includes('hoje')&&(text.includes('fatur')||text.includes('receita')))return `Hoje, o faturamento registrado é ${money(todayRevenue)}, distribuído em ${today.length} ${today.length===1?'venda aprovada':'vendas aprovadas'}.`
  if(text.includes('saldo'))return `Seu saldo disponível é ${money(state.available)}. O saldo previsto é ${money(state.pending)}.`
  if(text.includes('produto')&&(text.includes('mais')||text.includes('melhor')))return `${top.name} lidera o desempenho, com ${top.sales} vendas e ${money(top.revenue)} em receita.`
  if(text.includes('assinatur'))return `Você possui ${activeSubs.length} assinaturas ativas, com receita recorrente mensal de ${money(activeSubs.reduce((sum,s)=>sum+s.amount,0))}.`
  if(text.includes('aprovad'))return `No período selecionado, há ${approved.length} vendas aprovadas, somando ${money(approved.reduce((sum,s)=>sum+s.amount,0))}.`
  if(text.includes('pendent')||text.includes('analise'))return `Existem ${pending.length} pagamentos pendentes ou em análise, totalizando ${money(pending.reduce((sum,s)=>sum+s.amount,0))}.`
  if(text.includes('meta')){const missing=Math.max(0,state.goal-state.revenue);return missing?`Faltam ${money(missing)} para alcançar sua meta de ${money(state.goal)}. Você já completou ${Math.min(100,state.revenue/state.goal*100).toFixed(1)}%.`:`A meta de ${money(state.goal)} já foi alcançada.`}
  if(text.includes('cliente'))return `Sua base atual possui ${state.customers.length} clientes, com ${state.customers.filter(c=>c.status==='Ativo').length} perfis ativos.`
  if(text.includes('relatorio')||text.includes('desempenho'))return `No período selecionado, foram registradas ${sales.length} vendas, ${approved.length} aprovadas e taxa de aprovação de ${sales.length?(approved.length/sales.length*100).toFixed(1):'0,0'}%.`
  if(text.includes('finance')||text.includes('taxa')||text.includes('lucro'))return `O saldo disponível é ${money(state.available)}. As taxas do período somam ${money(fees)}, e os valores previstos totalizam ${money(state.pending)}.`
  if(text.includes('fatur')||text.includes('receita'))return `O faturamento acumulado é ${money(state.revenue)}. No período selecionado, as vendas aprovadas somam ${money(approved.reduce((sum,s)=>sum+s.amount,0))}.`
  if(text.includes('venda'))return `O período selecionado contém ${sales.length} vendas: ${approved.length} aprovadas e ${pending.length} pendentes ou em análise.`
  return 'Posso analisar faturamento, saldos, vendas, assinaturas, clientes, metas, produtos, relatórios e indicadores financeiros. Faça uma pergunta sobre um desses temas.'
 }
}
