# Análise de referência visual — Cooud

## Escopo e limites

Este documento registra uma leitura técnica e visual da landing pública da Cooud para orientar, em etapa posterior, um redesign original da landing da SphexPay. A análise usa as nove capturas PNG e o vídeo `effects-scroll.mov` em `docs/references/cooud`, além da página pública <https://cooud.com/> consultada em 5 de agosto de 2026.

As medidas, durações e curvas de animação são estimativas visuais, não valores obtidos do código-fonte da referência. Nenhum código, texto, logotipo, imagem, arquivo de fonte ou asset proprietário da Cooud deve ser reutilizado.

Material local analisado:

- `desktop-hero.png`
- `desktop-features.png`
- `desktop-dashboard.png`
- `desktop-checkout.png`
- `desktop-global.png`
- `desktop-gallery.png`
- `desktop-faq.png`
- `desktop-ai.png`
- `desktop-mobile-app.png`
- `effects-scroll.mov`

Todas as capturas têm 3360 × 2100 px e representam uma viewport desktop de alta densidade. O vídeo registra a página durante rolagem e reforça a leitura de header persistente, reveals progressivos, elementos em camadas e transições vinculadas à entrada no viewport.

## 1. Estrutura completa da landing de referência

### Header

- Barra horizontal branca, centralizada e visualmente leve, com altura aparente entre 72 e 88 px em CSS pixels.
- Conteúdo limitado por container: marca à esquerda, navegação no centro, busca e ações à direita.
- CTA primário escuro em formato pill; ação secundária em superfície cinza muito clara.
- O header permanece no topo durante a rolagem. A superfície opaca branca evita conflito com os blocos abaixo; uma borda ou sombra mínima separa planos sem criar peso.
- Para tablet e celular, a navegação extensa deve virar menu compacto. A ação principal pode permanecer visível se houver largura; ações secundárias devem ir para o drawer.

### Hero

- Composição centralizada e fortemente tipográfica, com muito espaço negativo acima e entre os grupos.
- Título display em duas linhas, largura controlada, peso regular/médio e tracking negativo.
- Subtítulo curto, uma linha no desktop, seguido por dois CTAs em pills.
- Três métricas aparecem abaixo das ações, em linha, sem cards pesados.
- Um mockup de dashboard de grandes dimensões inicia ainda no hero e atravessa a dobra, criando continuidade com a seção seguinte.
- O fundo é branco, enquanto o plano do mockup usa um gradiente difuso azul, ciano e amarelo muito claro.

### Métricas

- Três indicadores compactos no hero, alinhados horizontalmente e com hierarquia número/legenda.
- Números em aproximadamente 32–40 px; legendas em 14–16 px, cinza médio.
- Separação feita por espaço, não por divisórias marcadas.
- Na adaptação SphexPay, somente métricas confirmadas e legalmente adequadas podem aparecer; não reutilizar números promocionais da referência nem misturar cenários demonstrativos com dados financeiros reais.

### Mockup principal

- Janela de navegador grande, central, com radius amplo e crop intencional na dobra.
- Dashboard interno usa sidebar estreita, cards financeiros, gráfico de área e notificações flutuantes.
- O mockup é enquadrado por uma superfície gradiente com blur e sombra difusa.
- Há sensação de profundidade por sobreposição, não por sombras escuras fortes.
- Na SphexPay, o mockup deve ser construído com componentes/ilustrações próprias e dados claramente demonstrativos, sem captura de dados reais.

### Grid de funcionalidades

- Grid assimétrico: primeiro card ocupa duas colunas; o segundo ocupa uma; a linha seguinte contém três cards equivalentes.
- Cards combinam uma metade visual em gradiente e uma metade textual branca.
- Ícones lineares ficam em pequenos tiles brancos elevados, centralizados na área colorida.
- Eyebrows em caixa alta e tracking amplo; títulos curtos e grandes; descrições concisas.
- Radius estimado entre 20 e 28 px, borda cinza clara e sombra quase imperceptível.

### Tabs

- Controle segmentado horizontal largo, com quatro opções e item ativo sobre pill cinza-clara.
- O trilho tem borda fina, fundo branco e radius totalmente arredondado.
- A troca de tab altera mockup e texto em composição de duas colunas.
- O estado ativo deve ser inequívoco também sem depender apenas de cor; usar `aria-selected`, foco visível e semântica de tablist.

### Checkout

- Seção de duas colunas: mockup do checkout sobre halo azulado à esquerda e headline/descrição à direita.
- O mockup usa janela branca com sombra larga e desfoque suave.
- Conteúdo aparece parcialmente recortado para sugerir continuidade, evitando excesso de detalhe.
- A adaptação SphexPay deve preservar os avisos atuais sobre integrações oficiais e nunca sugerir processamento bancário que não esteja conectado.

### Operação global

- Layout 50/50: texto, métricas em grid 2 × 2 e eyebrow azul à esquerda; globo luminoso à direita.
- Título display com uma expressão destacada por superfície azul-gelo, não por gradiente no texto.
- O globo usa linhas, pontos e halos com baixa opacidade, acompanhado de pequenos elementos flutuantes.
- Para SphexPay, um mapa/globo só deve representar cobertura confirmada. O componente próprio `PublicWorldMap`, ou uma abstração visual sem alegações geográficas, é alternativa mais segura.

### Galeria

- Headline grande seguida por trilho horizontal com três cards verticais visíveis e cortes laterais que sugerem continuidade.
- Cards usam imagens de alto contraste, overlay escuro inferior, etiqueta pill, título e descrição.
- Radius estimado em 24–32 px; gaps aproximados de 24–32 px.
- Controles circulares discretos e indicadores inferiores sugerem carrossel/drag.
- A galeria deve receber imagens e narrativas originais da SphexPay ou composições feitas com UI própria.

### FAQ

- Seção em duas colunas: título e CTA à esquerda; accordion numerado à direita.
- Item aberto é maior, exibe divisor interno e resposta; fechados têm altura compacta.
- Radius entre 16 e 22 px, borda cinza-clara e fundo branco.
- Ícones de mais/fechar têm área de toque adequada; a expansão deve animar altura/opacidade sem ocultar foco.

### Tecnologia

- Bloco editorial de grande escala com título central e painel de duas colunas.
- Coluna textual branca sobre uma superfície externa cinza-azulada muito clara; lado visual com gradiente difuso e navegação de carrossel.
- A referência associa essa área a um produto de IA. Na SphexPay, a seção deve falar somente de recursos realmente existentes, evitando copiar conceito, nomenclatura ou promessa.

### Aplicativo

- Composição 45/55: texto, quatro benefícios e badges de lojas à esquerda; smartphone inclinado à direita.
- O telefone escuro contrasta com o fundo branco e recebe notificações flutuantes.
- O mockup ultrapassa a altura visual da seção, reforçando escala e profundidade.
- Não exibir badges de lojas nem alegar disponibilidade de app nativo sem publicação confirmada. A SphexPay pode adaptar essa composição para experiência responsiva/PWA, usando o componente existente `AppInstallCard` quando adequado.

### Footer

- Footer branco, amplo e em cinco colunas: marca/descrição/redes e quatro grupos de links/contato.
- Eyebrows de coluna em caixa alta com tracking amplo; links em cinza escuro com grande line-height.
- Linha legal inferior separada visualmente, com termos e políticas.
- A SphexPay deve preservar suas rotas reais de termos, privacidade, login e cadastro e não adicionar contatos, redes ou páginas inexistentes.

## 2. Sistema visual observado

### Containers

- Container principal estimado em 1.200–1.440 px em desktops largos.
- Capturas em alta densidade mostram conteúdo ocupando cerca de metade a dois terços da largura física, com margens laterais generosas.
- Seções editoriais estreitas usam cerca de 1.080–1.200 px; mockups e galerias podem ultrapassar o container por crop controlado.
- Estratégia recomendada para SphexPay: `max-width` em torno de 1.280 px, padding fluido com `clamp(20px, 4vw, 64px)` e exceções explícitas para rails.

### Espaçamentos

- Ritmo vertical muito amplo: aproximadamente 120–220 px entre blocos no desktop.
- Hero usa espaço ainda maior antes do mockup; títulos e descrições têm 24–40 px entre si.
- Cards: padding visual de 28–48 px; grids: gaps de 20–32 px.
- Notebook: reduzir ritmo em cerca de 15–20%. Tablet: 72–112 px. Celular: 56–88 px.
- O espaço negativo é parte central da linguagem e deve ser mantido sem sacrificar conteúdo acima da dobra em telas menores.

### Escala tipográfica

Estimativa desktop:

- Display/hero: 80–112 px, peso 400–500, line-height 0,95–1,02, tracking de aproximadamente -0,04em.
- H2 editorial: 64–88 px, peso 400–500, line-height 1,0–1,08, tracking -0,035em.
- H3/card: 30–42 px, peso 500–600, line-height 1,08–1,18.
- Corpo destacado: 22–30 px, peso 400, line-height 1,4–1,55.
- Corpo padrão: 16–20 px, line-height 1,5–1,65.
- Eyebrow: 13–16 px, peso 500–600, caixa alta, tracking 0,16–0,24em.
- Legenda: 13–16 px, cinza médio.

Para a SphexPay, manter a fonte oficial já adotada pelo projeto e implementar a escala com `clamp()`. Não importar a fonte da referência.

### Cores e superfícies

- Base: branco e off-white muito próximo de `#fff`.
- Texto principal: preto suave, aproximadamente `#151515` a `#1b1b1b`.
- Texto secundário: cinzas entre `#5c5c5c` e `#8d8d8d`.
- Bordas: cinza muito claro, aproximadamente `#dedede` a `#e8e8e8`.
- CTA: carvão quase preto com texto branco.
- Acentos: azul vivo em pequenos traços/eyebrows e azul-gelo em superfícies.
- Mockups internos adicionam azul, ciano, verde, lilás, amarelo e laranja, mas em áreas controladas.

Na SphexPay, a base preto/branco pode ser reutilizada como princípio, porém o laranja oficial deve continuar sendo o acento reconhecível. Azul pode aparecer apenas como apoio funcional e não substituir a identidade.

### Bordas, radius e sombras

- Bordas predominantemente de 1 px e baixo contraste.
- Pills: radius máximo (`999px`).
- Cards pequenos: 16–22 px.
- Cards editoriais/mockups: 24–36 px.
- Janelas e smartphones: 28–48 px conforme escala.
- Sombras: grandes, difusas e com baixa opacidade; estimativa `0 24px 70px rgba(20,30,50,.10)`.
- Tiles flutuantes usam sombras menores e mais definidas para destacar a camada interativa.

### Gradientes e blurs

- Gradientes muito claros, largos e sem bordas perceptíveis: azul/ciano, azul/lilás e pequenos focos amarelos.
- Uso de radial gradients sobre superfícies neutras; saturation baixa fora das imagens editoriais.
- Blurs aparentes entre 40 e 120 px em halos; backdrop blur discreto pode aparecer no header.
- Evitar aplicar blur em grandes áreas animadas no mobile, pois isso aumenta custo de composição e consumo de bateria.

## 3. Comportamentos e movimento

### Header sticky

- Mantém posição no topo durante a rolagem e preserva fundo branco.
- Transição estimada de 180–260 ms para sombra, borda, altura ou opacidade.
- Na SphexPay, usar `position: sticky`, não listeners de scroll, sempre que possível.

### Scroll reveal e fades

- Seções entram com combinação de `opacity: 0 → 1` e `translateY(24–56px) → 0`.
- Duração estimada: 600–900 ms; stagger de 70–140 ms entre filhos.
- Easing provável: desaceleração suave semelhante a `cubic-bezier(.22, 1, .36, 1)`.
- Acionar uma única vez via `IntersectionObserver`, solução já usada na landing atual da SphexPay.

### Transformações e parallax

- Mockups grandes parecem avançar verticalmente em ritmo diferente do conteúdo, com deslocamento moderado e possível escala de cerca de 0,96 → 1.
- Elementos flutuantes movem poucos pixels e preservam legibilidade; não há evidência de parallax agressivo.
- Duração para entrada de mockup: 800–1.200 ms. Movimento contínuo, quando existir: ciclo de 4–8 s.
- Implementar somente com `transform` e `opacity`; evitar animar `top`, `left`, largura, blur ou grandes sombras.

### Elementos flutuantes

- Notificações e pequenos cards se sobrepõem a dashboard, globo e smartphone.
- Entrada provável com fade, translate e escala de 0,96 → 1; 350–600 ms; stagger de 100–180 ms.
- Oscilação contínua deve ser quase imperceptível (4–10 px) e pausada com reduced motion.

### Carrosséis

- Galeria e bloco de tecnologia sugerem navegação horizontal com cards parcialmente visíveis.
- Transição estimada: 450–700 ms, easing `ease-out`/curva desacelerada.
- Deve aceitar botões, teclado e gesto; não depender de autoplay. Se houver autoplay, pausar em hover, foco, interação e aba oculta.

### Tabs

- Pill ativa desliza ou troca com fade curto.
- Indicador: 220–360 ms. Conteúdo: 350–550 ms com crossfade e pequeno deslocamento.
- Respeitar `role="tablist"`, setas do teclado, `aria-controls` e foco visível.

### Accordion

- Expansão estimada entre 300–450 ms, com conteúdo em fade de 180–280 ms.
- Easing aproximado `cubic-bezier(.4, 0, .2, 1)`.
- Preferir grid rows (`0fr → 1fr`) ou medição controlada; manter conteúdo acessível e estado em `aria-expanded`.

### Hovers e microinterações

- CTAs: mudança de contraste e leve deslocamento do ícone/seta, 160–240 ms.
- Cards: pequena elevação/translate de 2–6 px e sombra mais presente, 240–360 ms.
- Imagens de galeria: escala moderada, cerca de 1 → 1,03, 500–700 ms.
- Links: mudança de opacidade ou traço, sem animação excessiva.

### Reduced motion

- Com `prefers-reduced-motion: reduce`, remover parallax, floats, autoplay e smooth scroll.
- Reveals devem renderizar imediatamente ou usar apenas fade muito curto.
- Tabs, accordions e menus mantêm mudança de estado instantânea, sem perda de informação.
- Gráficos e mockups não devem depender da animação para comunicar valores.

## 4. Responsividade

### Desktop amplo (≥ 1440 px)

- Container central até aproximadamente 1.440 px.
- Headlines display em escala máxima; grids 2/3 colunas; mockups podem ultrapassar a dobra.
- Rails usam cortes laterais deliberados, mas controles permanecem dentro da área segura.

### Notebook (1024–1439 px)

- Container com 32–48 px de margem.
- Reduzir displays em 15–25%, padding vertical e escala dos mockups.
- Grids assimétricos podem ser preservados, desde que cards não fiquem estreitos; o mockup global pode reduzir ou deslocar para fora do eixo.

### Tablet (768–1023 px)

- Header vira navegação compacta/drawer.
- Composições 50/50 devem migrar para uma coluna ou 5/7 com mockup menor.
- Grid de funcionalidades passa a duas colunas; card destacado pode ocupar duas.
- Tabs podem rolar horizontalmente com indicador de overflow e scroll snapping.
- Galeria exibe 1,5–2 cards, com controles acessíveis.

### Celular (< 768 px)

- Container com 20–24 px de padding.
- Hero display recomendado para SphexPay: `clamp(44px, 13vw, 64px)`; H2: 36–52 px.
- CTAs empilham ou ocupam largura total; alvos de toque com mínimo de 44 × 44 px.
- Métricas viram grid 3 colunas compacto ou 2 + 1, conforme o comprimento real das legendas.
- Todos os grids viram uma coluna; a ordem deve colocar contexto textual antes ou imediatamente após o visual relacionado.
- Mockups usam `max-width: 100%`, crop interno e `overflow: clip`; elementos flutuantes são reduzidos, reposicionados ou ocultados quando decorativos.
- Galeria usa uma coluna/card por viewport e scroll snap; não deixar o terceiro card causar overflow do `body`.
- FAQ permanece em uma coluna, com títulos menores e botões de accordion em largura total.
- Footer empilha grupos ou usa accordions; links legais continuam visíveis.

### Prevenção de overflow

- Aplicar `min-width: 0` em filhos de grid/flex.
- Evitar larguras rígidas de mockup sem `max-width`.
- Conter transforms e elementos absolutos em wrappers com `overflow: clip` e padding de segurança para sombras.
- Usar `overflow-x: auto` somente em tabs/rails deliberados, com scrollbar acessível e scroll padding.
- Testar 320, 360, 390, 768, 1024, 1280 e 1440 px, além de zoom de 200%.

## 5. Plano de adaptação para a SphexPay

### Princípios que podem ser reproduzidos

- Ritmo editorial com bastante espaço negativo.
- Hierarquia tipográfica forte e escala fluida.
- Container consistente, grids assimétricos e alternância texto/mockup.
- Superfícies brancas com bordas discretas, halos suaves e radius coerente.
- Tabs segmentadas, accordion acessível, rails com scroll snap e mockups construídos em HTML/CSS/SVG próprios.
- Reveals baseados em `IntersectionObserver`, microinterações por `transform`/`opacity` e fallback de reduced motion.
- Elementos flutuantes como recurso de profundidade, desde que usem conteúdo próprio e não sugiram eventos financeiros reais.

### Elementos que precisam ser originais

- Marca, símbolo, paleta de acento e voz verbal.
- Textos de todas as seções e nomes de recursos.
- Mockups, gráficos, ícones compostos, ilustrações, globo/mapa e imagens editoriais.
- Métricas, números, promessas, depoimentos e alegações de alcance.
- Estrutura narrativa final: a SphexPay deve priorizar sua própria proposta — operação, Vendas ao Vivo, notificações, competição e premiações — sem reproduzir a sequência comercial literalmente.
- Acento principal laranja, identidade preto/branco, logos e assets oficiais da SphexPay.

### Arquitetura atual relevante

- Stack: React 19, TypeScript, Vite 7, React Router 7 e Tailwind CSS 4.
- Estilos: Tailwind utilitário combinado com `src/index.css` e stylesheet específico `src/public.css`.
- Ícones: `lucide-react`; não existe biblioteca dedicada de animação instalada.
- Movimento atual: CSS keyframes/transitions, `IntersectionObserver` e verificações de `prefers-reduced-motion`.
- Landing pública: `src/pages/public/LandingPage.tsx`, montada em `/` por `src/App.tsx`.
- Rotas públicas que devem permanecer: `/entrar`, `/criar-conta`, `/recuperar-senha`, `/verificar-email`, `/nova-senha`, `/auth/callback`, `/termos` e `/privacidade`.

### Componentes existentes que podem ser reutilizados

- `PublicHeader`: base para header sticky, navegação, conta autenticada e menu mobile.
- `SphexPayLogo`: identidade oficial; deve substituir qualquer referência visual de marca externa.
- `PublicPhoneExperience`: mockup próprio de experiência móvel.
- `AnimatedDashboard`: composição própria do dashboard para hero/seção editorial.
- `PublicProductShowcase`: tabs e apresentação de recursos.
- `PublicLiveSalesPreview` e `PublicWorldMap`: visualização própria de Vendas ao Vivo/operação geográfica.
- `PublicFaq`: accordion já conectado à landing.
- `PublicCompetitionSection`: conteúdo derivado da configuração oficial da competição.
- `PublicEditorialSections`: fluxo operacional, benefícios, rail e nota de segurança.
- `AppInstallCard`: opção futura para experiência PWA, sem alegar presença em lojas.
- Primitivos de `src/components/ui.tsx`: loading, empty state e componentes de superfície, quando compatíveis com a landing pública.

### Riscos técnicos

- `src/public.css` já concentra grande volume de regras; adicionar uma segunda linguagem sem tokens pode elevar especificidade e causar regressões.
- Mistura de Tailwind e CSS global exige convenção clara de ownership por componente.
- Elementos absolutos e transforms podem criar overflow horizontal e sobreposição com header/CTAs.
- Um header sticky pode mudar offsets de âncoras; aplicar `scroll-margin-top` às seções.
- Tabs/carrosséis sem semântica podem quebrar teclado, leitores de tela e testes existentes.
- Alterar markup de login/cadastro ou destinos de CTA pode afetar os fluxos públicos protegidos por `PublicOnlyRoute` e `useAuth`.
- Conteúdo que represente dashboard ou pagamentos deve ser marcado como ilustrativo quando não vier de uma integração oficial.

### Riscos de performance

- Capturas e vídeos 3360 × 2100 não devem entrar no produto; são somente referências.
- Grandes blur filters, sombras animadas e múltiplos gradientes sobrepostos aumentam custo de GPU.
- Scroll listeners contínuos e parallax em JavaScript podem causar jank; preferir CSS e IntersectionObserver.
- Mockups complexos acima da dobra podem aumentar LCP e custo de hidratação.
- Carrosséis com todas as imagens carregadas antecipadamente aumentam rede e memória; usar formatos próprios otimizados, dimensões explícitas e lazy loading fora da dobra.
- Respeitar `content-visibility`, `contain`, pausa em aba oculta e reduced motion quando apropriado.

### Itens que não podem ser afetados

- Autenticação, `AuthProvider`, `useAuth`, guards e rotas de callback/reset.
- Clientes Supabase, schema, migrations, RLS, funções e qualquer configuração de banco.
- Backend, APIs, webhooks de pagamento, push, serviços e integrações.
- Fontes de dados, stores, cálculos, saldos, repasses, retiradas e valores financeiros.
- Vendas ao Vivo, notificações Push, competição e premiações como regras/funcionalidades; somente sua apresentação pública poderá ser refinada futuramente.
- Avisos de que recursos transacionais dependem de integrações oficiais.
- Identidade oficial da SphexPay, acessibilidade, modo claro/escuro existente e responsividade.

## Critérios para a futura implementação

1. Criar tokens próprios para container, spacing, tipo, radius, sombra, cor e motion antes de alterar seções.
2. Trabalhar somente em componentes da landing e em `src/public.css`, salvo necessidade comprovada.
3. Preservar links, decisões de autenticação e destinos calculados por `accountDestination`.
4. Construir mockups com UI/ícones/assets da SphexPay; nunca importar as referências locais no bundle.
5. Não exibir números ou cobertura não confirmados.
6. Implementar foco visível, landmarks, headings ordenados, alvos de toque e reduced motion desde o início.
7. Validar visualmente em desktop, notebook, tablet e celular, incluindo zoom e ausência de overflow.
8. Executar lint, typecheck, testes e build antes de qualquer solicitação de commit ou push.

