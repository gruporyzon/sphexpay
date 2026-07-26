import { useEffect,useState } from 'react'
import { dashboardService } from '../services/dashboardService'

export function useDashboardAdmin(userId:string|undefined){
 const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(Boolean(userId)),[error,setError]=useState('')
 useEffect(()=>{if(!userId){setAllowed(false);setLoading(false);return}let active=true;setLoading(true);setError('');dashboardService.loadAdminAccess().then(value=>{if(active)setAllowed(value)}).catch(reason=>{console.warn('[Dashboard] Não foi possível validar a autorização administrativa.',reason instanceof Error?reason.message:'erro');if(active){setAllowed(false);setError('Não foi possível validar o acesso administrativo.')}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[userId])
 return{allowed,loading,error}
}
