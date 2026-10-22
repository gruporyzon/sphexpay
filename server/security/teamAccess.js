import {ConnectError} from '../stripe/connect.js'

// Colaboradores: o mesmo mapa de cargos da função team_can do banco. O dono sempre pode; o
// colaborador só com cadastro ativo na conta e com o cargo que libera a permissão.
const ROLES={
 'sales.read':['admin','support','finance'],
 'customers.read':['admin','support','finance'],
 'shipments.write':['admin','support'],
 'disputes.read':['admin','finance'],
 'reports.read':['admin','finance'],
 'finance.read':['admin','finance']
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Devolve quem a consulta representa: o próprio usuário ou o dono da conta escolhida.
export async function resolveWorkspace(database,user,seller,permission){
 const value=typeof seller==='string'?seller.trim():''
 if(!value||value===user.id)return{id:user.id}
 if(!UUID.test(value)||!ROLES[permission])throw new ConnectError('FORBIDDEN',403,'Você não tem acesso a esta conta.')
 const {data,error}=await database.from('team_members').select('role').eq('owner_id',value).eq('member_id',user.id).eq('status','active').maybeSingle()
 if(error)throw new ConnectError('TEAM_STORAGE_ERROR',503,'Não foi possível verificar seu acesso agora.')
 if(!data||!ROLES[permission].includes(data.role))throw new ConnectError('FORBIDDEN',403,'Seu cargo não permite ver esta área.')
 return{id:value}
}
