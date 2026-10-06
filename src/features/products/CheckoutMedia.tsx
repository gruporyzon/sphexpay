import {useState} from 'react'
import {ImageOff,ImagePlus,Video} from 'lucide-react'
import type {CheckoutBlock} from './checkoutService'
import {safeCheckoutUrl} from './checkoutMedia'

export function CheckoutMedia({block}:{block:CheckoutBlock}) {
  const p=block.props,url=safeCheckoutUrl(p.url),video=block.type==='video'||p.mediaKind==='video'
  const [failed,setFailed]=useState('')
  const missing=!url||Boolean(url)&&failed===url
  const ratio=['16/9','21/9','4/3','1/1','auto'].includes(String(p.ratio))?String(p.ratio):'16/9'
  const fit=p.fit==='contain'?'contain':'cover'
  return <figure className={`co-media ${video?'co-media-video':''}`} style={{aspectRatio:ratio==='auto'?undefined:ratio,borderRadius:Math.max(0,Math.min(40,Number(p.radius??16))),background:/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(String(p.background))?String(p.background):undefined}}>
    {missing?<div className="co-media-empty">{Boolean(url)&&failed===url?<ImageOff/>:video?<Video/>:<ImagePlus/>}<span>{Boolean(url)&&failed===url?'Mídia indisponível':video?'Adicione seu vídeo de apresentação':'Adicione o banner do seu produto'}</span></div>
      :video?<video key={url} src={url} poster={safeCheckoutUrl(p.poster)||undefined} controls playsInline preload="metadata" muted={Boolean(p.autoplay)} autoPlay={Boolean(p.autoplay)&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches} loop={Boolean(p.loop)} style={{objectFit:fit}} onError={()=>setFailed(url)} aria-label={String(p.alt||'Vídeo do produto')}/>
      :<img key={url} src={url} alt={String(p.alt||'Apresentação do produto')} loading="lazy" decoding="async" style={{objectFit:fit}} onError={()=>setFailed(url)}/>}
    {p.caption&&<figcaption>{String(p.caption)}</figcaption>}
  </figure>
}
