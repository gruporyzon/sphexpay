import { useCallback,useEffect,useMemo,useState } from 'react'
import { competitionStatus } from '../config/competition'
import { competitionService } from '../services/competitionService'
import { sortStandings,type CompetitionStanding } from '../services/competitionEngine'

export function useCompetition(userId?:string){
 const [standings,setStandings]=useState<CompetitionStanding[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[updatedAt,setUpdatedAt]=useState(''),[realtime,setRealtime]=useState<'live'|'reconnecting'|'unavailable'>('reconnecting')
 const refresh=useCallback(async()=>{try{const snapshot=await competitionService.load();setStandings(sortStandings(snapshot.standings));setUpdatedAt(snapshot.updatedAt);setError('');setRealtime(snapshot.source==='supabase'?'live':'unavailable')}catch{setError('Não foi possível carregar o ranking agora.');setRealtime('reconnecting')}finally{setLoading(false)}},[])
 useEffect(()=>{void refresh();const channel=competitionService.subscribe(()=>void refresh());const poll=window.setInterval(()=>void refresh(),120_000);return()=>{window.clearInterval(poll);competitionService.disconnect(channel)}},[refresh])
 const me=useMemo(()=>standings.find(row=>row.userId===userId),[standings,userId]),position=me?standings.findIndex(row=>row.userId===userId)+1:null
 return{standings,me,position,loading,error,updatedAt,realtime,status:competitionStatus(),refresh}
}
