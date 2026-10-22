import { roleCan,type TeamPermission,type TeamRole } from '../store/useWorkspaceStore'

// Áreas do painel que um colaborador pode abrir na conta de quem convidou, por permissão.
// Tudo que não está aqui fica só com o dono (produtos, verificação, integrações, afiliados,
// indicações, premiações...). Configurações e notificações são da própria pessoa.
const RULES:[path:string,permission:TeamPermission|null,exact?:boolean][]=[
 ['/app',"sales.read",true],
 ['/app/vendas','sales.read'],
 ['/app/vendas-ao-vivo','sales.read'],
 ['/app/assinaturas','subscriptions.read'],
 ['/app/financeiro','finance.read'],
 ['/app/relatorios','reports.read',true],
 ['/app/relatorios/clientes','customers.read'],
 ['/app/relatorios/carrinhos','customers.read'],
 ['/app/relatorios/afiliados','affiliates.read'],
 ['/app/configuracoes',null],
 ['/app/notificacoes',null]
]
const TAB_PERMISSION:Record<string,TeamPermission>={contestacoes:'disputes.read',encomendas:'sales.read'}

export function memberCanOpen(role:TeamRole|null|undefined,appPath:string,search=''){
 if(!role)return true
 const path=appPath.replace(/\/+$/,'')||'/app'
 const rule=RULES.find(([base,,exact])=>exact?path===base:path===base||path.startsWith(`${base}/`))
 if(!rule)return false
 if(rule[1]&&!roleCan(role,rule[1]))return false
 const tab=new URLSearchParams(search).get('aba')
 return!(path==='/app/vendas'&&tab&&TAB_PERMISSION[tab]&&!roleCan(role,TAB_PERMISSION[tab]))
}
