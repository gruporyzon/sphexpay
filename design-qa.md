# SphexPay — padronização visual dos módulos

**final result: passed**

A Visão geral existente é a referência. Continuação do PR #5, a partir do HEAD 544afae655f21b672322e6acede8813c2a2dea48, sem recriar páginas ou alterar serviços de negócio.

## Resultado

- Raleway local (SphexDashboard), títulos 16/22 px com peso 600 e seções 13/18 px com peso 500.
- Números alinhados e tabulares, peso 300, escalas de 29/23 px e adaptação mobile.
- Cartões de 19 px; botões e abas em cápsula; campos de 12 px de raio e fonte de pelo menos 16 px no mobile.
- Checkouts administrativos e Vitrine agora seguem a hierarquia da Visão geral. Os cartões da Vitrine usam os tokens dos dois temas.
- Produtos reserva espaço para os ícones das métricas, quebra rótulos e organiza filtros em coluna nas telas estreitas. Suas abas agora usam o mesmo estilo de seleção.
- O grupo de data de Assinaturas ganha uma linha própria no mobile, preservando espaço entre rótulo e período.
- Modais ficam acima do cabeçalho e da ajuda. A animação de entrada deixa de reter um contexto de empilhamento; páginas com um diálogo aberto não mantêm transform. O botão de fechar de Novo produto foi acionado no navegador após a correção.

## Matriz e evidências

Chromium/Playwright 1.64.1, componentes reais em /dev/workspace-preview, densidade 1, altura de 900 CSS px, fontes carregadas e conteúdo estabilizado antes de medir. Rota existente disponível somente em desenvolvimento. A revisão usa conta fictícia e respostas locais do host sphexpay-qa.invalid; não depende de credenciais ou dados privados.

| Largura | Temas | Idiomas | Combinações |
| --- | --- | --- | --- |
| 320 px | claro e escuro | PT/EN/ES | 120 |
| 393 px | claro e escuro | PT/EN/ES | 120 |
| 820 px | claro e escuro | PT/EN/ES | 120 |
| 1366 px | claro e escuro | PT/EN/ES | 120 |

20 rotas: Visão geral, Produtos, Checkouts, Links de pagamento, Vendas ao Vivo, Vendas, Vitrine, Assinaturas, Financeiro, Saques, Verificação, Afiliados, Premiações, Relatórios, Clientes, Notificações, Configurações, Integrações, Social e Competição.

480 combinações verificadas, sem falhas nos critérios do runner. Produtos e Assinaturas foram revisados novamente nas 48 combinações afetadas pelos últimos ajustes de espaçamento. A matriz final substitui essas linhas pelos resultados da revisão posterior.

- [Matriz final](docs/workspace-modules-qa/matrix.csv): largura, idioma, tema, hierarquia, pesos, raios e tamanhos dos campos realmente observados.
- [Comparação mobile escuro](docs/workspace-modules-qa/comparison-dark.jpg): Visão geral, Produtos, Vitrine e Assinaturas, capturas recortadas apenas no limite vertical do quadro.
- [Comparação desktop claro](docs/workspace-modules-qa/comparison-light.jpg): os mesmos módulos reduzidos proporcionalmente para comparação.
- [Modal mobile](docs/workspace-modules-qa/product-dialog-mobile.jpg): captura depois da correção das camadas.
- Capturas comparadas visualmente com a Visão geral no mesmo tema e viewport. Listas e navegação horizontal mantêm sua rolagem própria.

## Interações

Passaram no navegador: PT/EN/ES com persistência; troca de idioma sem reiniciar um formulário; navegação de idioma por teclado e retorno do foco; aparência nas Preferências com persistência; formulário Novo produto, fonte mobile e fechamento; ausência de colisão entre rótulos e ícones de métricas; filtros de Produtos legíveis; abas e busca de Assinaturas; exportação desabilitada para resultados vazios; separação do rótulo de data; filtros e busca vazia da Vitrine; abas do feed Social.

## Checks e reprodução

TypeScript, ESLint, 62 testes direcionados em 11 arquivos e build Vite aprovados nesta atualização. git diff --check limpo. O aviso de chunks acima de 500 kB continua; não bloqueia o build.

A tentativa inicial da suíte completa ficou sem progresso no teste de integração legado sphexpay.test.tsx e foi interrompida. Não se declara a suíte inteira aprovada. Os 166 testes citados na revisão anterior não são usados como evidência deste PR.

```bash
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm run lint
npm run test -- src/test/headerLanguage.test.tsx src/test/workspaceSearch.test.tsx src/test/dashboardLayout.test.ts src/test/dashboardFilterMobile.test.ts src/test/subscriptions.test.tsx src/test/affiliates.test.tsx src/test/checkoutExperience.test.tsx src/test/checkoutStudio.test.ts src/test/checkoutBuilderSave.test.tsx src/test/productsV2Advanced.test.ts src/test/notificationSanitizer.test.ts --maxWorkers=2
npm run test:workspace
npm run build
```

O runner inicia e encerra seu próprio Vite local com configuração fictícia. QA_WIDTH e QA_ROUTES permitem repetir uma largura ou módulos; QA_ONLY_INTERACTIONS=1 executa os fluxos. QA_BASE_URL aceita apenas localhost/127.0.0.1. A configuração fictícia não é adicionada ao aplicativo ou à Vercel.

Autenticação, permissões, dados persistidos, moedas, valores financeiros, pagamentos, webhooks e serviços permanecem sem alterações neste PR. O canvas do editor e o checkout público conservam a tipografia configurada. Esta revisão não comprova processamento de pagamentos reais ou uma sessão privada em produção.
