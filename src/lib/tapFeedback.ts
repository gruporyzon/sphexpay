import { audioManager } from '../services/audioManager'

// Retorno de toque da barra de navegação do celular: vibração leve e um clique curto.
// No Android (Chrome) a vibração usa a API do navegador. O Safari do iPhone não tem essa API; lá o toque
// háptico vem de um interruptor nativo (input com atributo switch, iOS 17.4 ou mais novo) acionado
// dentro do gesto da pessoa. O clique de som só toca se o som estiver ativado nas configurações.
let iosSwitch:HTMLLabelElement|undefined
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)

function iosHaptic(){
 if(!iosSwitch){
  const label=document.createElement('label'),input=document.createElement('input')
  input.type='checkbox'
  input.setAttribute('switch','')
  input.tabIndex=-1
  label.setAttribute('aria-hidden','true')
  label.style.cssText='position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none'
  label.append(input)
  document.body.append(label)
  iosSwitch=label
 }
 iosSwitch.click()
}

export function tapFeedback(){
 try{
  if(typeof navigator.vibrate==='function')navigator.vibrate(10)
  else if(isIOS())iosHaptic()
 }catch{
  // Vibração é só um reforço: se o aparelho não permitir, a navegação segue normalmente.
 }
 audioManager.tap()
}
