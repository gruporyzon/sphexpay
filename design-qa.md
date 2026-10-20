# SphexPay — seletores e movimento do workspace

Revisão de 20/10/2026, sobre main `713192cd46f9101d82d925a1496b50644666ce57`. A revisão da padronização anterior está em [design-qa anterior](docs/workspace-modules-qa/design-qa.md).

## Implementação

- Vendas usa seletores compactos de 7/30/90 dias e BRL/EUR/USD, seguindo as cápsulas da Visão geral. Hoje, período personalizado e datas continuam disponíveis em Mais filtros. As datas ficam em coluna para evitar sobreposição dentro do painel estreito.
- Um indicador compartilhado desliza entre períodos, moedas, abas e navegação de módulos. Botões têm resposta ao pressionar, menus têm entrada suave e o foco de teclado permanece visível.
- Os selects administrativos mantêm seus elementos nativos, valores, validação, submissão e handlers React. Um menu visual compartilhado trata a escolha, teclado, Escape, Tab, busca por letras, grupos e opções desabilitadas.
- O menu usa um portal acima dos modais e se posiciona dentro do viewport. Escape cancela a seleção sem fechar o diálogo que contém o campo.
- Movimento reduzido desativa as novas animações. Os textos usam o sistema de tradução existente e a fonte Raleway local.
- Checkout público, canvas de edição, selects múltiplos e campos explicitamente marcados `data-native-picker` conservam o seletor nativo.

## Validação

**Resultado final: aprovado.** TypeScript, ESLint, 36 testes direcionados em seis arquivos e build Vite passaram. `git diff --check` limpo. O aviso existente de chunks acima de 500 kB permanece sem bloquear o build. Não se declara a suíte completa aprovada.

Chromium 153, Playwright 1.64.1, altura de 900 CSS px. [24 combinações de Vendas](docs/workspace-interactions-qa/results.json): larguras 320/393/820/1366 px, claro/escuro e PT/EN/ES. Verificaram-se início e conclusão da transição real do indicador animado, escolha de período e moeda, menu Status dentro do viewport, teclado, cancelamento, foco e datas personalizadas. Sem erros de execução.

[Interações adicionais](docs/workspace-interactions-qa/interactions.json): seleção por toque, abertura e fechamento pelo rótulo, abas de Assinaturas/Social/Vitrine/Financeiro, navegação entre módulos, filtro e modal de Produtos, Escape preservando o diálogo e movimento reduzido. A contagem zero desse arquivo indica execução apenas das interações; as 24 combinações estão no arquivo anterior.

[Conferência dos 20 módulos](docs/workspace-interactions-qa/module-smoke/matrix.json): 393 px, tema claro e português, sem falhas de layout, fonte ou execução. Também passaram os nove grupos de interações existentes: idiomas, preferências, formulários, filtros, busca e modais. A conferência usa o CSS final, incluindo o painel de datas corrigido. O alinhamento final dos rótulos de data foi conferido novamente por toque no mobile.

Capturas inspecionadas visualmente: [Vendas mobile escuro](docs/workspace-interactions-qa/sales-393-dark.jpg), [Vendas desktop claro](docs/workspace-interactions-qa/sales-1366-light.jpg) e [período personalizado mobile](docs/workspace-interactions-qa/sales-custom-393.jpg).

As evidências locais usam somente a aplicação local, conta fictícia e APIs interceptadas em `sphexpay-qa.invalid`. Nenhum dado real é escrito.

## Reprodução

```bash
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm run lint
npm run test -- src/test/workspaceInteractions.test.tsx src/test/dashboardFilterMobile.test.ts src/test/headerLanguage.test.tsx src/test/dashboardAccess.test.tsx src/test/subscriptions.test.tsx src/test/checkoutExperience.test.tsx --maxWorkers=2
node scripts/workspace-interactions-qa.mjs
npm run build
```

O runner inicia e encerra seu próprio Vite com configuração fictícia. `QA_BROWSER_PATH` permite usar um Chromium instalado no ambiente, sem acrescentar dependências ao aplicativo. `QA_BASE_URL` aceita apenas localhost/127.0.0.1. `QA_ONLY_INTERACTIONS=1` repete somente os fluxos de interação, preservando a matriz completa.

Autenticação, permissões, valores financeiros, serviços de dados, pagamentos e webhooks não foram alterados. Esta revisão de interface não comprova processamento de pagamentos reais.
