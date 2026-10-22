import { create } from 'zustand'

// Conta ativa no painel. Nulo é a própria conta; com dono, o usuário está como colaborador na
// conta de quem convidou. O banco e o servidor conferem o cargo em toda leitura, então isto só
// escolhe o que mostrar.
export type TeamRole='admin'|'finance'|'support'
export type Workspace={ownerId:string;ownerName:string;ownerEmail:string;role:TeamRole}
export type TeamPermission='sales.read'|'customers.read'|'shipments.write'|'disputes.read'|'reports.read'|'subscriptions.read'|'affiliates.read'|'finance.read'|'catalog.write'

const ROLE_PERMISSIONS:Record<TeamRole,TeamPermission[]>={
 admin:['sales.read','customers.read','shipments.write','disputes.read','reports.read','subscriptions.read','affiliates.read','finance.read','catalog.write'],
 finance:['sales.read','customers.read','disputes.read','reports.read','subscriptions.read','affiliates.read','finance.read'],
 support:['sales.read','customers.read','shipments.write']
}
export const roleCan=(role:TeamRole|null|undefined,permission:TeamPermission)=>!role||ROLE_PERMISSIONS[role].includes(permission)

const KEY='sphex-workspace'
const read=():Workspace|null=>{try{const raw=localStorage.getItem(KEY);if(!raw)return null;const value=JSON.parse(raw) as Workspace;return value&&typeof value.ownerId==='string'&&['admin','finance','support'].includes(value.role)?value:null}catch{return null}}

type State={workspace:Workspace|null;setWorkspace:(workspace:Workspace|null)=>void}
export const useWorkspaceStore=create<State>(set=>({
 workspace:read(),
 setWorkspace:workspace=>{try{if(workspace)localStorage.setItem(KEY,JSON.stringify(workspace));else localStorage.removeItem(KEY)}catch{/* armazenamento indisponível */}set({workspace})}
}))

// Id da conta escolhida para as RPCs com p_seller (nulo = própria conta).
export const activeSeller=()=>useWorkspaceStore.getState().workspace?.ownerId??null
