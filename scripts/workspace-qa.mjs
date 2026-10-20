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
const output=process.env.QA_OUTPUT||'docs/workspace-modules-qa'
fs.mkdirSync(output,{recursive:true})
const allRoutes=['','produtos','produtos/checkout','produtos/links','vendas-ao-vivo','vendas','vitrine','assinaturas','financeiro','financeiro/saques','verificacao','afiliados','premiacoes','relatorios','relatorios/clientes','notificacoes','configuracoes','integracoes','social','competicao']
const routes=process.env.QA_ROUTES?allRoutes.filter(route=>process.env.QA_ROUTES.split(',').includes(route)):allRoutes
const user={id:'00000000-0000-4000-8000-000000000001',email:'visual-qa@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{role:'admin',provider:'email'},user_metadata:{full_name:'Conta de revisão visual'},created_at:'2026-10-01T12:00:00Z',factors:[]}
const profile={user_id:user.id,username:'visual_qa',display_name:'Conta de revisão visual',bio:'Dados fictícios para revisão da interface',badges:[]}
const stamp='2026-10-20T12:00:00Z'
const products=[{id:'00000000-0000-4000-8000-000000000002',seller_id:user.id,name:'Produto de revisão com nome extenso para conferir quebra de linha',slug:'produto-qa',description:'Conteúdo fictício da validação visual.',category:'Cursos',tags:['QA'],price_cents:123456789,currency:'BRL',product_type:'digital',status:'active',billing_type:'one_time',created_at:stamp,updated_at:stamp,product_offers:[],payment_transactions:[]}]
let browser
const results=[],issues=[],interactions=[]
let page
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 const context=await browser.newContext({deviceScaleFactor:1,reducedMotion:'reduce'})
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
  await page.evaluate(route=>{history.pushState({},'', '/dev/workspace-preview/'+route);dispatchEvent(new PopStateEvent('popstate'))},route)
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
 // The store setters are the same ones exercised by the UI interaction checks below.
 for(const width of (process.env.QA_ONLY_INTERACTIONS?[]:process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:process.env.QA_QUICK?[393]:[320,393,820,1366])){
  await page.setViewportSize({width,height:900})
  for(const theme of (process.env.QA_QUICK?['light']:['light','dark'])){
   for(const locale of (process.env.QA_QUICK?['pt-BR']:['pt-BR','en-US','es-ES'])){
    await page.goto(base+'/dev/workspace-preview',{waitUntil:'domcontentloaded'})
    await page.waitForFunction(()=>document.querySelector('.reference-greeting h1')?.textContent.includes('Conta de revisão visual'),null,{timeout:30000}).catch(async error=>{console.log(JSON.stringify({startup:await page.locator('body').innerText(),errors}));throw error})
    await page.evaluate(async({theme,locale})=>{
     const {useDemoStore}=await import('/src/store/useDemoStore.ts')
     const {useAppLocale}=await import('/src/i18n/localeStore.ts')
     useDemoStore.getState().setTheme(theme)
     useAppLocale.getState().setLocale(locale)
    },{theme,locale})
    for(const route of routes){
     await visit(route)
     const snapshot=()=>page.evaluate(()=>{
      const root=document.querySelector('.reference-page'),shown=e=>!!(e.getBoundingClientRect().width&&e.getBoundingClientRect().height)&&getComputedStyle(e).visibility!=='hidden'
      const detail=e=>{const s=getComputedStyle(e);return {text:e.textContent?.trim().slice(0,60),classes:typeof e.className==='string'?e.className:e.tagName,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,radius:s.borderRadius,numeric:s.fontVariantNumeric}}
      if(!root)return {missing:true,body:document.body.innerText.slice(0,300)};const headings=[...root.querySelectorAll('h1')].filter(shown).map(detail)
      const metrics=[...root.querySelectorAll('.metric-value,.subscriptions-value,.financial-balance-card>.financial-money,.pv2-stats strong,.integrations-overview strong,.reference-revenue>strong,.reference-metric>strong,.vitrine-summary dd')].filter(shown).map(detail)
      const panels=[...root.querySelectorAll('.panel,.metric-card,.pv2-card,.financial-balance-card,.subscriptions-primary-card,.subscriptions-side-card,.vitrine-hero,.vitrine-card')].filter(shown).map(detail)
      const controls=[...root.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea')].filter(shown).map(detail)
      return {lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,scroll:document.documentElement.scrollWidth,width:innerWidth,fontReady:document.fonts.check('400 12px SphexDashboard'),headings,metrics,panels,controls,body:root.textContent.trim().length}
     })
     let actual=await snapshot();for(let attempt=0;attempt<75&&(!actual.headings?.length||!actual.body||(route==='produtos'&&actual.metrics?.length<3)||(route==='assinaturas'&&actual.metrics?.length<4));attempt++){await page.waitForTimeout(200);actual=await snapshot()}
     const row={route,width,theme,locale,...actual,errors:errors.splice(0)};if(actual.missing){console.log(JSON.stringify(row));throw new Error("Module failed: "+route)}
     const checks=[
      [actual.scroll<=width,'document overflow'],
      [actual.fontReady,'Raleway not loaded'],
      [actual.lang===locale,'locale not applied'],
      [actual.theme===theme,'theme not applied'],
      [actual.headings.length>0&&actual.headings.every(h=>h.size==='16px'&&h.weight==='600'),'heading hierarchy'],
      [actual.metrics.every(m=>m.weight==='300'&&m.font.includes('SphexDashboard')),'metric typography'],
      [actual.panels.every(p=>p.radius==='19px'),'panel radius'],
      [actual.controls.every(c=>c.font.includes('SphexDashboard')),'control font'],
      [width>767||actual.controls.every(c=>parseFloat(c.size)>=16),'mobile field zoom'],
      [row.errors.length===0,'runtime exception'],
      [actual.body>0,'empty module'],
     ]
     row.failures=checks.filter(([ok])=>!ok).map(([,message])=>message)
     if(row.failures.length)issues.push({route,width,theme,locale,failures:row.failures})
     results.push(row);fs.writeFileSync(path.join(output,"matrix.json"),JSON.stringify({results,issues,interactions},null,2))
     if(locale==='pt-BR'&&((width===393&&theme==='dark')||(width===1366&&theme==='light'))){
      await page.locator('.loading-state').first().waitFor({state:'hidden',timeout:30000})
      if(route==='assinaturas')await page.locator('.subscriptions-value').first().waitFor({timeout:30000})
      await page.screenshot({path:path.join(output,(route.replaceAll('/','-')||'overview')+'-'+width+'-'+theme+'.jpg'),type:'jpeg',quality:65,fullPage:true})
     }
    }
    console.log(JSON.stringify({width,theme,locale,checked:routes.length,issues:issues.length}))
   }
  }
 }

 if(!process.env.QA_WIDTH||process.env.QA_INTERACTIONS){
  await page.setViewportSize({width:393,height:900})
  await page.goto(base+'/dev/workspace-preview/configuracoes',{waitUntil:'domcontentloaded'})
  await page.evaluate(async()=>{const {useAppLocale}=await import('/src/i18n/localeStore.ts');useAppLocale.getState().setLocale('pt-BR')})
  await visit('configuracoes')
  const name=page.locator('.reference-page input[type=text],.reference-page input:not([type])').first()
  await name.fill('Revisão de formulário')
  await page.locator('.workspace-language-trigger').click()
  await page.getByRole('menuitemradio',{name:'English (US)'}).click()
  assert.equal(await name.inputValue(),'Revisão de formulário')
  assert.equal(await page.locator('html').getAttribute('lang'),'en-US')
  await page.reload({waitUntil:'domcontentloaded'})
  assert.equal(await page.locator('html').getAttribute('lang'),'en-US')
  await page.locator('.workspace-language-trigger').click()
  await page.getByRole('menuitemradio',{name:'Español (España)'}).click()
  assert.equal(await page.locator('html').getAttribute('lang'),'es-ES')
  await page.locator('.workspace-language-trigger').click()
  await page.getByRole('menuitemradio',{name:'Português (Brasil)'}).click()
  interactions.push('PT/EN/ES menus, persistence and form preservation')
  await page.locator('.workspace-language-trigger').click()
  await page.keyboard.press('End');await page.keyboard.press('Home');await page.keyboard.press('Escape')
  assert.equal(await page.locator('.workspace-language-trigger').getAttribute('aria-expanded'),'false')
  assert(await page.locator('.workspace-language-trigger').evaluate(e=>document.activeElement===e))
  interactions.push('Language keyboard navigation and focus return')
  await page.getByRole('button',{name:'Preferências',exact:true}).click()
  await page.locator('input[name=workspace-appearance][value=dark]').check()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
  await page.reload({waitUntil:'domcontentloaded'})
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
  await page.getByRole('button',{name:'Preferências',exact:true}).click()
  await page.locator('input[name=workspace-appearance][value=light]').check()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
  interactions.push('Appearance preferences and persistence')
  await visit('produtos')
  const collision=await page.locator('.pv2-stats>.panel').evaluateAll(cards=>cards.some(card=>{const label=card.querySelector(':scope>span:not(.pv2-stat-mark)'),icon=card.querySelector(':scope>svg,:scope>.pv2-stat-mark');if(!label||!icon)return false;const range=document.createRange();range.selectNodeContents(label);const box=icon.getBoundingClientRect();return [...range.getClientRects()].some(r=>r.left<box.right&&r.right>box.left&&r.top<box.bottom&&r.bottom>box.top)}))
  assert.equal(collision,false,'Product labels overlap corner icons')
  assert(await page.locator('.pv2-toolbar select').evaluateAll(selects=>selects.every(e=>e.getBoundingClientRect().width>=200)))
  interactions.push('Product metric labels and readable mobile filters')
  await page.getByRole('button',{name:'Novo produto',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.waitFor()
  const modalStyle=await dialog.evaluate(e=>{const b=e.querySelector('.btn'),i=e.querySelector('input:not([type=checkbox]):not([type=radio])');return {font:getComputedStyle(e).fontFamily,button:b?getComputedStyle(b).borderRadius:null,input:i?getComputedStyle(i).fontSize:null,width:e.getBoundingClientRect().width}})
  assert(modalStyle.font.includes('SphexDashboard'))
  if(modalStyle.button)assert.equal(modalStyle.button,'99px')
  if(modalStyle.input)assert(parseFloat(modalStyle.input)>=16)
  assert(modalStyle.width<=393)
  await page.screenshot({path:path.join(output,'product-dialog-393-light.jpg'),type:'jpeg',quality:70})
  await dialog.locator('button').filter({has:page.locator('svg')}).first().click()
  interactions.push('Product dialog, mobile controls and closing')
  await visit('assinaturas')
  const dateClear=await page.locator('.subscriptions-date-group').evaluate(e=>e.firstElementChild.getBoundingClientRect().right<e.lastElementChild.getBoundingClientRect().left)
  assert.equal(dateClear,true,'Date label overlaps period control')
  interactions.push('Subscription date label spacing')
  await page.locator('.subscriptions-tabs button').nth(1).click()
  await page.locator('.subscriptions-search input').fill('busca sem resultados')
  assert.equal(await page.locator('.subscriptions-search input').inputValue(),'busca sem resultados')
  assert(await page.getByRole('button',{name:/Exportar/}).isDisabled())
  interactions.push('Subscription tabs, search and disabled CSV for empty results')
  await visit('vitrine')
  await page.locator('.vitrine-filters button').nth(1).click()
  assert.equal(await page.locator('.vitrine-filters button').nth(1).getAttribute('aria-pressed'),'true')
  const active=await page.locator('.vitrine-filters button').nth(1).evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))
  assert.notEqual(active.bg,active.color)
  await page.locator('.vitrine-search input').fill('sem resultados')
  interactions.push('Showcase filters and empty search')
  await visit('social')
  await page.locator('.social-tabs button').nth(1).click()
  assert.equal(await page.locator('.social-tabs button').nth(1).getAttribute('class'),'active')
  interactions.push('Social feed tabs')
  assert.deepEqual(errors,[])
 }

 fs.writeFileSync(path.join(output,'matrix.json'),JSON.stringify({results,issues,interactions},null,2))
 console.log(JSON.stringify({cases:results.length,issues:issues.length,first:issues.slice(0,5)}))
 if(issues.length)process.exitCode=1
}finally{await browser?.close();server?.kill()}
