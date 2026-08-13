import {describe,expect,it} from 'vitest'
import {SOCIAL_IMAGE_MAX_BYTES,validateSocialImage} from '../../supabase/functions/_shared/socialMediaValidation'

const decode=(value:string)=>new Uint8Array(Buffer.from(value,'base64'))
const images={
 jpeg:decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k='),
 png:decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
 webp:decode('UklGRhwAAABXRUJQVlA4IBAAAADQAQCdASoBAAEAAUAmJaQA'),
}
const file=(name:string,type:string,bytes:Uint8Array)=>({name,type,size:bytes.length})

describe('validação server-side de mídia Social',()=>{
 it.each([['foto.jpg','image/jpeg',images.jpeg],['foto.png','image/png',images.png],['foto.webp','image/webp',images.webp]])('aceita %s válida', (name,type,bytes)=>expect(validateSocialImage(file(name,type,bytes),bytes).ok).toBe(true))
 it('bloqueia JavaScript renomeado para JPG',()=>{const bytes=new TextEncoder().encode('console.log("ataque executável disfarçado")');expect(validateSocialImage(file('foto.jpg','image/jpeg',bytes),bytes)).toMatchObject({ok:false,code:'MIME_SIGNATURE_MISMATCH'})})
 it('bloqueia HTML renomeado para PNG',()=>{const bytes=new TextEncoder().encode('<html><script>alert(1)</script></html>');expect(validateSocialImage(file('imagem.png','image/png',bytes),bytes)).toMatchObject({ok:false,code:'MIME_SIGNATURE_MISMATCH'})})
 it('bloqueia arquivo enorme',()=>{const bytes=new Uint8Array(SOCIAL_IMAGE_MAX_BYTES+1);expect(validateSocialImage(file('foto.jpg','image/jpeg',bytes),bytes)).toMatchObject({ok:false,code:'INVALID_SIZE'})})
 it('bloqueia MIME e extensão incompatíveis',()=>expect(validateSocialImage(file('foto.png','image/jpeg',images.jpeg),images.jpeg)).toMatchObject({ok:false,code:'EXTENSION_MISMATCH'}))
})
