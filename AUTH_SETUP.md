# Autenticação SphexPay

## Supabase

1. Crie um projeto e execute `supabase/schema.sql` no SQL Editor.
2. Em Authentication > URL Configuration, defina o domínio da Vercel como Site URL.
3. Cadastre os redirects `http://localhost:4175/auth/callback`, `http://localhost:4175/nova-senha`, `https://SEU_DOMINIO/auth/callback` e `https://SEU_DOMINIO/nova-senha`.
4. Ative confirmação de e-mail e configure o SMTP para produção.
5. Copie somente Project URL e a chave pública anon/publishable para as variáveis Vite. Nunca use `service_role` no frontend.

## Google

Crie credenciais OAuth Web no Google Cloud, configure a tela de consentimento e use no Google o callback informado pelo painel do Supabase (`https://PROJECT_REF.supabase.co/auth/v1/callback`). Depois habilite Google no Supabase e marque `VITE_ENABLE_GOOGLE_OAUTH=true`.

## Apple

São necessários Apple Developer Account, Services ID, Team ID, Key ID, chave privada e domínio verificado. A chave privada fica apenas no Supabase. Use o callback do Supabase (`https://PROJECT_REF.supabase.co/auth/v1/callback`) no Services ID, habilite Apple no Supabase e marque `VITE_ENABLE_APPLE_OAUTH=true`.

O callback final da aplicação para ambos os provedores é `/auth/callback`. O Supabase faz a ponte entre o callback do provedor e a aplicação.

## Verificação em duas etapas (MFA TOTP)

1. No painel do Supabase, em Authentication, habilite o fator **TOTP** (Multi-Factor Authentication).
2. Nenhuma variável de ambiente adicional é necessária — o fluxo é todo client-side via `supabase.auth.mfa.*`.
3. A ativação para o usuário fica em Configurações › Segurança. O login passa a exigir o código quando a conta tem um fator verificado, e as rotas `/app/saques` e `/app/integracoes` exigem sessão AAL2.
4. Detalhes e política em `docs/SECURITY.md`.
