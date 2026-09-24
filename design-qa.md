# SphexPay — validação da página pública

Data: 2026-09-24. Base: `ad10965db60f7289ab1275f5b0bcee00e03d329b`.

## Escopo e estrutura

Repositório existente: React 19, TypeScript, Vite 7, Tailwind 4, React Router, Recharts e Lucide. Página pública em `src/pages/public/LandingPage.tsx`; componentes em `src/components/landing`; estilos públicos e de movimento nos arquivos `landing-*.css`. APIs em `api` e `server`; banco, políticas e funções em `supabase`. Somente a apresentação pública e seu teste de regressão foram alterados. Dependências, lockfile, autenticação, Stripe, Supabase, banco e APIs permanecem sem alterações.

## Evidência visual

Referência: https://cooud.com/ e vídeo fornecido `IMG_7634.MP4`.
- Desktop: captura da referência 1363×936 e implementação 1363×934, ambas em escala CSS 1; comparação recortada à mesma altura, depois reduzida proporcionalmente para o relatório.
- Mobile: vídeo 1290×2796, normalizado para largura CSS 430 (densidade 3); chrome do navegador removido. Implementação 430×844, escala 1. O vídeo registra a animação em andamento (segunda linha ainda invisível, números parciais); a implementação está no estado final. Essa diferença de estado não é falha de conteúdo.
- Comparação completa da abertura: `docs/landing-qa/comparison-desktop.png` e `docs/landing-qa/comparison-mobile.png`.
- Região focal do telefone após correção em 320 px: `docs/landing-qa/phone-320.png`.
- Capturas de todas as seções, desktop/mobile, e resultados automatizados foram produzidos em `../design-reference/final-*.png` e `../design-reference/browser-verification.json` durante a revisão local.

## Revisão e correções

1. [P1, resolvido] Título herdava Inter e CTAs apresentavam texto escuro sobre fundo escuro. Aplicada a fonte da referência aos títulos e corrigida a precedência da cor dos botões. A comparação posterior mostra o texto e os CTAs legíveis.
2. [P2, resolvido] Menu mantinha posição central absoluta e CTA mobile ficava oculto por estilos antigos. Restabelecido fluxo flex e regras de visibilidade por breakpoint; menu e busca validados no navegador.
3. [P2, resolvido] Painel demonstrativo mobile cortava a lateral esquerda; alinhamento foi corrigido e saldo/gráfico passaram a se empilhar dentro da janela, seguindo a referência.
4. [P2, resolvido] Proporção fixa do checkout cortava total e botão. Removida a proporção forçada; conteúdo completo conferido na captura posterior.
5. [P2, resolvido] Telefone estreito em 320 px cortava conteúdo. Largura máxima ajustada; altura interna e conteúdo ficaram iguais: 530/530 px. Evidência focal anexada.
6. [P2, resolvido] Contraste da marca no dispositivo e no tema escuro. Regras locais de cor/filtro corrigidas e nova captura inspecionada.

## Superfícies de fidelidade

- **Tipografia:** arquivos locais SFProDisplay regular, medium e bold; desktop 70,4 px na abertura, espaçamento -0,022em; mobile 32 px. Fontes carregadas e conferidas no navegador.
- **Layout:** abertura centralizada, painel com gradiente, grade de cinco recursos, abas, globo, galeria fotográfica, FAQ, premiações, telefone e rodapé. Mobile com CTAs empilhados e galeria horizontal. Sem transbordamento horizontal nas cinco larguras verificadas.
- **Cores:** branco/preto, gradientes azul/creme, cartões claros e dispositivo escuro. Modo escuro com tokens próprios; movimento reduzido respeitado.
- **Imagens:** seis WebP locais; quatro imagens anteriormente adaptadas com a marca SphexPay recuperadas. Crop e nitidez inspecionados; nenhuma imagem carregada com erro nos testes.
- **Conteúdo:** marca, navegação, destinos reais de cadastro/login, FAQs e premiações da SphexPay preservados. Não foram introduzidas alegações de recursos CRONUS, aplicativo em lojas ou métricas comerciais de terceiros.

## Interações e testes

- Chromium local autorizado pelo usuário: 1363×934 e 320/390/430/768×844.
- CTA de cadastro, menu mobile, fechamento, busca e salto para seção, FAQ e expansão, abas do checkout com teclado, seletor do painel, detalhes da galeria e Escape, controles da galeria.
- Zero erros de JavaScript capturados; largura do documento igual à viewport; conteúdo do telefone contido; preferência de movimento reduzido sem elementos pendentes.
- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`: aprovado. Mantido aviso existente de chunks acima de 500 kB.
- Testes específicos de página, dispositivo e movimento: 12/12 aprovados.
- Suíte completa: **793 aprovados, 24 falhas**, idêntico à execução anterior às alterações. Nenhuma nova falha. Falhas preexistentes concentradas em `publicEntry.test.tsx`, `publicSecuritySeo.test.ts` e `sphexpay.test.tsx`.

## Diferenças intencionais e refinamentos

A referência foi adaptada ao produto existente, não reproduzida como outro serviço: marca, textos, links, demonstrações e premiações são da SphexPay. O painel possui arraste e centralização; não implementa o redimensionamento livre da referência. O telefone mantém a interface demonstrativa nativa do projeto. Curvas exatas das animações, efeito de cursor da referência e detalhes secundários são diferenças residuais; não se declara equivalência pixel a pixel ou cobertura de todos os estados do serviço externo.

## Arquivos modificados/adicionados

- `design-qa.md`
- `docs/landing-qa/comparison-desktop.png`
- `docs/landing-qa/comparison-mobile.png`
- `docs/landing-qa/phone-320.png`
- `public/landing-reference/SFProDisplay-Bold.otf`
- `public/landing-reference/SFProDisplay-Medium.otf`
- `public/landing-reference/SFProDisplay-Regular.otf`
- `public/landing-reference/gallery-experience.webp`
- `public/landing-reference/gallery-global.webp`
- `public/landing-reference/gallery-intelligence.webp`
- `public/landing-reference/gallery-product.webp`
- `public/landing-reference/gallery-productivity.webp`
- `public/landing-reference/gallery-team.webp`
- `src/components/landing/PublicDashboardPreview.tsx`
- `src/components/landing/PublicFeatureGrid.tsx`
- `src/components/landing/PublicHeader.tsx`
- `src/components/landing/PublicHeroMetrics.tsx`
- `src/components/landing/PublicInteractiveGlobe.tsx`
- `src/components/landing/PublicVisualShowcase.tsx`
- `src/landing-cinematic.css`
- `src/landing-reference.css`
- `src/pages/public/LandingPage.tsx`
- `src/test/landingOrbit.test.tsx`

## Checklist final

- [x] Código original recuperado e Git conferido.
- [x] Escopo restrito à página pública.
- [x] Comparação desktop/mobile e correções visuais.
- [x] Interações, responsividade, contraste e movimento reduzido.
- [x] Build, TypeScript, lint e testes executados.
- [x] Falhas anteriores explicitamente registradas.

final result: passed
