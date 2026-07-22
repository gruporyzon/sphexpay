export interface InstallPromptEvent extends Event { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> }
type Listener=()=>void
let promptEvent:InstallPromptEvent|null=null,initialized=false
const listeners=new Set<Listener>()
const notify=()=>listeners.forEach(listener=>listener())
export const pwaInstallService={
 initialize(){if(initialized||typeof window==='undefined')return;initialized=true;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event as InstallPromptEvent;notify()});window.addEventListener('appinstalled',()=>{promptEvent=null;notify()})},
 getPrompt(){return promptEvent},
 clear(){promptEvent=null;notify()},
 subscribe(listener:Listener){listeners.add(listener);return()=>{listeners.delete(listener)}}
}
