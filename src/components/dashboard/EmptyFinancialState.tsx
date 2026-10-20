import {T} from '../../i18n'
import { ShoppingBag } from 'lucide-react'
export function EmptyFinancialState(){return <div className="sales-empty"><ShoppingBag/><h3><T>Nenhuma venda registrada neste período.</T></h3><p><T>Os dados aparecerão quando uma transação real for persistida e confirmada.</T></p></div>}
