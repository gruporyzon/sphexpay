import {supabase} from '../../lib/supabase'

export const checkoutMediaTypes = ['image/jpeg','image/png','image/webp','video/mp4','video/webm'] as const
export const checkoutMediaAccept = checkoutMediaTypes.join(',')
export const safeCheckoutUrl = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 4096) return ''
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : ''
  } catch { return '' }
}
export const checkoutPublicUrl = (id:string, origin=window.location.origin) => `${origin}/pay/${encodeURIComponent(id)}`

export async function validateCheckoutMedia(file:File) {
  if (!checkoutMediaTypes.includes(file.type as typeof checkoutMediaTypes[number])) throw new Error('Use JPG, PNG, WebP, MP4 ou WebM.')
  const video = file.type.startsWith('video/')
  if (!file.size || file.size > (video ? 25 : 5)*1024*1024) throw new Error(video ? 'O vídeo pode ter até 25 MB. Comprima-o ou use uma URL HTTPS.' : 'A imagem pode ter até 5 MB.')
  const bytes = new Uint8Array(await file.slice(0,32).arrayBuffer())
  const text = (start:number,end:number) => String.fromCharCode(...bytes.slice(start,end))
  const valid = file.type==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
    : file.type==='image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)
    : file.type==='image/webp' ? text(0,4)==='RIFF' && text(8,12)==='WEBP'
    : file.type==='video/mp4' ? text(4,8)==='ftyp'
    : [26,69,223,163].every((v,i)=>bytes[i]===v)
  if (!valid) throw new Error('O conteúdo do arquivo não corresponde ao formato informado.')
  return video ? 'video' : 'image'
}

export async function uploadCheckoutMedia(sellerId:string, checkoutId:string, file:File) {
  const kind = await validateCheckoutMedia(file)
  if (!supabase) throw new Error('Armazenamento indisponível. Tente novamente.')
  const extensions:Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}
  const path = `${sellerId}/${checkoutId}/${crypto.randomUUID()}.${extensions[file.type]}`
  const {error} = await supabase.storage.from('checkout-media').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'})
  if (error) throw new Error('Não foi possível enviar o arquivo. Confira sua conexão e tente novamente.')
  return {kind,url:supabase.storage.from('checkout-media').getPublicUrl(path).data.publicUrl}
}
