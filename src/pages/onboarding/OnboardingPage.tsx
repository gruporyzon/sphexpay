import { useEffect,useRef,useState,type CSSProperties } from 'react'
import { Navigate,useNavigate } from 'react-router-dom'
import { ArrowRight,Check,ChevronLeft,ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { FlowNotice,FlowShell } from '../../features/signup/FlowShell'
import { emptyAnswers,isComplete,questionnaire,type QuestionnaireAnswers } from '../../features/signup/questionnaire'
import { onboardingService } from '../../features/signup/onboardingService'

const draftKey=(userId:string)=>`sphexpay:onboarding-draft:${userId}`
const total=questionnaire.length

function readDraft(userId:string|undefined):QuestionnaireAnswers{
 if(!userId)return emptyAnswers()
 try{const saved=JSON.parse(sessionStorage.getItem(draftKey(userId))||'null');return saved&&typeof saved==='object'?{...emptyAnswers(),...saved}:emptyAnswers()}catch{return emptyAnswers()}
}

export default function OnboardingPage(){
 const {user}=useAuth(),navigate=useNavigate()
 const [answers,setAnswers]=useState<QuestionnaireAnswers>(()=>readDraft(user?.id))
 const [step,setStep]=useState(()=>{const index=questionnaire.findIndex(question=>!answers[question.key]);return index<0?total-1:index})
 const [direction,setDirection]=useState<'next'|'prev'>('next'),[error,setError]=useState(''),[saving,setSaving]=useState(false),[done,setDone]=useState(false)
 const heading=useRef<HTMLHeadingElement>(null),firstRender=useRef(true)
 const question=questionnaire[step],selected=answers[question.key],last=step===total-1

 useEffect(()=>{if(!user?.id)return;try{sessionStorage.setItem(draftKey(user.id),JSON.stringify(answers))}catch{/* armazenamento indisponível */}},[answers,user?.id])
 useEffect(()=>{if(firstRender.current){firstRender.current=false;return}heading.current?.focus()},[step,done])

 if(user?.user_metadata?.onboarding_complete&&!done&&!saving)return <Navigate to="/app" replace/>

 const choose=(value:string)=>{setAnswers(current=>({...current,[question.key]:value}));setError('')}
 const back=()=>{if(step===0||saving)return;setDirection('prev');setError('');setStep(value=>value-1)}
 const next=async()=>{
  if(!selected||saving)return
  if(!last){setDirection('next');setStep(value=>value+1);return}
  if(!user?.id||!isComplete(answers)){setError('Responda todas as etapas para concluir.');return}
  setSaving(true);setError('')
  try{
   await onboardingService.save(user.id,answers)
   try{sessionStorage.removeItem(draftKey(user.id))}catch{/* armazenamento indisponível */}
   setDone(true)
  }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir. Tente novamente.')}
  finally{setSaving(false)}
 }

 const firstName=String(user?.user_metadata?.full_name??'').trim().split(/\s+/)[0]

 return <FlowShell complete={done}>
  <div className="spx-flow-progress" role="progressbar" aria-label="Progresso do cadastro" aria-valuemin={1} aria-valuemax={total} aria-valuenow={done?total:step+1} aria-valuetext={done?'Cadastro concluído':`Etapa ${step+1} de ${total}`}>
   <div className="spx-flow-track"><i style={{width:`${done?100:((step+1)/total)*100}%`}}/></div>
   <div className="spx-flow-dots" aria-hidden="true">{questionnaire.map((item,index)=><span key={item.key} className={done||index<step?'done':index===step?'current':''}/>)}</div>
  </div>

  {done?<div className="spx-flow-done">
   <div className="spx-flow-check" aria-hidden="true"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="40"/><path d="M27 43.5l10 10 20-22"/></svg></div>
   <h1 ref={heading} tabIndex={-1}>{firstName?`Tudo pronto, ${firstName}.`:'Tudo pronto.'}</h1>
   <p>Sua conta SphexPay está criada. Para liberar recebimentos, o próximo passo é concluir a verificação da sua conta.</p>
   <button type="button" className="spx-flow-button full" onClick={()=>navigate('/app',{replace:true})}>Acessar painel <ArrowRight aria-hidden="true"/></button>
  </div>:<div className={`spx-flow-step${direction==='prev'?' from-prev':''}`} key={question.key}>
   <span className="spx-flow-eyebrow">Etapa {step+1} de {total}</span>
   <h1 ref={heading} tabIndex={-1} id={`onboarding-question-${question.key}`}>{question.title}</h1>
   <p className="spx-flow-subtitle">{question.subtitle}</p>
   <fieldset className={`spx-flow-options${question.layout==='list'?' is-list':''}`} aria-labelledby={`onboarding-question-${question.key}`}>
    {question.options.map((option,index)=><div className={`spx-flow-slot${option.wide?' wide':''}`} style={{'--i':index} as CSSProperties} key={option.value}>
     <label className="spx-flow-option"><input type="radio" name={question.key} value={option.value} checked={selected===option.value} onChange={()=>choose(option.value)}/><span className="spx-flow-radio" aria-hidden="true"/><span>{option.label}</span></label>
    </div>)}
   </fieldset>
   {error&&<div style={{marginTop:16}}><FlowNotice message={error}/></div>}
   <div className="spx-flow-actions">
    <button type="button" className="spx-flow-button outline" onClick={back} disabled={step===0||saving}><ChevronLeft aria-hidden="true"/>Voltar</button>
    <button type="button" key={`${question.key}-${Boolean(selected)}`} className={`spx-flow-button${selected?' is-ready':''}`} onClick={next} disabled={!selected||saving} aria-busy={saving}>
     {saving?<><span className="spx-flow-spinner" aria-hidden="true"/>Concluindo...</>:last?<>Concluir <Check aria-hidden="true"/></>:<>Próximo <ChevronRight aria-hidden="true"/></>}
    </button>
   </div>
  </div>}
 </FlowShell>
}
