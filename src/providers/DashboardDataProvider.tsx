/* eslint-disable react-refresh/only-export-components */
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren} from 'react'
import {useAuth} from '../hooks/useAuth'
import {useDashboardAdmin} from '../hooks/useDashboardAdmin'
import {productService} from '../services/productService'
import type {AppNotification,Product} from '../types'
import {calculateDynamicInterval,convertDemoCents,createHistory,defaultDemoConfig,fallbackDemoProducts,generateNextEvent,reconcileDemoLedger,seedFromSession} from '../demo/demoSimulationEngine'
import {productToDemo,type DemoConfig,type DemoCustomer,type DemoNotification,type DemoSession,type DemoTransaction} from '../demo/types'

const STORAGE_KEY='sphexpay_demo_v2',LEGACY_KEY='sphexpay_demo_v1',TTL=24*60*60*1000
type ContextValue={
 active:boolean;paused:boolean;allowed:boolean;loadingPermission:boolean;ledger:DemoTransaction[];notifications:DemoNotification[];customers:DemoCustomer[]
 config:DemoConfig;sessionId:string;eventCount:number;approvedCount:number;sessionVolumeCents:number;nextEventAt:number|null;intensity:number
 toggle:()=>Promise<void>;applyConfig:(config:DemoConfig)=>void;pause:()=>void;resume:()=>void;restart:()=>void;adjustIntensity:(direction:-1|1)=>void
 markNotificationRead:(id:string)=>void;markAllNotificationsRead:()=>void;clearDemoNotifications:()=>void
}
const DashboardDataContext=createContext<ContextValue|null>(null)

const migrate=(raw:unknown,ownerId:string):DemoSession|null=>{
 if(!raw||typeof raw!=='object')return null
 const value=raw as Partial<DemoSession>&{version?:number}
 if(value.ownerId!==ownerId||!value.expiresAt||Date.now()>=new Date(value.expiresAt).getTime())return null
 const settings=value.version===2&&value.config?value.config:defaultDemoConfig()
 const ledger=(Array.isArray(value.ledger)?value.ledger:[]).map((item,index)=>{
  const transaction=item as DemoTransaction
  return{...transaction,customerId:transaction.customerId??`legacy-${index}`,countryCode:transaction.countryCode??'BR',countryName:transaction.countryName??'Brasil',cityName:transaction.cityName??'São Paulo'}
 })
 return{version:2,active:Boolean(value.active),paused:Boolean(value.paused),sessionId:value.sessionId||crypto.randomUUID(),seed:value.seed||seedFromSession(value.sessionId||ownerId),ownerId,startedAt:value.startedAt||new Date().toISOString(),expiresAt:value.expiresAt,lastEventAt:value.lastEventAt||new Date().toISOString(),ledger,notifications:value.notifications??[],products:value.products?.length?value.products:fallbackDemoProducts,config:settings,eventCount:value.eventCount??ledger.length,approvedCount:value.approvedCount??ledger.filter(item=>item.status==='approved').length,sessionVolumeCents:value.sessionVolumeCents??ledger.filter(item=>item.status==='approved').reduce((sum,item)=>sum+convertDemoCents(item.amountCents,item.currency,'BRL'),0),intensity:value.intensity??1,exchangeRates:value.exchangeRates??{BRL:1,USD:.19,EUR:.17}}
}
const load=(ownerId:string):DemoSession|null=>{
 try{
  const current=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'),legacy=current?null:JSON.parse(localStorage.getItem(LEGACY_KEY)||'null'),session=migrate(current??legacy,ownerId)
  if(!session){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_KEY);return null}
  localStorage.setItem(STORAGE_KEY,JSON.stringify(session));localStorage.removeItem(LEGACY_KEY);return session
 }catch{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_KEY);return null}
}
const persist=(session:DemoSession|null)=>{if(session)localStorage.setItem(STORAGE_KEY,JSON.stringify(session));else localStorage.removeItem(STORAGE_KEY)}
const createSession=(ownerId:string,products:DemoSession['products'],settings=defaultDemoConfig()):DemoSession=>{
 const sessionId=crypto.randomUUID?.()??`${Date.now()}-${ownerId}`,now=new Date(),seed=seedFromSession(sessionId)
 const base:DemoSession={version:2,active:true,paused:false,ownerId,sessionId,seed,startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+TTL).toISOString(),lastEventAt:now.toISOString(),products:products.length?products:fallbackDemoProducts,config:settings,ledger:[],notifications:[],eventCount:0,approvedCount:0,sessionVolumeCents:0,intensity:1,exchangeRates:{BRL:1,USD:.19,EUR:.17}}
 base.ledger=createHistory(base,now);base.eventCount=base.ledger.length;base.approvedCount=base.ledger.filter(item=>item.status==='approved').length;base.sessionVolumeCents=base.ledger.filter(item=>item.status==='approved').reduce((sum,item)=>sum+convertDemoCents(item.amountCents,item.currency,'BRL',base.exchangeRates),0)
 return base
}

export function DashboardDataProvider({children}:PropsWithChildren){
 const {user}=useAuth(),permission=useDashboardAdmin(user?.id),[session,setSession]=useState<DemoSession|null>(()=>user?.id?load(user.id):null),[nextEventAt,setNextEventAt]=useState<number|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const stop=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;setNextEventAt(null)},[])
 const update=useCallback((recipe:(current:DemoSession)=>DemoSession)=>setSession(current=>{if(!current)return current;const next=recipe(current);persist(next);return next}),[])
 const schedule=useCallback((current:DemoSession)=>{
  stop();if(!current.active||current.paused||document.hidden)return
  const delay=calculateDynamicInterval(current),due=Date.now()+delay;setNextEventAt(due)
  timer.current=setTimeout(()=>update(value=>{
   if(!value.active||value.paused)return value
   const now=new Date(),reconciled=reconcileDemoLedger(value.ledger,now,value.config),live=generateNextEvent({...value,ledger:reconciled.ledger},now),notifications=[...value.notifications]
   let approvedCount=value.approvedCount,sessionVolumeCents=value.sessionVolumeCents
   if(reconciled.approved){
    approvedCount++;sessionVolumeCents+=convertDemoCents(reconciled.approved.amountCents,reconciled.approved.currency,'BRL',value.exchangeRates)
    notifications.unshift({id:`notification-${reconciled.approved.transactionId}`,demo:true,title:'Venda aprovada',description:`${reconciled.approved.customerDisplayName} · ${reconciled.approved.countryName}`,createdAt:now.toISOString(),read:false,transactionId:reconciled.approved.transactionId})
    const before=sessionVolumeCents-convertDemoCents(reconciled.approved.amountCents,reconciled.approved.currency,'BRL',value.exchangeRates),target=[1_000_000,10_000_000,50_000_000,100_000_000,500_000_000].find(goal=>before<goal&&sessionVolumeCents>=goal)
    if(target)notifications.unshift({id:`notification-award-${target}-${value.sessionId}`,demo:true,title:'Meta alcançada',description:'A próxima plaquinha foi liberada nesta sessão.',createdAt:now.toISOString(),read:false})
   }
   return{...value,ledger:[live,...reconciled.ledger].slice(0,value.config.memoryLimit),notifications:notifications.slice(0,50),lastEventAt:now.toISOString(),eventCount:value.eventCount+1,approvedCount,sessionVolumeCents}
  }),delay)
 },[stop,update])
 useEffect(()=>{if(!user?.id){stop();setSession(null);return}setSession(load(user.id))},[user?.id,stop])
 useEffect(()=>{if(session?.active&&!session.paused)schedule(session);else stop();return stop},[session,schedule,stop])
 const active=Boolean(session?.active)
 useEffect(()=>{const visibility=()=>{if(document.hidden)stop();else if(active&&!session?.paused)update(value=>{const reconciled=reconcileDemoLedger(value.ledger,new Date(),value.config);return{...value,ledger:reconciled.ledger,lastEventAt:new Date().toISOString()}})};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility)},[active,session?.paused,stop,update])
 const toggle=useCallback(async()=>{
  if(!user?.id||!permission.allowed)return
  if(session?.active){stop();persist(null);setSession(null);return}
  const products=await productService.list(user.id).catch(()=>[] as Product[]),next=createSession(user.id,products.filter(item=>item.active).map(productToDemo))
  persist(next);setSession(next)
 },[permission.allowed,session?.active,stop,user?.id])
 const applyConfig=useCallback((config:DemoConfig)=>update(value=>({...value,config:{...config,preset:config.preset},ledger:value.ledger.slice(0,config.memoryLimit)})),[update])
 const pause=useCallback(()=>update(value=>({...value,paused:true})),[update])
 const resume=useCallback(()=>update(value=>({...value,paused:false,lastEventAt:new Date().toISOString()})),[update])
 const restart=useCallback(()=>update(value=>createSession(value.ownerId,value.products,value.config)),[update])
 const adjustIntensity=useCallback((direction:-1|1)=>update(value=>({...value,intensity:Math.min(3,Math.max(.25,Number((value.intensity+direction*.25).toFixed(2))))})),[update])
 const notifications=useMemo(()=>session?.notifications??[],[session?.notifications])
 const markNotificationRead=useCallback((id:string)=>update(value=>({...value,notifications:value.notifications.map(item=>item.id===id?{...item,read:true}:item)})),[update])
 const markAllNotificationsRead=useCallback(()=>update(value=>({...value,notifications:value.notifications.map(item=>({...item,read:true}))})),[update])
 const clearDemoNotifications=useCallback(()=>update(value=>({...value,notifications:[]})),[update])
 const customers=useMemo<DemoCustomer[]>(()=>{
  const grouped=new Map<string,DemoCustomer>()
  for(const item of (session?.ledger??[]).filter(row=>row.status==='approved')){
   const current=grouped.get(item.customerId)??{id:item.customerId,name:item.customerDisplayName,email:item.customerEmail,purchases:0,totalCentsByCurrency:{},lastOrderAt:item.createdAt,lastProduct:item.productName,countryName:item.countryName,cityName:item.cityName}
   current.purchases++;current.totalCentsByCurrency[item.currency]=(current.totalCentsByCurrency[item.currency]??0)+item.amountCents
   if(item.createdAt>current.lastOrderAt){current.lastOrderAt=item.createdAt;current.lastProduct=item.productName}
   grouped.set(item.customerId,current)
  }
  return[...grouped.values()].sort((a,b)=>b.lastOrderAt.localeCompare(a.lastOrderAt))
 },[session?.ledger])
 const value=useMemo<ContextValue>(()=>({active:Boolean(session?.active&&permission.allowed),paused:Boolean(session?.paused),allowed:permission.allowed,loadingPermission:permission.loading,ledger:session?.ledger??[],notifications,customers,config:session?.config??defaultDemoConfig(),sessionId:session?.sessionId??'',eventCount:session?.eventCount??0,approvedCount:session?.approvedCount??0,sessionVolumeCents:session?.sessionVolumeCents??0,nextEventAt,intensity:session?.intensity??1,toggle,applyConfig,pause,resume,restart,adjustIntensity,markNotificationRead,markAllNotificationsRead,clearDemoNotifications}),[session,permission.allowed,permission.loading,notifications,customers,nextEventAt,toggle,applyConfig,pause,resume,restart,adjustIntensity,markNotificationRead,markAllNotificationsRead,clearDemoNotifications])
 return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
}
export function useDashboardData(){const value=useContext(DashboardDataContext);if(!value)throw new Error('useDashboardData deve ser usado dentro de DashboardDataProvider');return value}
export function useOptionalDashboardData(){return useContext(DashboardDataContext)}
export function demoNotificationToApp(item:DemoNotification):AppNotification{return{id:item.id,kind:item.title.includes('Meta')?'achievement':'sale',category:item.title.includes('Meta')?'Sistema':'Vendas',title:item.title,description:item.description,createdAt:item.createdAt,read:item.read,priority:'normal',detailPath:item.transactionId?`/app/transacoes?evento=${encodeURIComponent(item.transactionId)}`:'/app/premiacoes',metadata:{source:'demo'}}}
