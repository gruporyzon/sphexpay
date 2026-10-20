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
const output=process.env.QA_OUTPUT||'docs/workspace-interactions-qa'
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
 const visit=async route=>{
  await page.evaluate(route=>{history.pushState({},'', '/app/'+route);dispatchEvent(new PopStateEvent('popstate'))},route)
  await page.waitForTimeout(100)
  await page.locator('.reference-page').waitFor()
  await page.waitForFunction(async({route,ready})=>{const {translate}=await import('/src/i18n/index.ts');const headings=[...document.querySelectorAll('.reference-page h1')];if(!route)return !!document.querySelector('.reference-dashboard h1');return headings.some(h=>h.textContent.trim().startsWith(translate(ready[route])))},{route,ready:{"":"","produtos":"Produtos","produtos/checkout":"Seu produto merece","produtos/links":"Links de pagamento","vendas-ao-vivo":"Vendas ao Vivo","vendas":"Vendas","vitrine":"Vitrine","assinaturas":"Assinaturas","financeiro":"Financeiro","financeiro/saques":"Financeiro","verificacao":"Documentos e liberação da operação","afiliados":"Afiliados","premiacoes":"Premiações","relatorios":"Relatórios","relatorios/clientes":"Relatórios","notificacoes":"Notificações","configuracoes":"Configurações","integracoes":"Integrações","social":"Social","competicao":"Rumo ao iPhone 17 Pro Max"}},{timeout:15000})
  await page.locator('.loading-state,.co-hub-loading').first().waitFor({state:'hidden',timeout:12000}).catch(()=>{})
  await page.evaluate(()=>document.fonts.ready)
  if(route==='produtos')await page.locator('.pv2-stats strong').first().waitFor({timeout:30000})
  if(route==='assinaturas')await page.locator('.subscriptions-value').first().waitFor({timeout:30000})
  if(route==='social')await page.locator('.social-page').waitFor({timeout:12000})
  await page.waitForTimeout(80)
 }
 const motion=async(group,index=1)=>{
  await group.waitFor();await page.waitForTimeout(300)
  const buttons=group.locator(':scope>button,:scope>a')
  const initial=await group.evaluate(e=>{
   e.qaTransitions=[]
   e.qaTransitionListener=event=>{if(event.target===e&&event.pseudoElement==='::before'&&event.propertyName==='transform')e.qaTransitions.push({type:event.type,elapsed:event.elapsedTime})}
   e.addEventListener('transitionrun',e.qaTransitionListener);e.addEventListener('transitionend',e.qaTransitionListener)
   return getComputedStyle(e,'::before').transform
  })
  await buttons.nth(index).click()
  await page.waitForTimeout(350)
  const settled=await group.evaluate(e=>{
   const result={transform:getComputedStyle(e,'::before').transform,width:getComputedStyle(e,'::before').width,bg:getComputedStyle(e,'::before').backgroundColor,ready:e.dataset.selectionMotion,transitions:e.qaTransitions}
   e.removeEventListener('transitionrun',e.qaTransitionListener);e.removeEventListener('transitionend',e.qaTransitionListener);delete e.qaTransitions;delete e.qaTransitionListener
   return result
  })
  assert.equal(settled.ready,'ready');assert.notEqual(initial,settled.transform);assert(settled.transitions.some(e=>e.type==='transitionrun')&&settled.transitions.some(e=>e.type==='transitionend'&&e.elapsed>.2),'Selection must run and finish its transform transition');assert(parseFloat(settled.width)>0)
  return settled
 }
 await page.goto(base+'/app/vendas',{waitUntil:'domcontentloaded'})
 await page.locator('.workspace-filter-bar').waitFor()
 for(const width of (process.env.QA_ONLY_INTERACTIONS?[]:[320,393,820,1366]))for(const theme of ['light','dark'])for(const locale of ['pt-BR','en-US','es-ES']){
  await page.setViewportSize({width,height:900})
  await page.evaluate(async({theme,locale})=>{const {useDemoStore}=await import('/src/store/useDemoStore.ts');const {useAppLocale}=await import('/src/i18n/localeStore.ts');useDemoStore.getState().setTheme(theme);useAppLocale.getState().setLocale(locale)},{theme,locale})
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350)
  const groups=page.locator('.workspace-filter-bar .workspace-segments')
  await groups.first().locator('button').first().click();await page.waitForTimeout(300)
  const selection=await motion(groups.first())
  await groups.nth(1).locator('button').nth(2).click()
  assert.equal(await groups.nth(1).locator('button').nth(2).getAttribute('aria-pressed'),'true')
  const select=page.locator('.transactions-filter select')
  await select.click();const popup=page.getByRole('listbox');await popup.waitFor()
  await popup.evaluate(e=>Promise.all(e.getAnimations().map(animation=>animation.finished)))
  const geometry=await popup.evaluate(e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,animation:getComputedStyle(e).animationName}})
  assert(geometry.left>=0&&geometry.right<=width&&geometry.top>=0&&geometry.bottom<=900,'Menu leaves viewport')
  assert.equal(geometry.animation,'workspace-menu-in')
  await popup.getByRole('option').nth(1).click();assert.notEqual(await select.inputValue(),'all')
  assert(await select.evaluate(e=>e===document.activeElement))
  const previous=await select.inputValue();await select.press('ArrowDown');await select.press('End');await select.press('Escape');assert.equal(await select.inputValue(),previous)
  await select.press('ArrowDown');await select.press('Home');await select.press('Enter');assert.equal(await select.inputValue(),'all')
  const details=page.locator('.workspace-period-control details')
  await details.locator('summary').click();const period=details.locator('select');await period.click();await page.getByRole('option').last().click()
  const dates=details.locator('input[type=date]');assert.equal(await dates.count(),2);await dates.first().fill('2026-10-01');await dates.last().fill('2026-10-20')
  assert(await dates.evaluateAll(inputs=>{const [first,last]=inputs.map(e=>e.getBoundingClientRect()),panel=inputs[0].closest('details').lastElementChild.getBoundingClientRect();return first.bottom<last.top&&first.left>=panel.left&&first.right<=panel.right&&last.right<=panel.right}),'Custom dates overlap or leave the panel')
  await page.keyboard.press('Escape');assert.equal(await details.getAttribute('open'),null)
  await groups.first().locator('button').first().click()
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,font:document.fonts.check('400 12px SphexDashboard')}))
  assert(layout.scroll<=width,'Document overflow');assert.equal(layout.lang,locale);assert.equal(layout.theme,theme);assert(layout.font)
  results.push({width,theme,locale,selection,geometry,layout})
  if(locale==='pt-BR'&&((width===393&&theme==='dark')||(width===1366&&theme==='light'))){await select.click();await page.waitForTimeout(200);await page.screenshot({path:path.join(output,`sales-${width}-${theme}.jpg`),type:'jpeg',quality:80,fullPage:true});await page.keyboard.press('Escape')}
  console.log(JSON.stringify({width,theme,locale,passed:true}))
 }
 if(results.length)fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({cases:results.length,results,interactions,errors},null,2))
 interactions.push('24 sales combinations: animated periods/currencies, status menu, keyboard, cancel, custom dates, bounds and focus')
 await page.setViewportSize({width:1366,height:900})
 await page.evaluate(async()=>{const {useAppLocale}=await import('/src/i18n/localeStore.ts');useAppLocale.getState().setLocale('pt-BR')})
 for(const [route,selector] of [['assinaturas','.subscriptions-tabs'],['social','.social-tabs'],['vitrine','.vitrine-filters'],['financeiro','.financial-module-tabs']]){
  console.log(JSON.stringify({interaction:route}));await visit(route);await motion(page.locator(selector));interactions.push(route+' sliding selection')
 }
 await visit('produtos')
 const productSelect=page.locator('.pv2-toolbar select').first();await productSelect.click();await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape')
 interactions.push('Product filter shares the animated listbox')
 await page.getByRole('button',{name:'Novo produto',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor()
 const modalSelect=dialog.locator('select').first();if(await modalSelect.count()){await modalSelect.click();await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape');assert(await dialog.isVisible())}
 await dialog.locator('button').first().click()
 interactions.push('Product modal opens and select Escape preserves dialog')
 await visit('vendas')
 await motion(page.locator('.reference-navigation'),2)
 await page.locator('.pv2-stats').waitFor()
 interactions.push('Module navigation keeps its sliding indicator and changes the page')
 await visit('vendas');await page.setViewportSize({width:393,height:900})
 const status=page.locator('.transactions-filter select'),box=await status.boundingBox()
 await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2)
 await page.getByRole('listbox').waitFor();await page.getByRole('listbox').getByRole('option').nth(1).tap()
 assert.notEqual(await status.inputValue(),'all')
 await page.locator('.transactions-filter>span').tap();await page.getByRole('listbox').waitFor()
 await page.locator('.transactions-filter>span').tap();assert.equal(await page.getByRole('listbox').count(),0)
 await page.locator('.workspace-period-control summary').tap();await page.locator('.workspace-period-control select').tap()
 await page.getByRole('listbox').getByRole('option').last().tap();await page.screenshot({path:path.join(output,'sales-custom-393.jpg'),type:'jpeg',quality:80,fullPage:true})
 await page.keyboard.press('Escape')
 interactions.push('Touch selection and advanced period panel on mobile')
 await visit('vendas');await page.emulateMedia({reducedMotion:'reduce'})
 const group=page.locator('.workspace-segments').first();await group.locator('button').nth(2).click();await page.waitForTimeout(50)
 assert.equal(await group.evaluate(e=>getComputedStyle(e,'::before').transitionDuration),'0s')
 await page.locator('.transactions-filter select').click();assert.equal(await page.getByRole('listbox').evaluate(e=>getComputedStyle(e).animationName),'none');await page.keyboard.press('Escape')
 interactions.push('Reduced motion disables selection transitions and menu animation')
 assert.deepEqual(errors,[])
 fs.writeFileSync(path.join(output,process.env.QA_ONLY_INTERACTIONS?'interactions.json':'results.json'),JSON.stringify({cases:results.length,results,interactions,errors},null,2))
 console.log(JSON.stringify({cases:results.length,interactions,errors}))
}finally{await browser?.close();server?.kill()}
