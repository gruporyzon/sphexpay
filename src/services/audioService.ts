let context:AudioContext|undefined,active:OscillatorNode|undefined
export const audioService={
 playSale(volume=.35,style:'signal'|'pulse'|'soft'='signal'){try{context??=new AudioContext();try{active?.stop()}catch{/* O som anterior já encerrou. */}const oscillator=context.createOscillator();active=oscillator;const gain=context.createGain(),start=style==='soft'?440:style==='pulse'?540:620,end=style==='soft'?560:style==='pulse'?720:880;oscillator.frequency.setValueAtTime(start,context.currentTime);oscillator.frequency.exponentialRampToValueAtTime(end,context.currentTime+.12);gain.gain.setValueAtTime(Math.max(.001,volume*.1),context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.18);oscillator.connect(gain).connect(context.destination);oscillator.onended=()=>{if(active===oscillator)active=undefined};oscillator.start();oscillator.stop(context.currentTime+.18)}catch{/* Áudio é aprimoramento progressivo. */}},
 vibrate(){if('vibrate' in navigator)navigator.vibrate([35,25,35])},
 dispose(){try{active?.stop()}catch{/* O som já encerrou. */}active=undefined;if(context){void context.close();context=undefined}}
}
