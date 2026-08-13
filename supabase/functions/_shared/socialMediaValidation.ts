export const SOCIAL_IMAGE_MAX_BYTES=10*1024*1024
export const SOCIAL_IMAGE_MIMES=['image/jpeg','image/png','image/webp'] as const
export type SocialImageMime=typeof SOCIAL_IMAGE_MIMES[number]

const ascii=(bytes:Uint8Array,start:number,length:number)=>new TextDecoder().decode(bytes.slice(start,start+length))
const uint32be=(bytes:Uint8Array,offset:number)=>(bytes[offset]*0x1000000)+(bytes[offset+1]<<16)+(bytes[offset+2]<<8)+bytes[offset+3]
const uint32le=(bytes:Uint8Array,offset:number)=>bytes[offset]+(bytes[offset+1]<<8)+(bytes[offset+2]<<16)+(bytes[offset+3]*0x1000000)

function validPng(bytes:Uint8Array){
 const signature=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]
 return bytes.length>=45&&signature.every((value,index)=>bytes[index]===value)&&uint32be(bytes,8)===13&&ascii(bytes,12,4)==='IHDR'&&uint32be(bytes,16)>0&&uint32be(bytes,20)>0&&ascii(bytes,bytes.length-8,4)==='IEND'
}
function validJpeg(bytes:Uint8Array){
 if(bytes.length<20||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return false
 let offset=2,hasFrame=false
 while(offset+3<bytes.length-2){
  if(bytes[offset]!==0xff)return false
  while(bytes[offset]===0xff)offset++
  const marker=bytes[offset++];if(marker===0xd9)break
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue
  if(offset+1>=bytes.length)return false
  const length=(bytes[offset]<<8)+bytes[offset+1]
  if(length<2||offset+length>bytes.length)return false
  if(marker>=0xc0&&marker<=0xc3&&length>=8)hasFrame=bytes[offset+3]>0||bytes[offset+4]>0
  if(marker===0xda)return hasFrame
  offset+=length
 }
 return hasFrame
}
function validWebp(bytes:Uint8Array){
 if(bytes.length<20||ascii(bytes,0,4)!=='RIFF'||ascii(bytes,8,4)!=='WEBP')return false
 const declared=uint32le(bytes,4)+8
 return declared===bytes.length&&['VP8 ','VP8L','VP8X'].includes(ascii(bytes,12,4))&&uint32le(bytes,16)>0&&20+uint32le(bytes,16)<=bytes.length
}

const validators:Record<SocialImageMime,(bytes:Uint8Array)=>boolean>={'image/jpeg':validJpeg,'image/png':validPng,'image/webp':validWebp}
const extensions:Record<SocialImageMime,readonly string[]>={'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']}

export function validateSocialImage(file:{name:string;type:string;size:number},bytes:Uint8Array){
 if(file.size!==bytes.length||file.size<20||file.size>SOCIAL_IMAGE_MAX_BYTES)return{ok:false as const,code:'INVALID_SIZE'}
 if(!SOCIAL_IMAGE_MIMES.includes(file.type as SocialImageMime))return{ok:false as const,code:'INVALID_MIME'}
 const mime=file.type as SocialImageMime,extension=file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
 if(!extension||!extensions[mime].includes(extension))return{ok:false as const,code:'EXTENSION_MISMATCH'}
 if(!validators[mime](bytes))return{ok:false as const,code:'MIME_SIGNATURE_MISMATCH'}
 return{ok:true as const,mime,extension:extensions[mime][0]}
}
