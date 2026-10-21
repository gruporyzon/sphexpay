# Validação dos e-mails — 21/10/2026

Base: main `5c85b0b43f20ac6831a5ebb602f7755168991834` (PRs Cloud até #20).
Atualização isolada: layout e envio de e-mails, testes, templates e fila KYC.
Nenhum arquivo de pagamentos ou componente de interface foi alterado.

- TypeScript, checagem Deno das duas Edge Functions, ESLint, build e `git diff --check`: aprovados.
- Testes direcionados: 50 testes em 5 arquivos; incluem execução real da migration em Postgres/PGlite, isolamento de permissões, deduplicação, lease, falhas do provedor, conteúdo e autorização do endpoint.
- Chromium: 144 renderizações (18 modelos × 320/375/768/1440 px × aparência clara/escura), sem overflow, logo carregada e CTA de pelo menos 44 px.
- Inspeção visual: recuperação no celular e aprovação no desktop.
- Imagens servidas a partir do arquivo local; todas as demais requisições foram bloqueadas no teste. Nenhum envio para clientes, dado real, decisão ou pagamento foi criado para validação.
- A aparência forçada por clientes de e-mail não equivale à emulação de preferência do Chromium. Falta a conferência de mensagens reais em Gmail, Outlook e Apple Mail.

## Ativação pendente

A sessão do navegador não está autenticada no Supabase e a solicitação de entrada segura foi recusada. O conector Supabase permite publicar funções e migration, mas não permite alterar templates/SMTP/Secrets. A conta Resend conectada não lista o domínio SphexPay. Portanto não foi confirmada entrega real de Auth nem a configuração da chave de envio. Ver [instruções e estado de ativação](../EMAIL-TEMPLATES.md).

## Auditoria do banco existente

O advisor anterior à migration sinalizou avisos preexistentes em funções/integrações fora do escopo. Não foram alteradas as permissões de pagamentos, checkout ou Social. A nova fila usa RLS forçada e acesso exclusivo de service_role; as funções novas são SECURITY INVOKER com search_path fixo e execução revogada dos clientes.

Referências do advisor: [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [funções SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Esta última condição é intencional em tabelas exclusivas do backend, incluindo a nova fila.
