import { useCallback,useEffect,useState } from 'react'
import { pwaInstallService } from '../services/pwaInstallService'
export function usePwaInstall(){
 const [,refresh]=useState(0),[worker,setWorker]=useState<ServiceWorkerRegistration|null>(null),[message,setMessage]=useState('')
 const installed=window.matchMedia('(display-mode: standalone)').matches||('standalone'in navigator&&Boolean((navigator as Navigator&{standalone?:boolean}).standalone)),ios=/iphone|ipad|ipod/i.test(navigator.userAgent),prompt=pwaInstallService.getPrompt()
 useEffect(()=>pwaInstallService.subscribe(()=>refresh(value=>value+1)),[])
 useEffect(()=>{let active=true;navigator.serviceWorker?.ready.then(registration=>{if(active)setWorker(registration)}).catch(()=>{if(active)setWorker(null)});return()=>{active=false}},[])
 const install=useCallback(async()=>{const current=pwaInstallService.getPrompt();if(!current){setMessage(ios?'No Safari, use Compartilhar e selecione “Adicionar à Tela de Início”.':'A instalação não está disponível neste navegador no momento.');return}await current.prompt();const result=await current.userChoice;setMessage(result.outcome==='accepted'?'Instalação iniciada.':'Instalação cancelada.');pwaInstallService.clear()},[ios])
 const update=async()=>{if(!worker){setMessage('Service worker ainda não está ativo.');return}await worker.update();if(worker.waiting){worker.waiting.postMessage({type:'SKIP_WAITING'});setMessage('Atualização pronta. Recarregue a aplicação.')}else setMessage('A versão mais recente já está ativa.')}
 const clearCache=async()=>{if(!('caches'in window)){setMessage('Cache offline indisponível.');return}await Promise.all((await caches.keys()).map(key=>caches.delete(key)));setMessage('Cache offline limpo.')}
 return{canInstall:Boolean(prompt),installed,ios,worker,message,install,update,clearCache}
}
