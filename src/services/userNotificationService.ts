import type { RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { AppNotification } from '../types'

// Central de notificações real: linhas de user_notifications criadas por triggers do banco
// (contestações, verificação e premiações; vendas vão por Push). O usuário só marca como
// lida, arquiva ou apaga as próprias notificações (RLS).
const COLUMNS='id,kind,category,title,description,detail_path,priority,metadata,read_at,archived_at,created_at'

export const notificationFromRow=(row:Record<string,unknown>):AppNotification=>({
 id:String(row.id),kind:row.kind as AppNotification['kind'],category:row.category as AppNotification['category'],
 title:String(row.title||''),description:String(row.description||''),createdAt:String(row.created_at),
 read:Boolean(row.read_at),archived:Boolean(row.archived_at),priority:(row.priority as AppNotification['priority'])||'normal',
 detailPath:typeof row.detail_path==='string'?row.detail_path:undefined,
 metadata:row.metadata&&typeof row.metadata==='object'?{...(row.metadata as AppNotification['metadata']),source:'backend'}:{source:'backend'}
})

type State={userId:string|null;items:AppNotification[];status:'idle'|'loading'|'ready'|'error';channel:RealtimeChannel|null
 start:(userId:string|null)=>void;reload:()=>Promise<void>;read:(id:string)=>void;readAll:()=>void;archive:(id:string)=>void;remove:(id:string)=>void;clear:()=>void}

const sortItems=(items:AppNotification[])=>[...items].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
const upsert=(items:AppNotification[],item:AppNotification)=>sortItems([item,...items.filter(current=>current.id!==item.id)])

export const useUserNotifications=create<State>((set,get)=>({
 userId:null,items:[],status:'idle',channel:null,
 start:userId=>{
  if(get().userId===userId)return
  const previous=get().channel
  if(previous)void supabase?.removeChannel(previous)
  set({userId,items:[],status:userId?'loading':'idle',channel:null})
  if(!userId||!supabase)return
  void get().reload()
  const channel=supabase.channel(`user-notifications:${userId}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'user_notifications',filter:`user_id=eq.${userId}`},payload=>set(state=>({items:upsert(state.items,notificationFromRow(payload.new as Record<string,unknown>))})))
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'user_notifications',filter:`user_id=eq.${userId}`},payload=>set(state=>({items:upsert(state.items,notificationFromRow(payload.new as Record<string,unknown>))})))
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'user_notifications',filter:`user_id=eq.${userId}`},payload=>set(state=>({items:state.items.filter(item=>item.id!==String((payload.old as Record<string,unknown>).id))})))
   .subscribe()
  set({channel})
 },
 reload:async()=>{
  const userId=get().userId
  if(!userId||!supabase)return
  const {data,error}=await supabase.from('user_notifications').select(COLUMNS).eq('user_id',userId).order('created_at',{ascending:false}).limit(100)
  if(get().userId!==userId)return
  if(error){set({status:'error'});return}
  set({items:(data||[]).map(row=>notificationFromRow(row as Record<string,unknown>)),status:'ready'})
 },
 read:id=>{
  set(state=>({items:state.items.map(item=>item.id===id?{...item,read:true}:item)}))
  void supabase?.from('user_notifications').update({read_at:new Date().toISOString()}).eq('id',id).is('read_at',null)
 },
 readAll:()=>{
  const userId=get().userId
  set(state=>({items:state.items.map(item=>({...item,read:true}))}))
  if(userId)void supabase?.from('user_notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId).is('read_at',null)
 },
 archive:id=>{
  set(state=>({items:state.items.map(item=>item.id===id?{...item,archived:true,read:true}:item)}))
  const now=new Date().toISOString()
  void supabase?.from('user_notifications').update({archived_at:now,read_at:now}).eq('id',id)
 },
 remove:id=>{
  set(state=>({items:state.items.filter(item=>item.id!==id)}))
  void supabase?.from('user_notifications').delete().eq('id',id)
 },
 clear:()=>{
  const userId=get().userId
  set({items:[]})
  if(userId)void supabase?.from('user_notifications').delete().eq('user_id',userId)
 }
}))
