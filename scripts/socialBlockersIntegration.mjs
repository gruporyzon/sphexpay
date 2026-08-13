import {createClient} from '@supabase/supabase-js'

const url=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY
if(!url||!anon||!service)throw new Error('Execute com as variáveis do Supabase local.')
const admin=createClient(url,service),stamp=Date.now(),password=`Local-${stamp}-Aa1!`
const users=[]
const wait=(ms=600)=>new Promise(resolve=>setTimeout(resolve,ms))
const decode=value=>new Uint8Array(Buffer.from(value,'base64'))
const fixtures={'image/jpeg':decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k='),'image/png':decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),'image/webp':decode('UklGRhwAAABXRUJQVlA4IBAAAADQAQCdASoBAAEAAUAmJaQA')}
const makeImage=mime=>fixtures[mime]
const session=async(label)=>{const email=`social-${label}-${stamp}@example.invalid`,{data:{user},error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;users.push(user.id);const client=createClient(url,anon),{error:login}=await client.auth.signInWithPassword({email,password});if(login)throw login;await client.from('social_profiles').insert({user_id:user.id,username:`social_${label}_${String(stamp).slice(-6)}`,display_name:`Social ${label}`});return{client,user}}
const upload=async(client,mime,bytes,name='image.jpg',kind='posts',conversationId='')=>{const form=new FormData();form.append('file',new File([bytes],name,{type:mime}));form.append('kind',kind);if(conversationId)form.append('conversationId',conversationId);return client.functions.invoke('social-media-upload',{body:form})}
const directStorageSetup=process.env.DIRECT_STORAGE_SETUP==='1'
const placeFixture=async(user,mime,kind,conversationId='')=>{const extension=mime==='image/jpeg'?'jpg':mime.split('/')[1],suffix=kind==='messages'?`messages/${conversationId}`:kind,path=`${user.id}/${suffix}/${crypto.randomUUID()}.${extension}`,result=await admin.storage.from('social-media').upload(path,makeImage(mime),{contentType:mime});if(result.error)throw result.error;return{data:{path}}}

let A,B,C
try{
 A=await session('a');B=await session('b');C=await session('c')
 const {data:postId,error:postError}=await A.client.rpc('social_create_post',{p_body:'Busca checkout marketing vendas lançamento',p_reply_to:null,p_repost_of:null});if(postError)throw postError
 const {data:conversation,error:conversationError}=await A.client.rpc('social_open_conversation',{other_user:B.user.id});if(conversationError)throw conversationError
 const aMessages=[],bMessages=[],cMessages=[],aNotices=[],cNotices=[]
 const subscribe=async(client,table,filter,target)=>new Promise((resolve,reject)=>{const channel=client.channel(`${table}-${Math.random()}`).on('postgres_changes',{event:'INSERT',schema:'public',table,filter},payload=>target.push(payload.new)).subscribe(status=>{if(status==='SUBSCRIBED')resolve(channel);if(status==='CHANNEL_ERROR')reject(new Error(`${table} channel error`))})})
 const channels=await Promise.all([
  subscribe(A.client,'social_messages',`conversation_id=eq.${conversation}`,aMessages),subscribe(B.client,'social_messages',`conversation_id=eq.${conversation}`,bMessages),subscribe(C.client,'social_messages',`conversation_id=eq.${conversation}`,cMessages),
  subscribe(A.client,'social_notifications',`recipient_id=eq.${A.user.id}`,aNotices),subscribe(C.client,'social_notifications',`recipient_id=eq.${A.user.id}`,cNotices),
 ])
 await wait(1500)
 const must=async promise=>{const result=await promise;if(result.error)throw result.error;return result}
 await must(A.client.from('social_messages').insert({conversation_id:conversation,sender_id:A.user.id,body:'teste realtime A'}));await wait(1200)
 await must(B.client.from('social_messages').insert({conversation_id:conversation,sender_id:B.user.id,body:'teste realtime B'}));await wait(1200)
 await must(B.client.from('social_follows').insert({follower_id:B.user.id,following_id:A.user.id}))
 await must(B.client.from('social_likes').insert({user_id:B.user.id,post_id:postId}))
 await must(B.client.rpc('social_create_post',{p_body:'comentário realtime',p_reply_to:postId,p_repost_of:null}));await wait(1800)
 const valid={};let spoof,wrongMime,mismatchedImage,oversized
 if(!directStorageSetup){for(const [mime,ext] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]){const result=await upload(A.client,mime,makeImage(mime),`valid.${ext}`);valid[mime]=!result.error&&Boolean(result.data?.path)};spoof=await upload(A.client,'image/jpeg',new TextEncoder().encode('<script>alert(1)</script>'),'fake.jpg');wrongMime=await upload(A.client,'text/html',makeImage('image/jpeg'),'fake.jpg');mismatchedImage=await upload(A.client,'image/png',makeImage('image/jpeg'),'fake.png');oversized=await upload(A.client,'image/jpeg',new Uint8Array(10*1024*1024+1),'huge.jpg')}
 const avatar=directStorageSetup?await placeFixture(A.user,'image/png','avatars'):await upload(A.client,'image/png',makeImage('image/png'),'avatar.png','avatars');if(avatar.error)throw avatar.error
 await A.client.from('social_profiles').update({avatar_url:avatar.data.path}).eq('user_id',A.user.id)
 const signedA=await A.client.storage.from('social-media').createSignedUrl(avatar.data.path,60),signedB=await B.client.storage.from('social-media').createSignedUrl(avatar.data.path,60)
 await B.client.storage.from('social-media').remove([avatar.data.path]);const stillExistsAfterB=await A.client.storage.from('social-media').download(avatar.data.path)
 const directByB=await B.client.storage.from('social-media').upload(`${A.user.id}/posts/attack.jpg`,makeImage('image/jpeg'),{contentType:'image/jpeg'})
 const dmUpload=directStorageSetup?await placeFixture(A.user,'image/jpeg','messages',conversation):await upload(A.client,'image/jpeg',makeImage('image/jpeg'),'dm.jpg','messages',conversation);if(dmUpload.error)throw dmUpload.error
 await A.client.from('social_messages').insert({conversation_id:conversation,sender_id:A.user.id,body:'mídia privada',media_url:dmUpload.data.path})
 const dmB=await B.client.storage.from('social-media').createSignedUrl(dmUpload.data.path,60),dmC=await C.client.storage.from('social-media').createSignedUrl(dmUpload.data.path,60)
 const searchChecks={};for(const term of ['checkout','MARKETING','vendas','lançamento','lancamento']){const {data,error}=await A.client.rpc('social_search_posts',{search_query:term});searchChecks[term]=!error&&data.some(row=>row.id===postId)}
 const injection=await A.client.rpc('social_search_posts',{search_query:"' OR 1=1 --"})
 const {data:hiddenPost}=await B.client.rpc('social_create_post',{p_body:'conteúdo bloqueado exclusivo',p_reply_to:null,p_repost_of:null});await A.client.from('social_blocks').insert({blocker_id:A.user.id,blocked_id:B.user.id});const hiddenSearch=await A.client.rpc('social_search_posts',{search_query:'bloqueado'})
 for(const [index,channel] of channels.entries())await [A.client,B.client,C.client,A.client,C.client][index].removeChannel(channel)
 const result={
  realtime:{aToB:bMessages.some(x=>x.body==='teste realtime A'),bToA:aMessages.some(x=>x.body==='teste realtime B'),cIsolation:cMessages.length===0,notifications:aNotices.filter(x=>['follow','like','comment'].includes(x.type)).length===3,cNoticeIsolation:cNotices.length===0,cleanup:A.client.getChannels().length+B.client.getChannels().length+C.client.getChannels().length===0},
  mime:directStorageSetup?{edgeRuntime:'NOT_RUN'}:{valid,spoofBlocked:Boolean(spoof.error),wrongMimeBlocked:Boolean(wrongMime.error),mismatchBlocked:Boolean(mismatchedImage.error),oversizedBlocked:Boolean(oversized.error)},
  storage:{ownerSigned:!signedA.error,peerSigned:!signedB.error,crossDeleteBlocked:!stillExistsAfterB.error,directUploadBlocked:Boolean(directByB.error),dmMemberSigned:!dmB.error,dmOutsiderBlocked:Boolean(dmC.error)},
  search:{terms:Object.values(searchChecks).every(Boolean),termDetails:searchChecks,injectionSafe:!injection.error,blockedHidden:!hiddenSearch.error&&!hiddenSearch.data.some(row=>row.id===hiddenPost)},
 }
 if(Object.values(result.realtime).some(v=>!v)||(!directStorageSetup&&(Object.values(result.mime.valid).some(v=>!v)||Object.values(result.mime).filter(v=>typeof v==='boolean').some(v=>!v)))||Object.values(result.storage).some(v=>!v)||Object.entries(result.search).some(([key,value])=>key!=='termDetails'&&!value))throw new Error(JSON.stringify(result))
 console.log(JSON.stringify(result,null,2))
}finally{for(const sessionClient of [A?.client,B?.client,C?.client])if(sessionClient)await sessionClient.auth.signOut();for(const id of users)await admin.auth.admin.deleteUser(id)}
