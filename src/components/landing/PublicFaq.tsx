import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs=[
 ['O que é a SphexPay?','É uma plataforma para organizar a visão de vendas, transações, produtos, clientes, financeiro, notificações e resultados. O processamento real depende de provedores oficiais ainda não conectados neste ambiente.'],
 ['Como criar minha conta?','Acesse “Criar conta”, preencha os dados suportados e siga as orientações de confirmação enviadas pelo sistema de autenticação.'],
 ['Como confirmar meu e-mail?','Abra a mensagem enviada após o cadastro e use o link de confirmação. Se necessário, a tela de confirmação permite solicitar um novo envio após o intervalo de segurança.'],
 ['Quais recursos estão disponíveis?','O produto possui Dashboard, vendas, transações, produtos, clientes, links, financeiro, notificações, premiações e recursos de inteligência. Algumas operações dependem de integrações oficiais.'],
 ['Como funcionam vendas e transações?','A plataforma organiza os eventos que estiverem disponíveis para a conta. Ela não cria transações financeiras reais pelo navegador.'],
 ['Como funciona o campeonato?','A configuração atual prevê período, meta, critérios de elegibilidade e três prêmios. O regulamento ainda está marcado como provisório e será confirmado antes da campanha.'],
 ['Como funcionam as premiações?','A jornada possui os marcos Sphex 10K, 100K, 500K, 1M e 5M+. A plataforma não apresenta ganhadores sem registros confirmados.'],
 ['Como recuperar minha senha?','Use “Esqueci minha senha” no login. A resposta é neutra e o link seguro permite definir uma nova senha quando a sessão de recuperação é válida.'],
 ['Como falar com o suporte?','Um canal público de suporte ainda não está documentado no projeto. Ele será incluído aqui quando houver confirmação oficial.']
] as const

export function PublicFaq(){
 const [open,setOpen]=useState<number|null>(0)
 return <section className="faq-section" id="ajuda"><header data-reveal><span>PERGUNTAS FREQUENTES</span><h2>Informação clara antes de começar.</h2></header><div data-reveal>{faqs.map(([question,answer],index)=>{const expanded=open===index,id=`faq-answer-${index}`;return <article key={question}><h3><button aria-expanded={expanded} aria-controls={id} onClick={()=>setOpen(expanded?null:index)}>{question}<ChevronDown/></button></h3><div id={id} hidden={!expanded}><p>{answer}</p></div></article>})}</div></section>
}
