import type { Theme } from '../types'

export function syncSystemChrome(pathname:string,theme:Theme){
 const internal=pathname.startsWith('/app')||pathname.startsWith('/dev/workspace-preview')
 const color=internal?(theme==='dark'?'#000000':'#ffffff'):'#000000'
 const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
 if(meta)meta.content=color
 document.documentElement.dataset.topSurface=internal?'app':'public'
}
