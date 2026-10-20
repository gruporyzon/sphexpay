import { supabase } from '../../lib/supabase'
import { authService } from '../../services/authService'
import type { QuestionnaireAnswers } from './questionnaire'

type TeamEvent='onboarding'|'kyc_submitted'

const client=()=>{
 if(!supabase)throw new Error('O cadastro não está disponível neste ambiente.')
 return supabase
}

// Aviso interno à equipe (Resend, via Edge Function). Nunca bloqueia o fluxo do usuário.
export async function notifyTeam(event:TeamEvent){
 try{await supabase?.functions.invoke('team-notify',{body:{event}})}catch{/* o aviso é best-effort */}
}

export const onboardingService={
 async save(userId:string,answers:QuestionnaireAnswers){
  const {error}=await client().from('onboarding_responses').upsert({user_id:userId,...answers},{onConflict:'user_id'})
  if(error)throw new Error('Não foi possível salvar suas respostas. Tente novamente.')
  const {error:metadataError}=await authService.updateMetadata({onboarding_complete:true})
  if(metadataError)throw new Error('Não foi possível concluir seu cadastro. Tente novamente.')
  void notifyTeam('onboarding')
 }
}
