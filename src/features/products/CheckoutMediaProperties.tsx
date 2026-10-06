import {useEffect,useRef,useState} from 'react'
import {ImagePlus,Upload,Video,LoaderCircle} from 'lucide-react'
import type {CheckoutBlock} from './checkoutService'
import {checkoutMediaAccept,safeCheckoutUrl,uploadCheckoutMedia} from './checkoutMedia'

export function CheckoutMediaProperties({block,sellerId,checkoutId,update,onBusy}:{block:CheckoutBlock;sellerId:string;checkoutId:string;update:(props:Record<string,unknown>)=>void;onBusy:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),alive=useRef(true),updateRef=useRef(update),busyRef=useRef(onBusy)
 updateRef.current=update;busyRef.current=onBusy
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;busyRef.current(false)}},[])
 const video=block.type==='video'||block.props.mediaKind==='video',p=block.props
 const upload=async(file:File|undefined,poster=false)=>{if(!file||busy)return;setError('');setBusy(true);onBusy(true);try{if((poster||block.type==='image'||block.type==='logo')&&!file.type.startsWith('image/'))throw new Error('Escolha uma imagem para a capa.');if(block.type==='video'&&!poster&&!file.type.startsWith('video/'))throw new Error('Escolha um vídeo MP4 ou WebM.');const result=await uploadCheckoutMedia(sellerId,checkoutId,file);if(alive.current)updateRef.current(poster?{poster:result.url}:{url:result.url,mediaKind:result.kind})}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Falha no envio.')}finally{if(alive.current)setBusy(false);busyRef.current(false)}}
 const urlError=String(p.url||'')&&!safeCheckoutUrl(p.url)
 return <div className="co-media-properties">
  {block.type==='banner'&&<label>Tipo de banner<select className="input" value={video?'video':'image'} onChange={e=>update({mediaKind:e.target.value,url:'',poster:''})}><option value="image">Imagem</option><option value="video">Vídeo</option></select></label>}
  <label className={`co-upload ${busy?'busy':''}`}>{busy?<LoaderCircle className="spin"/>:video?<Video/>:<ImagePlus/>}<b>{busy?'Enviando mídia…':'Enviar arquivo'}</b><span>Imagens até 5 MB · MP4 / WebM até 25 MB</span><input type="file" accept={block.type==='image'||block.type==='logo'?'image/jpeg,image/png,image/webp':block.type==='video'?'video/mp4,video/webm':checkoutMediaAccept} disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file)}}/><Upload/></label>
  <label>Ou use uma URL HTTPS<input className="input" type="url" placeholder={video?'https://.../video.mp4':'https://.../banner.jpg'} value={String(p.url||'')} onChange={e=>update({url:e.target.value})}/></label>
  {urlError&&<p role="alert" className="co-property-error">Informe uma URL HTTPS válida.</p>}
  {video&&<><p className="muted">Use um link direto de MP4/WebM. Links de páginas do YouTube não são arquivos de vídeo.</p><label>Imagem de capa (opcional)<input className="input" type="url" value={String(p.poster||'')} onChange={e=>update({poster:e.target.value})}/></label><label className="co-poster-upload">Enviar capa<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file,true)}}/></label><label className="pv2-switch"><span>Reproduzir automaticamente sem som</span><input type="checkbox" checked={Boolean(p.autoplay)} onChange={e=>update({autoplay:e.target.checked})}/><i/></label><label className="pv2-switch"><span>Repetir vídeo</span><input type="checkbox" checked={Boolean(p.loop)} onChange={e=>update({loop:e.target.checked})}/><i/></label></>}
  <label>Descrição acessível<input className="input" value={String(p.alt||'')} onChange={e=>update({alt:e.target.value.slice(0,250)})}/></label>
  <label>Legenda (opcional)<input className="input" value={String(p.caption||'')} onChange={e=>update({caption:e.target.value.slice(0,250)})}/></label>
  {block.type!=='logo'&&<><label>Proporção<select className="input" value={String(p.ratio||'16/9')} onChange={e=>update({ratio:e.target.value})}><option value="21/9">Panorâmico · 21:9</option><option value="16/9">Vídeo · 16:9</option><option value="4/3">Clássico · 4:3</option><option value="1/1">Quadrado · 1:1</option><option value="auto">Proporção original</option></select></label><label>Ajuste da mídia<select className="input" value={String(p.fit||'cover')} onChange={e=>update({fit:e.target.value})}><option value="cover">Preencher o banner</option><option value="contain">Mostrar conteúdo inteiro</option></select></label></>}
  {error&&<p className="co-property-error" role="alert">{error}</p>}
 </div>
}
