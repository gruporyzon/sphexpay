// Questionário inicial da conta. Os valores (`value`) são os aceitos pela tabela
// public.onboarding_responses; os rótulos podem mudar sem migração.

export type QuestionKey='business_type'|'segment'|'monthly_revenue'|'goal'|'acquisition_channel'
export type QuestionOption={value:string;label:string;wide?:boolean}
export type Question={key:QuestionKey;title:string;subtitle:string;layout:'grid'|'list';options:QuestionOption[]}
export type QuestionnaireAnswers=Record<QuestionKey,string>

export const questionnaire:Question[]=[
 {key:'business_type',title:'Qual tipo de negócio você opera?',subtitle:'Escolha a opção que melhor representa sua operação.',layout:'grid',options:[
  {value:'infoprodutos',label:'Infoprodutos'},{value:'loja_virtual',label:'Loja virtual'},
  {value:'dropshipping',label:'Dropshipping'},{value:'nutra',label:'Nutra / Suplementos'},
  {value:'saas',label:'SaaS / Software'},{value:'servicos',label:'Serviços'},
  {value:'produtos_fisicos',label:'Produtos físicos'},{value:'comecando',label:'Ainda estou começando',wide:true}
 ]},
 {key:'segment',title:'Qual é o segmento principal do seu negócio?',subtitle:'Isso nos ajuda a entender melhor seu mercado.',layout:'grid',options:[
  {value:'saude',label:'Saúde e bem-estar'},{value:'renda_extra',label:'Renda extra'},
  {value:'relacionamento',label:'Relacionamento'},{value:'desenvolvimento_pessoal',label:'Desenv. pessoal'},
  {value:'beleza',label:'Beleza e estética'},{value:'financas',label:'Finanças'},
  {value:'tecnologia',label:'Tecnologia'},{value:'educacao',label:'Educação'},
  {value:'outros',label:'Outros'}
 ]},
 {key:'monthly_revenue',title:'Qual seu faturamento mensal aproximado?',subtitle:'Use uma média dos últimos meses ou uma estimativa.',layout:'list',options:[
  {value:'sem_faturamento',label:'Ainda não faturo'},{value:'ate_10k',label:'Até R$ 10 mil'},
  {value:'10k_50k',label:'De R$ 10 mil a R$ 50 mil'},{value:'50k_100k',label:'De R$ 50 mil a R$ 100 mil'},
  {value:'100k_500k',label:'De R$ 100 mil a R$ 500 mil'},{value:'acima_500k',label:'Acima de R$ 500 mil'}
 ]},
 {key:'goal',title:'Qual é o seu principal objetivo com a SphexPay?',subtitle:'Assim adaptamos sua experiência desde o primeiro acesso.',layout:'grid',options:[
  {value:'comecar_a_vender',label:'Começar a vender'},{value:'migrar_plataforma',label:'Migrar de plataforma'},
  {value:'aumentar_conversao',label:'Aumentar a conversão'},{value:'vender_exterior',label:'Vender para o exterior'},
  {value:'gestao_financeira',label:'Organizar o financeiro'},{value:'outro',label:'Outro'}
 ]},
 {key:'acquisition_channel',title:'Como você chegou até nós?',subtitle:'Sua resposta ajuda a melhorar nossos canais.',layout:'grid',options:[
  {value:'instagram',label:'Instagram'},{value:'google',label:'Google'},
  {value:'youtube',label:'YouTube'},{value:'facebook',label:'Facebook'},
  {value:'indicacao',label:'Indicação'},{value:'comunidade_evento',label:'Comunidade / Evento'},
  {value:'outro',label:'Outro'}
 ]}
]

export const emptyAnswers=():QuestionnaireAnswers=>({business_type:'',segment:'',monthly_revenue:'',goal:'',acquisition_channel:''})

export const isComplete=(answers:QuestionnaireAnswers)=>questionnaire.every(question=>question.options.some(option=>option.value===answers[question.key]))
