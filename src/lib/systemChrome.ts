import type { Theme } from '../types'

export function syncSystemChrome(pathname:string,theme:Theme){
 const internal=pathname==='/onboarding'||pathname.startsWith('/app')||pathname.startsWith('/dev/workspace-preview')
 const color=internal?(theme==='dark'?'#0b0d12':'#f5f6f9'):'#000000'
 const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
 if(meta)meta.content=color
 document.documentElement.dataset.topSurface=internal?'app':'public'
}
