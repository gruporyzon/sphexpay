import {useEffect} from 'react'

type HeaderMenu='language'|'profile'|'notifications'
export function useHeaderMenu(name:HeaderMenu,open:boolean,close:()=>void){
 useEffect(()=>{const listener=(event:Event)=>{if((event as CustomEvent<HeaderMenu>).detail!==name)close()};window.addEventListener('sphexpay:header-menu',listener);return()=>window.removeEventListener('sphexpay:header-menu',listener)},[name,close])
 useEffect(()=>{if(open)window.dispatchEvent(new CustomEvent<HeaderMenu>('sphexpay:header-menu',{detail:name}))},[name,open])
}
