# SphexPay — cabeçalho, idiomas e contraste

**final result: passed**

Revisão da atualização solicitada: corrigir colisões no cabeçalho, colocar um seletor de idiomas com bandeiras no lugar da aparência, mover aparência para Configurações → Preferências e intensificar o preto e o branco. O histórico da revisão anterior do dashboard foi preservado em `docs/reference-dashboard-qa/design-qa.md`.

## Fonte, captura e normalização

- Referência de idioma: `/workspace/scratch/3a59c023d16f/upload/IMG_8797.png`, 1290 × 581 px. Comparação proporcional em 393 × 177 px; a densidade/CSS original não foi informada. Não se afirma equivalência pixel a pixel.
- Estado anterior da SphexPay: `/workspace/scratch/3a59c023d16f/upload/IMG_8792.jpeg`, 1290 × 2796 px. Removida a região nativa superior de 185 px e normalizado o conteúdo restante para 393 × 795 px. Nome, moeda, período e valores privados diferem do estado local vazio e não foram reproduzidos.
- Implementação real: `/dev/workspace-preview`, que usa o mesmo Layout, Dashboard e Settings do app, somente em desenvolvimento. Nenhum guard de produção foi modificado.
- Chrome, viewports 393 × 800 e 320 × 800 CSS px em iframe, densidade 1. Captura do navegador 1363 × 936 px; recortada apenas a margem externa de QA de 20 px. Desktop: 1363 × 936 CSS px.
- Evidências: `docs/header-language-qa/mobile-393-menu.jpg`, `mobile-393-dark.jpg`, `mobile-393-light.jpg`, `mobile-320-dark-menu.jpg`, `mobile-320-light-menu.jpg`, `mobile-preferences-light.jpg`, `desktop-dark-menu.jpg`, `desktop-dark.jpg`, `desktop-light.jpg`.
- Comparações abertas e inspecionadas em pares, com fonte e implementação no mesmo arquivo: `/workspace/scratch/3a59c023d16f/analysis/header-qa/comparison-menu.jpg`, `comparison-dashboard.jpg`, `comparison-menu-focus.jpg`. Esses pares permanecem fora do repositório porque incluem a referência privada do usuário.

## Achados e correções

- **P1 — controles sobrepostos:** o layout anterior permitia que tamanho do avatar, contador e marca disputassem espaço. A linha agora usa grid com espaço restante para a marca e áreas independentes para idioma, sino e perfil. Em 393 px: idioma termina em 283, sino ocupa 291–331 e perfil 339–379. Em 320 px: idioma termina em 224, sino ocupa 230–266 e perfil 272–308; a marca termina em 141,39 e idioma começa em 149,39. Recapturas citadas acima confirmam que não há colisão.
- **P2 — menus concorrentes:** idioma, perfil e notificações compartilham um evento de abertura. Abrir um fecha o anterior. Em 393 px o painel de notificações ocupa 14–379 px; o perfil permanece dentro do viewport. Confirmado por interação no navegador e testes renderizados.
- **P2 — aparência no cabeçalho e baixa intensidade:** substituído o botão Claro/Black por idioma; aparência disponível em Preferências com claro, escuro e sistema. Fundo interno agora #000000 no escuro e #ffffff no claro; texto principal #ffffff/#080808. Recapturas em ambos os temas confirmam o resultado.
- **Passou após correções:** nenhuma diferença P0/P1/P2 acionável no escopo desta atualização. O seletor preserva nomes nativos, bandeiras vetoriais, chevron e marca de seleção. Seu painel usa linhas de pelo menos 47 px para toque e largura de 224 px; é maior que a referência normalizada. É uma adaptação explícita de legibilidade e acesso, sem alegar cópia pixel a pixel.

## Superfícies de fidelidade

- **Tipografia:** mantida a Raleway variável local, denominada SphexDashboard no CSS, com fallback Arial. A fonte original da referência não é identificável com certeza pela imagem. Idioma com 14 px/1,45 no painel, nomes nativos completos e Português/Brasil em duas linhas. Sem corte dos itens. A palavra SphexPay permanece visível em 320 px.
- **Espaçamento e composição:** marca à esquerda e idioma/sino/perfil à direita; navegação horizontal superior preservada. Cabeçalho mobile de 68 px, controles de 40 px e de 36 px até 360 px, gaps de 8/6 px. Painel limitado ao viewport compacto; bordas arredondadas e estados hover/foco/selecionado. Não há dock inferior.
- **Cores:** preto puro, branco puro, painéis #0a0a0a e #141414, texto secundário #b0b0b0, linhas #2b2b2b. A referência mais cinza foi deliberadamente intensificada conforme a nova instrução. Cores semânticas mantidas, verde e erro mais visíveis.
- **Ativos:** logo existente da SphexPay e ícones vetoriais do projeto. Bandeiras BR/US/ES autohospedadas de flag-icons 7.3.2, licença MIT incluída em `public/flags/LICENSE.txt`. Sem emoji ou imagem contendo a interface inteira.
- **Conteúdo:** catálogo local com 1608 entradas em inglês e espanhol, React e Zustand para seleção persistida. Nomes de pessoas/produtos, identificadores, valores e enums financeiros não são traduzidos. Mensagens dinâmicas não catalogadas, como erros externos, conservam seu texto de origem. Sem serviços externos de tradução ou envio de dados.

## Interações, testes e limites

- Português → inglês → espanhol no navegador, recarga preservando espanhol e retorno a português. Cabeçalho, navegação, dashboard e Configurações atualizados; atributo lang acompanha a escolha.
- Aparência alterada em Configurações → Preferências; claro e escuro persistem após recarregar. Opção sistema usa o mecanismo existente e acompanha a mudança do sistema enquanto o Layout está montado.
- Menu por teclado com setas, Home/End, Enter e Escape; seleção e Escape restauram o foco. Clique externo e abertura de outro controle fecham o painel.
- Testes renderizados verificam idioma sem reiniciar formulário, sincronização entre cabeçalho e Preferências, persistência, fallback de localidade inválida, variáveis de tradução e preservação de nomes/valores no dashboard.
- Largura do documento igual a 320/393 px nos viewports mobile; navegação e lista de seções de Configurações têm rolagem própria intencional.
- Logs do navegador examinados após as interações: nenhuma exceção da aplicação observada. Mensagens da extensão do navegador (`chrome-extension://…`, envio de metadados) foram distinguidas dos logs do produto.
- 166 testes aprovados em 26 arquivos: 109 focados em dashboard/cabeçalho/idiomas e 57 regressões de checkout, produtos, notificações e assinaturas.
- TypeScript, ESLint e build Vite aprovados; aviso preexistente de chunks grandes permanece.
- A área privada de produção exige autenticação. A revisão visual usa os componentes reais no ambiente local vazio; não comprova uma sessão privada ou processamento de pagamentos em produção. Autenticação, RLS, MFA, webhooks e dados persistidos no servidor não foram alterados.

## Checklist

- [x] Abrir pares fonte/implementação e região focada do menu.
- [x] Conferir tipografia, composição, cores, ativos e conteúdo.
- [x] Corrigir colisões, recapturar 320/393 px e desktop.
- [x] Testar idiomas, persistência, preferências e menus.
- [x] Remover o suporte público temporário de QA antes do build final.
