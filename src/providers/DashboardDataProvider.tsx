/* eslint-disable react-refresh/only-export-components */
import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDashboardAdmin } from '../hooks/useDashboardAdmin'
import { productService } from '../services/productService'
import type { AppNotification,Product } from '../types'
import { convertDemoCents,createHistory,createLiveTransaction,fallbackDemoProducts,nextDemoDelay,reconcileDemoLedger,seedFromSession } from '../demo/demoSimulationEngine'
import { productToDemo,type DemoCustomer,type DemoNotification,type DemoSession,type DemoTransaction } from '../demo/types'

const STORAGE_KEY='sphexpay_demo_v1',TTL=24*60*60*1000
type ContextValue={
 active:boolean
 allowed:boolean
 loadingPermission:boolean
 ledger:DemoTransaction[]
 notifications:DemoNotification[]
 customers:DemoCustomer[]
 toggle:()=>Promise<void>
 markNotificationRead:(id:string)=>void
 markAllNotificationsRead:()=>void
 clearDemoNotifications:()=>void
}
const DashboardDataContext=createContext<ContextValue|null>(null)
const empty:Omit<DemoSession,'active'|'ownerId'|'sessionId'|'seed'|'startedAt'|'expiresAt'|'lastEventAt'>={version:1,ledger:[],notifications:[],products:[]}

const load=(ownerId:string):DemoSession|null=>{
 try{
  const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null') as DemoSession|null
  if(!parsed||parsed.version!==1||parsed.ownerId!==ownerId||Date.now()>=new Date(parsed.expiresAt).getTime()){localStorage.removeItem(STORAGE_KEY);return null}
  return parsed
 }catch{localStorage.removeItem(STORAGE_KEY);return null}
}
const persist=(session:DemoSession|null)=>{if(session)localStorage.setItem(STORAGE_KEY,JSON.stringify(session));else localStorage.removeItem(STORAGE_KEY)}

export function DashboardDataProvider({children}:PropsWithChildren){
 const {user}=useAuth(),permission=useDashboardAdmin(user?.id),[session,setSession]=useState<DemoSession|null>(()=>user?.id?load(user.id):null),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const stop=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null},[])
 const update=useCallback((recipe:(current:DemoSession)=>DemoSession)=>setSession(current=>{if(!current)return current;const next=recipe(current);persist(next);return next}),[])
 const schedule=useCallback((current:DemoSession)=>{
  stop()
  if(!current.active||document.hidden)return
  timer.current=setTimeout(()=>update(value=>{
   const now=new Date(),reconciled=reconcileDemoLedger(value.ledger,now),live=createLiveTransaction({...value,ledger:reconciled.ledger},now)
   const notifications=[...value.notifications]
   if(reconciled.approved){
    notifications.unshift({id:`notification-${reconciled.approved.transactionId}`,demo:true,title:'Venda demonstrativa aprovada',description:`${reconciled.approved.productName} · ${reconciled.approved.customerDisplayName}`,createdAt:now.toISOString(),read:false,transactionId:reconciled.approved.transactionId})
    const total=reconciled.ledger.filter(item=>item.status==='approved').reduce((sum,item)=>sum+convertDemoCents(item.amountCents,item.currency,'BRL'),0),before=total-convertDemoCents(reconciled.approved.amountCents,reconciled.approved.currency,'BRL'),target=[1_000_000,10_000_000,50_000_000,100_000_000,500_000_000].find(value=>before<value&&total>=value)
    if(target)notifications.unshift({id:`notification-award-${target}-${value.sessionId}`,demo:true,title:'Meta demonstrativa alcançada',description:'A próxima plaquinha demonstrativa foi liberada.',createdAt:now.toISOString(),read:false})
   }
   return{...value,ledger:[live,...reconciled.ledger].slice(0,600),notifications:notifications.slice(0,50),lastEventAt:now.toISOString()}
  }),nextDemoDelay(current))
 },[stop,update])
 useEffect(()=>{if(!user?.id){stop();setSession(null);return}setSession(load(user.id))},[user?.id,stop])
 useEffect(()=>{if(session?.active)schedule(session);else stop();return stop},[session,schedule,stop])
 const active=Boolean(session?.active)
 useEffect(()=>{const visibility=()=>{if(document.hidden)stop();else if(active)update(value=>{const reconciled=reconcileDemoLedger(value.ledger);return{...value,ledger:reconciled.ledger,lastEventAt:new Date().toISOString()}})};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility)},[active,stop,update])
 const toggle=useCallback(async()=>{
  if(!user?.id||!permission.allowed)return
  if(session?.active){stop();persist(null);setSession(null);return}
  const products=await productService.list(user.id).catch(()=>[] as Product[]),sessionId=crypto.randomUUID?.()??`${Date.now()}-${user.id}`,now=new Date(),seed=seedFromSession(sessionId)
  const base:DemoSession={...empty,active:true,ownerId:user.id,sessionId,seed,startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+TTL).toISOString(),lastEventAt:now.toISOString(),products:products.filter(item=>item.active).map(productToDemo)}
  if(!base.products.length)base.products=fallbackDemoProducts
  base.ledger=createHistory(base,now)
  persist(base);setSession(base)
 },[permission.allowed,session?.active,stop,user?.id])
 const notifications=useMemo(()=>session?.notifications??[],[session?.notifications])
 const markNotificationRead=useCallback((id:string)=>update(value=>({...value,notifications:value.notifications.map(item=>item.id===id?{...item,read:true}:item)})),[update])
 const markAllNotificationsRead=useCallback(()=>update(value=>({...value,notifications:value.notifications.map(item=>({...item,read:true}))})),[update])
 const clearDemoNotifications=useCallback(()=>update(value=>({...value,notifications:[]})),[update])
 const customers=useMemo<DemoCustomer[]>(()=>{
  const grouped=new Map<string,DemoCustomer>()
  for(const item of (session?.ledger??[]).filter(row=>row.status==='approved')){
   const current=grouped.get(item.customerEmail)??{id:item.customerEmail,name:item.customerDisplayName,email:item.customerEmail,purchases:0,totalCentsByCurrency:{},lastOrderAt:item.createdAt,lastProduct:item.productName}
   current.purchases++;current.totalCentsByCurrency[item.currency]=(current.totalCentsByCurrency[item.currency]??0)+item.amountCents
   if(item.createdAt>current.lastOrderAt){current.lastOrderAt=item.createdAt;current.lastProduct=item.productName}
   grouped.set(item.customerEmail,current)
  }
  return[...grouped.values()].sort((a,b)=>b.lastOrderAt.localeCompare(a.lastOrderAt))
 },[session?.ledger])
 const value=useMemo(()=>({active:Boolean(session?.active&&permission.allowed),allowed:permission.allowed,loadingPermission:permission.loading,ledger:session?.ledger??[],notifications,customers,toggle,markNotificationRead,markAllNotificationsRead,clearDemoNotifications}),[session?.active,session?.ledger,permission.allowed,permission.loading,notifications,customers,toggle,markNotificationRead,markAllNotificationsRead,clearDemoNotifications])
 return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}

export function useDashboardData(){
 const value=useContext(DashboardDataContext)
 if(!value)throw new Error('useDashboardData deve ser usado dentro de DashboardDataProvider')
 return value
}
export function useOptionalDashboardData(){return useContext(DashboardDataContext)}

export function demoNotificationToApp(item:DemoNotification):AppNotification{
 return{id:item.id,kind:item.title==='Meta demonstrativa alcançada'?'achievement':'sale',category:item.title==='Meta demonstrativa alcançada'?'Sistema':'Vendas',title:item.title.replace('Venda demonstrativa','Venda').replace('Meta demonstrativa','Meta'),description:item.description.replace('plaquinha demonstrativa','plaquinha'),createdAt:item.createdAt,read:item.read,priority:'normal',detailPath:item.transactionId?`/app/transacoes?evento=${encodeURIComponent(item.transactionId)}`:'/app/premiacoes',metadata:{source:'demo'}}
}
