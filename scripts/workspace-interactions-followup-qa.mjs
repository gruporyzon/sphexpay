import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawn} from 'node:child_process'
import path from 'node:path'
const base=process.env.QA_BASE_URL||'http://localhost:4176'
let server
if(!process.env.QA_BASE_URL){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4176'],{env:{...process.env,VITE_SUPABASE_URL:'https://sphexpay-qa.invalid',VITE_SUPABASE_PUBLISHABLE_KEY:'qa-public-placeholder'},stdio:'ignore'})
 for(let attempt=0;attempt<100;attempt++){try{if((await fetch(base)).ok)break}catch{};await new Promise(resolve=>setTimeout(resolve,100))}
}
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'QA fixtures are restricted to local development')
const output=process.env.QA_OUTPUT||'docs/workspace-interactions-followup-qa'
fs.mkdirSync(output,{recursive:true})
const user={id:'00000000-0000-4000-8000-000000000001',email:'visual-qa@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{role:'admin',provider:'email'},user_metadata:{full_name:'Conta de revisão visual'},created_at:'2026-10-01T12:00:00Z',factors:[]}
const profile={user_id:user.id,username:'visual_qa',display_name:'Conta de revisão visual',bio:'Dados fictícios para revisão da interface',badges:[]}
const stamp='2026-10-20T12:00:00Z'
const products=[{id:'00000000-0000-4000-8000-000000000002',seller_id:user.id,name:'Produto de revisão com nome extenso para conferir quebra de linha',slug:'produto-qa',description:'Conteúdo fictício da validação visual.',category:'Cursos',tags:['QA'],price_cents:123456789,currency:'BRL',product_type:'digital',status:'active',billing_type:'one_time',created_at:stamp,updated_at:stamp,product_offers:[],payment_transactions:[]}]
let browser
const results=[],interactions=[]
let page
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.QA_BROWSER_PATH?{executablePath:process.env.QA_BROWSER_PATH}:{})})
 const context=await browser.newContext({deviceScaleFactor:1,hasTouch:true,reducedMotion:'no-preference'})
 await context.route('https://sphexpay-qa.invalid/**',async route=>{
  const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
  let data=[]
  if(url.pathname.endsWith('/auth/v1/user'))data=user
  else if(table==='social_profiles')data=url.searchParams.get('user_id')?.startsWith('neq.')?[]:profile
  else if(table==='social_posts')data=[{id:'qa-post',author_id:user.id,body:'Conteúdo fictício para conferir tipografia, ações e quebra de linha no feed.',created_at:stamp,updated_at:stamp,social_profiles:profile,social_post_media:[],social_likes:[],social_bookmarks:[]}]
  else if(table==='products')data=products
  else if(table==='list_my_showcase_products')data=products.map(p=>({...p,gross_sales_cents:123456789,showcase_published_at:stamp}))
  else if(table==='profiles')data={id:user.id,full_name:'Conta de revisão visual',onboarding_completed:true}
  else if(table==='get_dashboard_demo_access')data=false
  if(Array.isArray(data)&&route.request().headers().accept?.includes('vnd.pgrst.object+json'))data=data[0]||null
  await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify(data)})
 })
 await context.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:false,connected:false,onboardingStatus:'not_connected',onboardingComplete:false,chargesEnabled:false,payoutsEnabled:false,detailsSubmitted:false,requirements:{currentlyDue:[],eventuallyDue:[],pastDue:[]},items:[]})}))
 await context.routeWebSocket(/sphexpay-qa\.invalid/,ws=>ws.close())
 await context.addInitScript(({user})=>{
  if(!localStorage.getItem('sb-sphexpay-qa-auth-token')){
   const body=btoa(JSON.stringify({sub:user.id,role:'authenticated',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
   localStorage.setItem('sb-sphexpay-qa-auth-token',JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.'+body+'.fixture',refresh_token:'fixture-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}))
  }
 },{user})
 page=await context.newPage()
 page.setDefaultTimeout(30000)
 let errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/app/vendas',{waitUntil:'domcontentloaded'})
 await page.locator('.workspace-filter-bar').waitFor()
 const reminder=page.getByRole('button',{name:'Fazer depois',exact:true})
 if(await reminder.waitFor({state:'visible',timeout:5000}).then(()=>true).catch(()=>false)){await reminder.click();interactions.push('Existing KYC reminder opens and dismisses through its own UI')}
 await page.evaluate(()=>{
  const fixture=document.createElement('section');fixture.id='qa-long-controls';fixture.style.cssText='margin-top:600px;margin-bottom:250px;padding:24px;border:1px solid var(--line);border-radius:19px;'
  const form=document.createElement('form'),label=document.createElement('label'),select=document.createElement('select'),button=document.createElement('a')
  label.textContent='Lista de revisão';select.name='long-choice';select.className='input';select.style.cssText='width:100%;margin:12px 0 24px;';select.setAttribute('aria-label','Lista de revisão')
  for(let index=0;index<80;index++){const option=new Option(`Opção ${index} — produto de revisão com nome extenso`,String(index));option.disabled=index===77;select.append(option)}
  select.value='58';label.append(select);form.append(label);button.href='#qa-long-controls';button.className='btn';button.id='qa-link-button';button.textContent='Abrir revisão';form.append(button);fixture.append(form);document.querySelector('.reference-page').append(fixture)
 })
 const select=page.getByRole('combobox',{name:'Lista de revisão'}),button=page.locator('#qa-link-button')
 for(const width of (process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:[320,375,768,1024,1440,1920]))for(const theme of (process.env.QA_THEME?[process.env.QA_THEME]:['light','dark']))for(const locale of (process.env.QA_LOCALE?[process.env.QA_LOCALE]:['pt-BR','en-US','es-ES'])){
  await page.setViewportSize({width,height:900})
  await page.evaluate(async({theme,locale})=>{const {useDemoStore}=await import('/src/store/useDemoStore.ts');const {useAppLocale}=await import('/src/i18n/localeStore.ts');useDemoStore.getState().setTheme(theme);useAppLocale.getState().setLocale(locale)},{theme,locale})
  await select.click();const popup=page.getByRole('listbox');await popup.waitFor();await popup.evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)))
  const originalY=await page.evaluate(()=>scrollY)
  const inMenu=()=>popup.evaluate(e=>{const a=e.querySelector('[data-highlighted=true]'),r=e.getBoundingClientRect(),i=a.getBoundingClientRect();return i.top>=r.top&&i.bottom<=r.bottom})
  assert(await inMenu(),'Selected option is not revealed on opening')
  await select.press('End');assert(await inMenu(),'End leaves the highlighted option outside the menu')
  await select.press('Home');assert(await inMenu(),'Home leaves the highlighted option outside the menu')
  await select.press('End');const before=await popup.evaluate(e=>e.scrollTop)
  await popup.hover();await page.mouse.wheel(0,-220);await page.waitForTimeout(200)
  const after=await popup.evaluate(e=>e.scrollTop);assert(after<before,'Wheel does not scroll the menu')
  assert.equal(await page.evaluate(()=>scrollY),originalY,'Menu navigation scrolls the page')
  const visible=await popup.evaluate(e=>{const box=e.getBoundingClientRect();return [...e.querySelectorAll('[role=option]')].findIndex(o=>{const r=o.getBoundingClientRect();return r.top>=box.top+6&&r.bottom<=box.bottom-6&&o.getAttribute('aria-disabled')!=='true'})})
  assert(visible>=0);const option=popup.getByRole('option').nth(visible),scrollBeforeHover=await popup.evaluate(e=>e.scrollTop)
  await option.hover();assert.equal(await popup.evaluate(e=>e.scrollTop),scrollBeforeHover,'Hover snaps the list')
  const active=await select.getAttribute('aria-activedescendant')
  await popup.getByRole('option').nth(Math.min(visible+1,79)).dispatchEvent('pointermove',{pointerType:'touch'})
  assert.equal(await select.getAttribute('aria-activedescendant'),active,'Touch scrolling changes the keyboard highlight')
  if(process.env.QA_SCREENSHOT)await page.screenshot({path:path.join(output,`long-menu-${width}-${theme}.jpg`),type:'jpeg',quality:80})
  const choice=String(visible);await option.click();assert.equal(await select.inputValue(),choice)
  assert.equal(await page.locator('#qa-long-controls form').evaluate(e=>new FormData(e).get('long-choice')),choice)
  await select.click();await select.press('End');await select.press('Escape');assert.equal(await select.inputValue(),choice);assert(await select.evaluate(e=>e===document.activeElement))
  await button.hover();const box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(180)
  const pressed=await button.evaluate(e=>getComputedStyle(e).transform);assert(pressed.includes('0.97'),'Link button has no press feedback')
  await page.mouse.move(1,1);await page.mouse.up()
  const geometry=await select.boundingBox();assert(geometry.width<=width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width)
  results.push({width,theme,locale,originalY,before,after,pressed})
  console.log(JSON.stringify({width,theme,locale,passed:true}))
 }
 await page.emulateMedia({reducedMotion:'reduce'});await button.hover();const box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(180)
 assert.equal(await button.evaluate(e=>getComputedStyle(e).transform),'none');await page.mouse.move(1,1);await page.mouse.up()
 await select.click();assert.equal(await page.getByRole('listbox').evaluate(e=>getComputedStyle(e).animationName),'none');await select.press('Escape')
 interactions.push('Long menus: initial selection, keyboard, wheel, touch, hover, form values and focus without page jumps')
 interactions.push('Link button press feedback and reduced motion')
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({cases:results.length,results,interactions,errors},null,2))
 console.log(JSON.stringify({cases:results.length,interactions,errors}))
}finally{await browser?.close();server?.kill()}
