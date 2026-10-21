// Galeria local: apenas exemplos, sem tokens, clientes ou envio de e-mails.
import {mkdirSync,writeFileSync} from 'node:fs'
import {allAuthTemplates} from './build-email-templates.mjs'
import {renderEmail,escapeHtml} from '../supabase/functions/_shared/emailLayout.ts'
import {kycEmail} from '../supabase/functions/_shared/kycEmail.ts'
export const emailExamples=Object.entries(allAuthTemplates).map(([name,{subject,content}])=>({name,subject,html:renderEmail(content)}))
for(const target of ['profile','document'])for(const decision of ['approved','rejected','needs_more_info']){
 if(target==='document'&&decision==='needs_more_info')continue
 const email=kycEmail({target,decision});emailExamples.push({name:`${target}_${decision}`,subject:email.subject,html:email.html})
}
if(import.meta.url===`file://${process.argv[1]}`){
 mkdirSync('docs/email-preview',{recursive:true})
 const cards=emailExamples.map(({name,subject,html})=>`<article><h2>${escapeHtml(subject)}</h2><p>${name}</p><iframe title="${escapeHtml(subject)}" sandbox srcdoc="${escapeHtml(html.replaceAll('{{ .ConfirmationURL }}','https://sphexpay-qa.invalid/confirmacao-exemplo').replaceAll('{{ .Token }}','482916').replaceAll('{{ .Email }}','conta@example.invalid').replaceAll('{{ .NewEmail }}','novo@example.invalid'))}"></iframe></article>`).join('')
 writeFileSync('docs/email-preview/index.html',`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mails SphexPay — prévia</title><style>*{box-sizing:border-box}body{margin:0;padding:32px 20px;background:#090909;color:#f4f4f4;font:16px Arial,sans-serif}main{max-width:1400px;margin:auto}h1{font-size:32px}p{color:#aaa;line-height:1.5}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:24px}article{min-width:0}h2{font-size:18px;margin:20px 0 4px}article p{font-size:12px;margin:0 0 12px}iframe{display:block;width:100%;height:900px;border:1px solid #262626;border-radius:16px;background:#050505}</style><main><h1>E-mails da SphexPay</h1><p>Identidade do gateway: logo, preto e azul. Exemplos de apresentação; links e códigos são fictícios e esta página não envia mensagens.</p><section>${cards}</section></main></html>`)
 console.log(`Galeria gerada: ${emailExamples.length} modelos`)
}
