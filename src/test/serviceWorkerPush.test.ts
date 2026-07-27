import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe,expect,it,vi } from 'vitest'

type Listener=(event:Record<string,unknown>)=>void

function loadWorker(existingNotifications:unknown[]=[]){
 const listeners=new Map<string,Listener>()
 const showNotification=vi.fn(async()=>undefined)
 const navigate=vi.fn(async()=>undefined)
 const focus=vi.fn(async()=>undefined)
 const openWindow=vi.fn(async()=>undefined)
 const context={
  URL,
  Response,
  fetch:vi.fn(),
  caches:{open:vi.fn(),keys:vi.fn(),delete:vi.fn(),match:vi.fn()},
  self:{
   location:{origin:'https://sphexpay.vercel.app'},
   skipWaiting:vi.fn(),
   clients:{
    claim:vi.fn(),
    matchAll:vi.fn(async()=>[{url:'https://sphexpay.vercel.app/app',navigate,focus}]),
    openWindow
   },
   registration:{
    getNotifications:vi.fn(async()=>existingNotifications),
    showNotification
   },
   addEventListener:(type:string,listener:Listener)=>listeners.set(type,listener)
  }
 }
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),context)
 return{listeners,showNotification,navigate,focus,openWindow}
}

async function dispatch(listener:Listener,event:Record<string,unknown>){
 let pending:Promise<unknown>=Promise.resolve()
 listener({...event,waitUntil:(value:Promise<unknown>)=>{pending=value}})
 await pending
}

describe('Service Worker Push',()=>{
 it('faz parsing do JSON, exibe a rota e usa eventId como tag',async()=>{
  const worker=loadWorker()
  await dispatch(worker.listeners.get('push')!,{
   data:{json:()=>({eventId:'sale:tx-1',type:'sale_approved',title:'Venda aprovada!',body:'Produto real',route:'/app/transacoes/tx-1'})}
  })
  expect(worker.showNotification).toHaveBeenCalledWith('Venda aprovada!',expect.objectContaining({
   body:'Produto real',tag:'sale:tx-1',data:expect.objectContaining({route:'/app/transacoes/tx-1',eventId:'sale:tx-1'})
  }))
 })

 it('deduplica notificações visíveis pelo eventId/tag',async()=>{
  const worker=loadWorker([{}])
  await dispatch(worker.listeners.get('push')!,{
   data:{json:()=>({eventId:'event-1',title:'Duplicada',body:'Não exibir',route:'/app'})}
  })
  expect(worker.showNotification).not.toHaveBeenCalled()
 })

 it('fecha a notificação, navega e foca uma aba existente',async()=>{
  const worker=loadWorker()
  const close=vi.fn()
  await dispatch(worker.listeners.get('notificationclick')!,{
   notification:{close,data:{route:'/app/transacoes/tx-1'}}
  })
  expect(close).toHaveBeenCalled()
  expect(worker.navigate).toHaveBeenCalledWith('/app/transacoes/tx-1')
  expect(worker.focus).toHaveBeenCalled()
  expect(worker.openWindow).not.toHaveBeenCalled()
 })
})
