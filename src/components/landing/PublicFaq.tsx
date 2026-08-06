import { useState } from 'react'
import { ArrowUpRight, Plus, X } from 'lucide-react'

const INITIAL_FAQ_COUNT = 5

const faqs = [
  {
    question: 'O que é a SphexPay?',
    answer:
      'A SphexPay é uma plataforma visual para acompanhar operações, vendas, transações, recursos e fluxos de produto em uma experiência centralizada.',
  },
  {
    question: 'Como criar minha conta?',
    answer:
      'Você pode iniciar seu cadastro pela landing page e seguir o fluxo de criação de conta conforme a disponibilidade do ambiente.',
  },
  {
    question: 'Quais recursos estão disponíveis?',
    answer:
      'A experiência inclui áreas de operação, visão de vendas, recursos visuais, acompanhamento de eventos e módulos de apoio ao crescimento operacional.',
  },
  {
    question: 'Como acompanho minhas vendas?',
    answer:
      'A plataforma organiza informações relevantes em painéis visuais, indicadores e módulos de acompanhamento pensados para facilitar a leitura da operação.',
  },
  {
    question: 'Como funciona o checkout?',
    answer:
      'A experiência de checkout pode ser adaptada a diferentes contextos, com foco em clareza e continuidade da jornada. O processamento real depende das integrações oficiais disponíveis.',
  },
  {
    question: 'Posso acompanhar notificações e eventos?',
    answer:
      'Sim. A interface foi desenhada para apresentar atualizações, eventos e contextos operacionais de forma mais clara e organizada.',
  },
  {
    question: 'A plataforma é responsiva?',
    answer:
      'Sim. A proposta visual da SphexPay considera diferentes tamanhos de tela, mantendo leitura, contexto e consistência de uso.',
  },
] as const

export function PublicFaq() {
  const [open, setOpen] = useState<number | null>(0)
  const [showAll, setShowAll] = useState(false)
  const visibleFaqs = showAll ? faqs : faqs.slice(0, INITIAL_FAQ_COUNT)
  const remaining = faqs.length - INITIAL_FAQ_COUNT

  return (
    <section className="spx-faq-section" id="ajuda" aria-labelledby="spx-faq-title">
      <div className="spx-faq-container">
        <header className="spx-faq-copy">
          <span className="spx-faq-label" data-motion>
            <i aria-hidden="true" /> FAQ
          </span>
          <h2 id="spx-faq-title">
            <span data-motion data-motion-delay="1">Respostas</span>
            <span className="spx-faq-accent" data-motion data-motion-delay="2">diretas.</span>
          </h2>
          <i className="spx-faq-stroke" aria-hidden="true" data-motion data-motion-delay="3" />
          <p data-motion data-motion-delay="3">
            As principais respostas sobre acesso, recursos e operação da SphexPay, organizadas de forma simples.
          </p>
          <a className="spx-faq-help" href="#spx-faq-list" data-motion data-motion-delay="4">
            Central de ajuda <ArrowUpRight aria-hidden="true" />
          </a>
        </header>

        <div className="spx-faq-content">
          <div className="spx-faq-list" id="spx-faq-list">
            {visibleFaqs.map(({ question, answer }, index) => {
              const expanded = open === index
              const answerId = `spx-faq-answer-${index}`
              const questionId = `spx-faq-question-${index}`

              return (
                <article
                  className={`spx-faq-item${expanded ? ' is-open' : ''}`}
                  data-motion
                  data-motion-delay={String(Math.min(index + 1, 6))}
                  key={question}
                >
                  <h3>
                    <button
                      id={questionId}
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={answerId}
                      onClick={() => setOpen(expanded ? null : index)}
                    >
                      <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
                      <span>{question}</span>
                      <i className="spx-faq-toggle" aria-hidden="true">
                        {expanded ? <X /> : <Plus />}
                      </i>
                    </button>
                  </h3>
                  <div
                    className="spx-faq-answer"
                    id={answerId}
                    role="region"
                    aria-labelledby={questionId}
                    aria-hidden={!expanded}
                  >
                    <div><p>{answer}</p></div>
                  </div>
                </article>
              )
            })}
          </div>

          {remaining > 0 && (
            <button
              className="spx-faq-more"
              type="button"
              aria-expanded={showAll}
              aria-controls="spx-faq-list"
              onClick={() => {
                setShowAll((current) => !current)
                if (showAll && open !== null && open >= INITIAL_FAQ_COUNT) setOpen(0)
              }}
            >
              <span>{showAll ? 'Exibir menos' : `Exibir mais +${remaining}`}</span>
              <Plus aria-hidden="true" />
            </button>
          )}

          <a className="spx-faq-bottom-cta" href="#spx-faq-list">
            <span>Ainda com dúvidas? Explore mais respostas</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
