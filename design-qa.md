# SphexPay — revisão do dashboard por referência de vídeo

**final result: passed**

O resultado passa na revisão visual do dashboard e da navegação solicitada, com as adaptações de marca e conteúdo descritas abaixo. Não constitui comprovação de identidade pixel a pixel ou da família tipográfica original.

## Evidências e normalização

- Fonte visual: `/workspace/scratch/3a59c023d16f/upload/ScreenRecording_10-20-2026 01-57-41_1(1).mp4`, 512 × 1108 px, 30 fps. Quadros em 2 s, 15 s e 25 s.
- Fonte normalizada: `/workspace/scratch/3a59c023d16f/analysis/dashboard-reference/normalized-mobile.png`. Removidas apenas as barras nativas do iOS; recorte (0,65)-(512,1094), reduzido para 393 × 790 px.
- Implementação renderizada no Chrome: `/dev/workspace-preview` durante desenvolvimento. O mesmo `Layout` e `Dashboard` da área autenticada, sem alterar seus guards de produção.
- Captura mobile: iframe de 393 × 800 CSS px, densidade 1. Comparação dos primeiros 790 px contra a fonte normalizada. A margem externa de 20 px do suporte de QA foi recortada.
- Estado comparado: tema escuro, topo da página, 30 dias, BRL, conexão ausente. A referência contém participantes reais; o ambiente local da SphexPay está sem sessão e sem vendas. Essas diferenças de conteúdo foram consideradas antes da avaliação.
- Implementação final: `docs/reference-dashboard-qa/mobile-dark.png`, `mobile-light.png`, `mobile-metrics.png`, `mobile-320.png`, `mobile-320-light.png`, `tablet-dark.png`, `desktop-dark.png`, `desktop-light.png`.
- Viewports adicionais: 320 × 800, 820 × 800 e 1363 × 936 CSS px. Largura do documento igual à largura do viewport nos tamanhos examinados. Só a faixa de navegação tem overflow horizontal intencional.
- Pareamento da visão completa: `/workspace/scratch/3a59c023d16f/analysis/dashboard-reference/iterations/comparison-final.jpg`, fonte à esquerda e implementação à direita, ambas 393 × 790 px.
- Pareamentos focados, abertos e inspecionados em conjunto: `focus-navigation.jpg`, `focus-connection.jpg`, `focus-filters-ranking.jpg` e `focus-metrics-final.jpg` no mesmo diretório de análise. Os pareamentos permanecem fora do repositório por conterem nomes e números financeiros da referência.

## Histórico de comparação e correções

1. **Bloqueado — P1:** a apresentação anterior tinha direção azul e navegação lateral/inferior, incompatíveis com o vídeo. Substituída a composição por superfícies neutras, cabeçalho e navegação superior horizontal. Os módulos continuam acessíveis pelos mesmos destinos.
2. **Bloqueado — P2:** regras antigas centralizavam a saudação, empilhavam os filtros e acrescentavam uma linha de ações antes dos cartões. Corrigidos o alinhamento e a direção dos filtros; atualização manual e ferramentas administrativas passaram para “Mais filtros”. Evidência: `comparison-initial.jpg` e `comparison-second.jpg`.
3. **Bloqueado — P2:** o cartão de conexão começava cerca de 7 px abaixo da referência e o bloco de progresso tinha altura menor. Ajustados espaçamento da saudação, altura da navegação, progresso de 100 px e cabeçalho do ranking de 53 px. Evidência posterior: `comparison-final.jpg` e os três primeiros focos.
4. **Bloqueado — P2:** as métricas estavam aproximadamente 7 px mais altas que os cartões da referência por excesso de margem interna. Reduzidas as margens do valor. Receita medida no navegador: 103,34 px de altura. Nova captura e comparação: `mobile-metrics.png` e `focus-metrics-final.jpg`.
5. **Passou:** recaptura após as correções, sem diferenças P0/P1/P2 acionáveis no escopo comparado. Demais diferenças são adaptações esperadas ou limites de origem, abaixo.

## Superfícies obrigatórias

- **Fontes e tipografia:** Raleway variável local, sob OFL, escolhida por semelhança visual dos glifos, pesos e proporções. Não foi possível confirmar a família original apenas pelo vídeo. Saudação 16/22, título da conexão 15/20, corpo 12/21, navegação 13/20, valor de receita 29 px e peso 300. Conferidos quebra de linhas, hierarquia e truncamento do ranking. Fallback Arial; números alinhados com recursos OpenType.
- **Espaçamento e composição:** margens mobile de 14 px, cabeçalho de 64 px, navegação de 49 px, cartão de conexão com raio de 19 px, CTA de 41 px e ranking com três linhas. Grade de métricas em duas colunas no celular, composição lateral no tablet e desktop. Cabeçalho permanece visível na rolagem; a faixa do menu acompanha o fluxo da página, como no vídeo.
- **Cores e tokens:** fundo escuro amostrado `#0c0c0c`, conexão `#161616`, cartões `#121212`, texto `#b9b9b9`, linhas `#242424`, texto secundário `#858585`. Claro usa inversão neutra `#fafafa`/branco e texto `#262626`. Cores semânticas de conversão, erro e ações destrutivas preservadas. O vídeo disponível não exibe uma referência clara; esse tema foi adaptado, não verificado como idêntico.
- **Imagens e ativos:** marca vetorial existente da SphexPay, sem reutilizar a marca WOOV. Fonte distribuída com sua licença. Ícones vetoriais da biblioteca existente; nenhuma ilustração ou avatar fictício substitui dados de conta. A ausência de participantes usa estado vazio explícito.
- **Textos e conteúdo:** dados de vendas, conexão, premiações e competição vêm dos hooks/serviços existentes. Não copiadas taxas, franquias, participantes ou promessas comerciais do outro gateway. Conversão de checkout aparece indisponível quando não há visitas registradas. O bloco inferior remete aos módulos efetivos da SphexPay.

## Interações e verificação

- Menu percorrível horizontalmente; teclado com setas, Home e End; roda do mouse; apenas uma rota ativa, inclusive subrotas de Produtos.
- Menu inferior e sidebar ausentes do shell renderizado.
- Alternância Claro/Black, filtros 7/30/90 dias, moeda BRL/EUR/USD e “Mais filtros”. O novo período de 90 dias também é reconhecido pelos seletores compartilhados e pela análise dos demais módulos.
- Ajuda abre, fecha com Escape e devolve foco; links navegam para módulos reais.
- Perfil e notificações continuam no cabeçalho. Editor e planejamento continuam condicionados à autorização administrativa existente.
- Verificados Produtos e Preferências com o novo shell. Estado sem backend do catálogo mostra mensagem de erro, sem dados comerciais fabricados.
- Animações de entrada, estados ativos, hover, progresso e valores; movimento reduzido respeitado.
- Logs do navegador examinados: nenhuma exceção da aplicação observada no dashboard local. Mensagens da extensão do navegador foram distinguidas de erros do produto.
- 103 testes em 15 arquivos aprovados, incluindo navegação, acesso administrativo, filtro de 90 dias, moeda, layout, perfil e proteção de rotas.
- TypeScript e ESLint aprovados; build Vite aprovado. Aviso de tamanho de chunks permanece, sem erro de compilação.
- A tentativa da suíte completa encontrou testes antigos da página pública (`publicEntry` e `publicSecuritySeo`) incompatíveis com a landing já existente e foi interrompida. A bateria de integração antiga também usa seletores da sidebar removida. Não se declara a suíte completa aprovada.

## Limites e adaptações esperadas

- A fonte original, o tema claro e uma referência desktop deste dashboard não estão identificados no vídeo disponível. Raleway e a expansão responsiva são aproximações fundamentadas, não cópias verificadas desses estados.
- O seletor de aparência ocupa a cápsula do cabeçalho; perfil e saída continuam no menu de conta existente. Não foi inventado um seletor de países sem suporte funcional.
- O ambiente local não valida pagamentos reais nem dados privados de uma conta em produção. Autenticação, RLS, MFA, processamento e webhooks não foram alterados.

## Checklist de implementação

- [x] Comparar fonte e implementação juntas, em escala equivalente.
- [x] Corrigir e recapturar os problemas P1/P2 identificados.
- [x] Conferir fontes, espaçamento, cores, ativos e conteúdo.
- [x] Verificar mobile compacto, mobile padrão, tablet e desktop.
- [x] Testar navegação, temas, filtros e permissões.
- [x] Remover o suporte temporário de QA do diretório público antes do build.
- [x] Executar testes focados, TypeScript, lint e build.
