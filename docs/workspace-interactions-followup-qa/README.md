# Continuação das interações do workspace

Base: `de98dec728604ef135ec116a65795cc68eb17995`, depois dos PRs #7–#12 feitos no Cloud. Trabalho isolado na branch `feat/workspace-interactions-followup`.

## Preservação do trabalho paralelo

Foram conferidos os seis commits integrados desde o PR #6: cadastro/questionário, identidade azul, login com Google, e-mails e correções de ranking e links de pagamento. Os 116 arquivos modificados nessa sequência permanecem intactos nesta continuação. A interseção desses arquivos com os três arquivos existentes alterados aqui é vazia.

A branch do Cloud não foi editada. Alterações que ainda existam apenas na sessão remota e não tenham sido enviadas ao GitHub não são inspecionáveis por este checkout. Esta entrega parte da versão publicada e mantém seu diff isolado.

## Alteração incremental

- `WorkspaceSelectMenu.tsx`: teclado revela opções rolando apenas o menu; passar o mouse não reposiciona a lista; movimentos de toque não alteram o destaque de teclado durante a rolagem. Valores nativos, handlers React e submissão dos formulários continuam sendo a fonte de verdade.
- `workspace-interactions.css`: links `.btn`, como Abrir e Editar, recebem a mesma resposta ao pressionar dos botões. Campos do canvas e checkout público ficam fora dessa regra. Movimento reduzido também remove a transformação de hover/pressão desses controles.
- `workspaceInteractions.test.tsx`: regressões de teclado, Home repetido, toque, hover e rolagem local.

Nenhuma alteração em cadastro, autenticação, KYC, e-mails, ranking, analytics, links de pagamento, migrations, serviços ou arquivos de configuração do Cloud. O lembrete de KYC existente abriu e foi dispensado pelo seu próprio botão no navegador local.

## Verificação

TypeScript, ESLint, 73 testes direcionados em 11 arquivos e build Vite passaram. A suíte completa não foi declarada aprovada. Permanecem os avisos já existentes do jsdom sobre reprodução de mídia e do Vite sobre chunks grandes; não impediram a conclusão dos checks.

[Resultados do navegador](results.json): 36 combinações — larguras 320/375/768/1024/1440/1920 px, claro/escuro e PT/EN/ES. Lista fictícia com 80 opções no aplicativo local, com APIs interceptadas em `sphexpay-qa.invalid`. Foram conferidos seleção inicial, Home/End, roda do mouse, movimentos de toque, hover, valores do formulário, cancelamento, foco, ausência de saltos da página e ausência de overflow. Sem erros de execução.

Capturas inspecionadas: [mobile escuro](long-menu-375-dark.jpg) e [desktop claro](long-menu-1440-light.jpg). A lista é um fixture temporário do runner; não é adicionada ao aplicativo.

```bash
npm ci
npm run typecheck
npm run lint
npm run test -- src/test/workspaceInteractions.test.tsx src/test/dashboardFilterMobile.test.ts src/test/headerLanguage.test.tsx src/test/dashboardAccess.test.tsx src/test/subscriptions.test.tsx src/test/checkoutExperience.test.tsx src/test/paymentLinks.test.tsx src/test/signupOnboardingFlow.test.tsx src/test/publicAuthFlows.test.tsx src/test/emailTemplates.test.ts src/test/publicEntry.test.tsx --maxWorkers=2
QA_BROWSER_PATH=/caminho/do/chromium node scripts/workspace-interactions-followup-qa.mjs
npm run build
```

O runner aceita somente localhost/127.0.0.1. `QA_WIDTH`, `QA_THEME` e `QA_LOCALE` permitem repetição pontual; `QA_SCREENSHOT=1` salva a captura. Não acessa ou altera dados de produção e não comprova processamento de pagamentos reais.
