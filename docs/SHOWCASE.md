# Vitrine por performance

A rota existente `/app/vitrine` mostra a seleção publicada e a gestão dos produtos do player autenticado. Não adiciona uma rota anônima nem expõe dados financeiros de outros vendedores.

## Banco e implantação

Aplicar `supabase/migrations/20260916090000_product_showcase.sql` antes de disponibilizar o frontend. A migration cria uma tabela vazia `product_showcase_publications`, sem seeds, sem apagar produtos e sem alterar seus estados de venda/checkout. Produtos atuais e futuros começam sem publicação. A listagem estática anterior foi retirada, assim como sua simulação de afiliação em localStorage.

O frontend não usa dados demonstrativos ou fallback: se a migration estiver ausente ou houver erro de rede, apresenta erro com tentativa novamente.

## Regra

Meta de **100.000 centavos (R$ 1.000,00) por produto e vendedor**. Usa o ledger canônico `payment_transactions`, somando `amount_cents`: valor pago após descontos e antes das taxas. Não soma eventos (evita duplicidade), pagamentos pendentes/recusados, reembolsos ou chargebacks. Considera somente BRL; moedas estrangeiras não são convertidas por uma cotação inventada.

`list_my_showcase_products` calcula os estados Bloqueado, Elegível e Publicado. Produtos excluídos/arquivados não são exibidos. O acesso é limitado por `auth.uid()`, independentemente do que o frontend envia. RLS permite apenas ler as próprias publicações; não há escrita direta pelo cliente. `set_product_showcase_publication` verifica dono, produto e faturamento antes de publicar; a operação é idempotente e serializada por produto. Remover não exclui o produto nem altera vendas.

A elegibilidade é contínua: se um reembolso reduzir o total abaixo da meta, o produto fica bloqueado e desaparece da área publicada. A intenção de publicação anterior fica guardada e volta a valer se o faturamento se recuperar. Não há alteração do ledger nem triggers nos pagamentos. O player pode remover publicações pela RPC mesmo abaixo da meta.

## Interface

Hero, contadores, seleção publicada, gestão com filtros/busca e cards de progresso. Mensagens de sucesso acessíveis, carregamento e erro. Atualiza após cada ação, ao retornar à janela, via eventos Realtime de produtos/vendas quando disponíveis e pelo botão Atualizar. Troca de conta desmonta os dados anteriores. Suporta temas claro/escuro e telas estreitas.

## Verificação

`npm run build`, `npm run lint`, `npm test -- src/test/showcase.test.tsx src/test/showcaseMigration.test.ts`.
Os testes SQL executam a migration no PGlite e verificam limiar, isolamento, RLS, escrita direta, remoção, refunds e ausência de publicação automática.
