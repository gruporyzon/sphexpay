export type VoiceGender='female'|'male'|'auto'
const femaleHints=['female','feminina','luciana','francisca','victoria','maria','helena','camila','joana'],maleHints=['male','masculina','daniel','antonio','felipe','ricardo','paulo','carlos']
const score=(voice:SpeechSynthesisVoice,language:string,gender:VoiceGender)=>{const name=voice.name.toLowerCase(),lang=voice.lang.toLowerCase(),target=language.toLowerCase();let value=lang===target?100:lang.startsWith(target.split('-')[0])?60:0;if(voice.localService)value+=12;if(/natural|premium|enhanced|neural/.test(name))value+=18;if(gender==='female'&&femaleHints.some(h=>name.includes(h)))value+=30;if(gender==='male'&&maleHints.some(h=>name.includes(h)))value+=30;return value}
export const voiceService={
 sorted(voices:SpeechSynthesisVoice[],language:string,gender:VoiceGender){return [...voices].sort((a,b)=>score(b,language,gender)-score(a,language,gender))},
 select(voices:SpeechSynthesisVoice[],preferred:string,language:string,gender:VoiceGender){return voices.find(v=>v.name===preferred)||this.sorted(voices,language,gender)[0]||null},
 describe(voice:SpeechSynthesisVoice){const name=voice.name.toLowerCase();const gender=femaleHints.some(h=>name.includes(h))?'Feminina':maleHints.some(h=>name.includes(h))?'Masculina':'Voz disponível';return `${voice.name} · ${gender} · ${voice.lang}`}
}
