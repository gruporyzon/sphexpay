# SphexPay — unificação visual dos módulos

**final result: blocked**

## Escopo preparado

A Visão geral existente é a referência para tipografia, números, cartões, controles e tabelas. A implementação inicial adiciona src/workspace-modules.css e o importa depois de workspace.css. A especificidade do escopo interno também cobre os estilos carregados sob demanda de Assinaturas, Social, Afiliados e Verificação.

- Raleway local, já distribuída no projeto; títulos de módulo 16/22 px, peso 600; títulos de seção 13/18 px, peso 500.
- Números de métricas com figuras alinhadas e tabulares, peso 300, 29 px para valores principais e 23 px para secundários, com ajustes mobile.
- Cartões com raio de 19 px, fundos e bordas dos tokens claro/escuro existentes; botões e abas em cápsula, campos com raio de 12 px.
- Tabelas com cabeçalhos de peso 400 e dados de peso 500; sem mudanças em valores, moedas, separadores, conversões ou filtros.
- Não foram alterados serviços, autenticação, permissões, dados ou modelos. O canvas editável e o checkout público ficam fora dos seletores tipográficos.

## Evidência de origem

Código da Visão geral: src/workspace.css e src/components/dashboard/ReferenceDashboardView.tsx, base 86abb66382aa782a8baf3e95e8767db5ddfcfc49. Capturas da versão anterior permanecem em docs/header-language-qa/ e docs/reference-dashboard-qa/. Elas não comprovam esta nova alteração.

## Validação pendente

O ambiente selecionado estava indisponível na criação desta branch. Não foi possível executar TypeScript, lint, testes, build local ou navegador. A inspeção estrutural de chaves e seletores no texto não substitui compilação ou QA visual. A prévia automática da Vercel, se disponível, também não substitui revisão visual nem testes.

Antes de integrar: executar npm run typecheck, npm run lint e npm run build, conforme AGENTS.md; verificar os fluxos afetados; capturar todos os módulos em 320, 393, 820 e 1366 px nos temas claro e escuro. Conferir moedas e valores longos, rótulos PT/EN/ES, filtros, estados vazios, modais, navegação por teclado e ausência de overflow. Confirmar que a prévia de checkout preserva sua fonte configurada. Comparar as capturas novas com a Visão geral no mesmo viewport. Corrigir diferenças e recapturar.

Esta branch não está pronta para produção. A revisão anterior do cabeçalho foi preservada em docs/header-language-qa/design-qa.md.
