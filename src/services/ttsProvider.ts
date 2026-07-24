export interface TTSProvider{
 readonly available:boolean
 speak(input:{text:string;voice:'female'|'male'}):Promise<HTMLAudioElement|Blob>
}

// Um provedor premium só pode ser conectado quando existir uma rota de servidor
// autenticada. Nenhuma chave ou endpoint fictício é usado pelo cliente.
export const premiumTTSProvider:Pick<TTSProvider,'available'>={available:false}
