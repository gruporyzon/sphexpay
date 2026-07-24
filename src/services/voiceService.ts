export type VoiceGender='female'|'male'|'auto'
export type VoiceProfile={voiceURI:string;name:string;lang:string;localService:boolean;default:boolean;voice:SpeechSynthesisVoice}
export type VoicePair={female:VoiceProfile|null;male:VoiceProfile|null;device:VoiceProfile|null;portugueseCount:number;message:string}

const femaleHints=['female','feminina','mulher','luciana','francisca','victoria','maria','helena','camila','joana','fernanda','bruna','leticia','eloquence','samantha','monica','paulina']
const maleHints=['male','masculina','homem','daniel','antonio','felipe','ricardo','paulo','carlos','thiago','jorge','marcelo','alex','joaquim']
const normalize=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
const uri=(voice:SpeechSynthesisVoice)=>voice.voiceURI||`${voice.name}:${voice.lang}:${voice.localService?'local':'remote'}`
const languageRank=(lang:string,target='pt-BR')=>{
 const value=lang.toLowerCase(),wanted=target.toLowerCase()
 if(value===wanted)return 400
 if(value==='pt-br'||value.startsWith('pt-br'))return 360
 if(value==='pt-pt'||value.startsWith('pt-pt'))return 300
 if(value.startsWith('pt'))return 250
 if(value.split('-')[0]===wanted.split('-')[0])return 180
 return 0
}
const genderRank=(voice:VoiceProfile,gender:Exclude<VoiceGender,'auto'>)=>{
 const name=normalize(`${voice.name} ${voice.voiceURI}`),hints=gender==='female'?femaleHints:maleHints,opposite=gender==='female'?maleHints:femaleHints
 return hints.some(item=>name.includes(item))?150:opposite.some(item=>name.includes(item))?-120:0
}
const qualityRank=(voice:VoiceProfile)=>(voice.localService?24:0)+(voice.default?8:0)+(/natural|premium|enhanced|neural/.test(normalize(voice.name))?35:0)

export const voiceService={
 catalog(voices:SpeechSynthesisVoice[]){
  const unique=new Map<string,VoiceProfile>()
  voices.forEach(voice=>{const voiceURI=uri(voice);if(!unique.has(voiceURI))unique.set(voiceURI,{voiceURI,name:voice.name,lang:voice.lang,localService:voice.localService,default:voice.default,voice})})
  return [...unique.values()]
 },
 sorted(voices:SpeechSynthesisVoice[],language='pt-BR',gender:VoiceGender='auto'){
  return this.catalog(voices).sort((a,b)=>(languageRank(b.lang,language)+qualityRank(b)+(gender==='auto'?0:genderRank(b,gender)))-(languageRank(a.lang,language)+qualityRank(a)+(gender==='auto'?0:genderRank(a,gender)))).map(item=>item.voice)
 },
 pair(voices:SpeechSynthesisVoice[],language='pt-BR'):VoicePair{
  const catalog=this.catalog(voices),ranked=[...catalog].sort((a,b)=>(languageRank(b.lang,language)+qualityRank(b))-(languageRank(a.lang,language)+qualityRank(a))),portuguese=ranked.filter(item=>item.lang.toLowerCase().startsWith('pt'))
  const pool=portuguese.length?portuguese:ranked,device=pool[0]||null
  if(!pool.length)return{female:null,male:null,device:null,portugueseCount:0,message:'Nenhuma voz em português foi encontrada neste dispositivo.'}
  const female=[...pool].sort((a,b)=>genderRank(b,'female')-genderRank(a,'female'))[0]||null
  const male=[...pool].filter(item=>item.voiceURI!==female?.voiceURI).sort((a,b)=>genderRank(b,'male')-genderRank(a,'male'))[0]||null
  if(!male)return{female, male:null,device,portugueseCount:portuguese.length,message:portuguese.length===1?'Este dispositivo possui somente uma voz em português.':'A voz masculina não está disponível neste aparelho.'}
  return{female,male,device,portugueseCount:portuguese.length,message:portuguese.length?'':'Nenhuma voz em português foi encontrada; usando vozes do dispositivo.'}
 },
 select(voices:SpeechSynthesisVoice[],preferredURI:string,language:string,gender:VoiceGender){
  const catalog=this.catalog(voices),preferred=catalog.find(item=>item.voiceURI===preferredURI)||catalog.find(item=>item.name===preferredURI)
  if(preferred)return preferred.voice
  const pair=this.pair(voices,language)
  return gender==='female'?pair.female?.voice||pair.device?.voice||null:gender==='male'?pair.male?.voice||null:pair.device?.voice||null
 },
 describe(voice:SpeechSynthesisVoice){return `${voice.name} · ${voice.lang} · ${voice.localService?'No dispositivo':'Remota'}`},
 profile(voices:SpeechSynthesisVoice[],voiceURI:string){return this.catalog(voices).find(item=>item.voiceURI===voiceURI)||null}
}
