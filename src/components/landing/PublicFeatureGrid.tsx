import { Globe2, LayoutGrid, RefreshCw, Users, Zap } from 'lucide-react'
const features = [
 { Icon: Zap, label: 'CHECKOUT', title: 'Uma experiência fluida.', copy: 'Cada etapa, pensada para a conversão.' },
 { Icon: LayoutGrid, label: 'PRODUTOS', title: 'Crie. Organize. Venda.', copy: 'Sua operação em um só lugar.' },
 { Icon: Users, label: 'CLIENTES', title: 'Conexões que crescem.', copy: 'Uma visão clara de cada relacionamento.' },
 { Icon: Globe2, label: 'PAGAMENTOS', title: 'Seu negócio, conectado.', copy: 'Métodos e fluxos em uma experiência global.' },
 { Icon: RefreshCw, label: 'AUTOMAÇÃO', title: 'Mais ritmo. Menos tarefas.', copy: 'Acompanhe eventos sem perder o foco.' },
]
export function PublicFeatureGrid() {
 return <section className="ref-features" id="solucoes" aria-label="Soluções SphexPay">{features.map(({Icon,label,title,copy},index)=><article className={`ref-feature ref-feature-${index}`} key={label} data-motion><div className="ref-feature-art" aria-hidden="true"><i><Icon size={24} strokeWidth={1.5}/></i></div><div className="ref-feature-copy"><span>{label}</span><h2>{title}</h2><p>{copy}</p></div></article>)}</section>
}
