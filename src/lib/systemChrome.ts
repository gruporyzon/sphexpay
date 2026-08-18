import type { Theme } from '../types'

export function syncSystemChrome(pathname:string,theme:Theme){
 const internal=pathname==='/onboarding'||pathname.startsWith('/app')
 const color=internal?(theme==='dark'?'#090909':'#f5f5f2'):'#000000'
 const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
 if(meta)meta.content=color
 document.documentElement.dataset.topSurface=internal?'app':'public'
}
