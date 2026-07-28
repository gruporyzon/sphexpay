import {afterEach,describe,expect,it,vi} from 'vitest'
const {createClientMock}=vi.hoisted(()=>({createClientMock:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:createClientMock}))
// @ts-expect-error API serverless JavaScript fora do bundle TypeScript.
import generateHandler,{resetNotificationGenerationState} from '../../api/notifications/generate.js'
// @ts-expect-error Serviço server-side JavaScript fora do bundle TypeScript.
import {generateNotificationSuggestions,sanitizeGenerationInput,validateGenerationResult} from '../../server/notifications/generation-service.js'

const valid={
 suggestions:[
  {id:'direct',label:'Direta',title:'Venda aprovada!',body:'Mentoria Escala vendida por R$ 297,00.',reason:'Comunicação objetiva.'},
  {id:'motivation',label:'Motivacional',title:'Mais uma venda concluída 🚀',body:'Você vendeu Mentoria Escala por R$ 297,00.',reason:'Celebra a conquista.'},
  {id:'premium',label:'Premium',title:'Pagamento confirmado',body:'Uma venda de Mentoria Escala no valor de R$ 297,00 foi aprovada.',reason:'Tom sóbrio e premium.'}
 ],recommendedIndex:2,detectedIntent:'Confirmar venda',warnings:[]
}
const response=()=>{const result={statusCode:200,body:null as unknown};return{result,status(code:number){result.statusCode=code;return this},json(body:unknown){result.body=body;return this}}}
const request=(body:Record<string,unknown>={request:'Avise sobre uma venda aprovada'})=>({method:'POST',headers:{authorization:'Bearer token'},body})

describe('IA de notificações no backend',()=>{
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();resetNotificationGenerationState()})

 it('sanitiza e limita o contexto enviado ao modelo',()=>{
  const input=sanitizeGenerationInput({request:'  Venda\u0000 aprovada  ',tone:'inexistente',route:'https://evil.test',additional:'x'.repeat(900)})
  expect(input).toMatchObject({request:'Venda aprovada',tone:'Profissional',route:'/app'})
  expect(input.additional).toHaveLength(500)
 })

 it('aceita exatamente três sugestões válidas e rejeita schema quebrado',()=>{
  expect(validateGenerationResult(valid)).toMatchObject({recommendedIndex:2,suggestions:[{label:'Direta'},{label:'Motivacional'},{label:'Premium'}]})
  expect(validateGenerationResult({...valid,suggestions:valid.suggestions.slice(0,2)})).toBeNull()
  expect(validateGenerationResult({...valid,suggestions:valid.suggestions.map((item,index)=>index?item:{...item,body:'{valor}'})})).toBeNull()
 })

 it('usa Responses API com JSON Schema estrito',async()=>{
  const create=vi.fn(async()=>({output_text:JSON.stringify(valid)}))
  const result=await generateNotificationSuggestions({input:sanitizeGenerationInput({request:'Venda aprovada'}),client:{responses:{create}},timeoutMs:100})
  expect(result.suggestions).toHaveLength(3)
  expect(create).toHaveBeenCalledWith(expect.objectContaining({text:{format:expect.objectContaining({type:'json_schema',strict:true})}}),expect.objectContaining({signal:expect.any(AbortSignal)}))
 })

 it('tenta corrigir uma única vez quando o retorno é inválido',async()=>{
  const create=vi.fn().mockResolvedValueOnce({output_text:'{}'}).mockResolvedValueOnce({output_text:JSON.stringify(valid)})
  expect((await generateNotificationSuggestions({input:sanitizeGenerationInput({request:'Venda'}),client:{responses:{create}},timeoutMs:100})).suggestions).toHaveLength(3)
  expect(create).toHaveBeenCalledTimes(2)
 })

 it('trata timeout sem fazer chamada real',async()=>{
  const create=vi.fn((_input:unknown,{signal}:{signal:AbortSignal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})))))
  await expect(generateNotificationSuggestions({input:sanitizeGenerationInput({request:'Venda'}),client:{responses:{create}},timeoutMs:5})).rejects.toMatchObject({code:'AI_TIMEOUT'})
 })

 it('transforma falha da OpenAI em erro seguro',async()=>{
  const create=vi.fn(async()=>{throw Object.assign(new Error('provider detail'),{status:400})})
  await expect(generateNotificationSuggestions({input:sanitizeGenerationInput({request:'Venda'}),client:{responses:{create}},timeoutMs:100})).rejects.toMatchObject({code:'AI_GENERATION_FAILED'})
 })

 it('retorna fallback seguro quando a chave não existe',async()=>{
  vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-key')
  const output=response();await generateHandler(request(),output)
  expect(output.result).toMatchObject({statusCode:503,body:{code:'AI_NOT_CONFIGURED',message:'A criação com IA ainda não está configurada.'}})
 })

 it('exige sessão Supabase válida',async()=>{
  vi.stubEnv('OPENAI_API_KEY','server-openai-key');vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-key')
  const output=response();await generateHandler({method:'POST',headers:{},body:{request:'Venda'}},output)
  expect(output.result).toMatchObject({statusCode:401,body:{code:'UNAUTHORIZED'}})
 })

 it('recusa entrada longa antes de chamar a OpenAI',async()=>{
  vi.stubEnv('OPENAI_API_KEY','server-openai-key');vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-key')
  createClientMock.mockReturnValue({auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))}})
  const output=response();await generateHandler(request({request:'x'.repeat(1201)}),output)
  expect(output.result).toMatchObject({statusCode:413,body:{code:'REQUEST_TOO_LONG'}})
 })

 it('aplica rate limit por usuário',async()=>{
  vi.stubEnv('OPENAI_API_KEY','server-openai-key');vi.stubEnv('SUPABASE_URL','https://project.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-key')
  createClientMock.mockReturnValue({auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))}})
  for(let index=0;index<8;index++){const output=response();await generateHandler(request({request:''}),output)}
  const limited=response();await generateHandler(request({request:''}),limited)
  expect(limited.result).toMatchObject({statusCode:429,body:{code:'AI_RATE_LIMITED'}})
 })
})
