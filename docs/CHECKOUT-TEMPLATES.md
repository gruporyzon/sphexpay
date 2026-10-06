# Modelo de checkout na versão 1

O Checkout Studio aceita `kind: checkout-template` e `version: 1` em Design > Modelo do checkout. O modelo enviado pelo proprietário fica disponível em “Aplicar modelo enviado” e como opção inicial no assistente de criação. O identificador do template persistido continua compatível com o esquema existente; a configuração completa fica em `draft_settings.templateConfig` e no snapshot publicado.

O modelo usa fundo branco, destaque `#6366f1`, botão arredondado e banner com destaque `#aa8666` e shimmer rápido. Imagens e vídeos previamente enviados são preservados. Sem mídia, o banner apresenta nome e descrição reais do produto. A animação respeita movimento reduzido.

No celular, os elementos seguem a posição configurada (`top`, `sidebar`, `pre_cta`, `form_bottom`) e a ordem dentro de cada posição. O total continua visível antes do botão mesmo quando o resumo completo fica abaixo do formulário. O editor permite alterar posições e ordem.

O timer exige data final real; a barra também exige data inicial anterior à final. Os horários são absolutos e não reiniciam ao recarregar. O timer informa o prazo, enquanto a disponibilidade financeira continua definida pela oferta no servidor. Elementos de depoimentos, frete, escassez e avisos sem conteúdo não são inventados.

Importações têm limite de 64 KB e validação de versão, cores, posições, animações e tipos de elementos. Não aceitam HTML executável, componentes financeiros personalizados ou chaves de prototype. A importação preserva os dados da oferta e os componentes obrigatórios do checkout.

## Verificação em 2026-10-06

- 68 testes específicos passaram: criação, importação, renderização, mídia, timer, salvamento e integração Stripe.
- TypeScript, lint e build passaram.
- Suíte completa: 819 testes passaram; as mesmas 25 falhas já existentes permanecem em landing pública, SEO da landing e máscara de datas.
- Dependências receberam correções compatíveis de React Router, PostCSS, nanoid e source-map-js. `npm audit --omit=dev` terminou sem vulnerabilidades.
- Pagamentos permanecem no modo configurado no servidor; a alteração de template não habilita cobranças reais.
