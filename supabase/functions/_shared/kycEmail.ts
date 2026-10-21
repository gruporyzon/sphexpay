import {EMAIL_SITE,renderEmail,emailText,type EmailContent} from './emailLayout.ts'

export type KycEmailEvent={target:'profile'|'document';decision:'approved'|'rejected'|'needs_more_info'}
export function kycEmail(event:KycEmailEvent){
 const document=event.target==='document'
 if(document&&event.decision==='needs_more_info')throw new Error('INVALID_DOCUMENT_DECISION')
 const approved=event.decision==='approved'
 const title=document?(approved?'Seu documento foi aprovado.':'Um documento precisa de ajuste.'):
  approved?'Sua verificação foi aprovada.':event.decision==='needs_more_info'?'Precisamos de mais informações.':'Sua verificação precisa de atenção.'
 const subject=document?(approved?'Documento aprovado — SphexPay':'Ajuste no documento — SphexPay'):
  approved?'Verificação aprovada — SphexPay':event.decision==='needs_more_info'?'Complete sua verificação — SphexPay':'Resultado da verificação — SphexPay'
 const paragraphs=document?[approved?'Um dos documentos enviados passou pela análise da nossa equipe. Acompanhe no painel o status dos demais documentos e da verificação completa.':'Nossa equipe analisou um dos documentos enviados e identificou um ajuste necessário. Acesse a verificação para consultar o motivo e enviar uma nova versão.']:
  approved?['A análise dos seus dados e documentos foi concluída e sua verificação de conta foi aprovada.','Acesse o painel para conferir suas configurações de recebimento e os próximos passos para vender. A disponibilidade dos pagamentos também depende da habilitação da sua conta no processador.']:
  ['Nossa equipe concluiu uma etapa da análise e precisa de informações ou documentos adicionais para continuar.','Os detalhes do resultado e as orientações para corrigir o cadastro estão disponíveis na área de verificação.']
 const content:EmailContent={preheader:approved?'A análise foi concluída. Confira o resultado no seu painel.':'Consulte as orientações da equipe na área de verificação.',eyebrow:'Verificação de conta',title,paragraphs,button:{label:approved?'Consultar minha verificação':'Revisar minha verificação',href:`${EMAIL_SITE}/app/verificacao`},note:document&&approved?'A aprovação de um documento não significa que toda a conta já foi aprovada.':'Por segurança, motivos da análise e documentos são exibidos apenas no painel autenticado.',reason:'Você recebeu este e-mail porque houve uma atualização na análise da sua conta SphexPay.'}
 const html=renderEmail(content)
 return {subject,content,html,text:emailText(html)}
}
