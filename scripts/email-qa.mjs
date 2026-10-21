// Teste local de renderização. Nenhuma navegação ou chamada ao gateway em produção.
import {chromium} from 'playwright'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {emailExamples} from './email-preview.mjs'
const output='docs/email-preview'
mkdirSync(output,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_PATH,args:['--no-sandbox','--disable-dev-shm-usage']})
const rows=[]
try{
 for(const width of [320,375,768,1440])for(const colorScheme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme})
  await context.route('**/*',route=>route.request().url()==='https://www.sphexpay.com.br/brand/email-logo-white.png'?route.fulfill({body:readFileSync('public/brand/email-logo-white.png'),contentType:'image/png'}):route.abort())
  const page=await context.newPage()
  for(const example of emailExamples){
   await page.setContent(example.html.replaceAll('{{ .ConfirmationURL }}','https://sphexpay-qa.invalid/confirmacao-exemplo').replaceAll('{{ .Token }}','482916'))
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,logo:[...document.images].every(image=>image.complete&&image.naturalWidth>0),heading:document.querySelectorAll('h1').length,button:[...document.querySelectorAll('.spx-button a')].every(a=>a.getBoundingClientRect().height>=44)}))
   if(result.overflow||!result.logo||result.heading!==1||!result.button)throw new Error(JSON.stringify({name:example.name,width,colorScheme,...result}))
   rows.push({name:example.name,width,colorScheme,...result})
   if(['recovery','profile_approved','document_rejected'].includes(example.name)&&[375,1440].includes(width)&&colorScheme==='dark')await page.screenshot({path:`${output}/${example.name}-${width}.png`,fullPage:true})
  }
  await context.close()
 }
 writeFileSync(`${output}/results.json`,JSON.stringify({browser:browser.version(),cases:rows.length,results:rows},null,2))
 console.log(`${rows.length} renderizações aprovadas`)
}finally{await browser.close()}
