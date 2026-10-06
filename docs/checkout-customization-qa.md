# Checkout personalizado — validação

Data: 2026-10-06. Base: f0e68e9c2d5ecc3bcf0aad5d03c5ffcc099fafe0.

## Comportamento

O módulo de Checkout gerencia checkouts persistidos por produto e oferta. O editor permite banners em imagem/vídeo, upload, capas de vídeo, textos, benefícios, FAQ, cores, fontes, proporções, prévia e publicação. O comprador abre `/pay/:checkoutId` sem login; o visual vem exclusivamente da versão publicada. Os dados de cartão continuam no Checkout hospedado da Stripe.

A publicação aguarda o salvamento bem-sucedido e serializa alterações concorrentes. Tentativas de pagamento preservam idempotência sem guardar nome ou e-mail no navegador. O servidor calcula preço, moeda, taxas e vendedor. O retorno do processador é apresentado como verificação, não aprovação.

## Armazenamento

Migration `20261006015550_checkout_media_assets.sql` aplicada e registrada no Supabase. Bucket público `checkout-media`: JPG/PNG/WebP e MP4/WebM, máximo 25 MB no servidor; imagens limitadas a 5 MB pelo cliente. Validação de assinatura do arquivo, HTTPS para mídias externas, upload com diretório do vendedor e checkout verificados por RLS, sem sobrescrita ou remoção de URLs publicadas. Buckets privados existentes preservados.

## Checks

- TypeScript, ESLint e build aprovados.
- 52 testes específicos aprovados: etapas, confirmação de e-mail, payload, indisponibilidade, retorno, mídias, URLs, formatos, limites, salvamento falho, alterações durante salvamento, preço e capabilities da Stripe.
- Teste de navegação do módulo atualizado e aprovado.
- Suíte geral: 801 aprovados, 25 falhas preexistentes (antes dos dois novos testes de disponibilidade da Stripe). As mesmas 25 falhas foram reproduzidas no HEAD original: landing pública e máscara de data. Nenhuma nova falha do recurso.
- Produção validada em navegador no domínio `www.sphexpay.com.br`, checkout existente: oferta R$ 19,90, identificação, passagem para pagamento e edição dos dados. Nenhum pagamento ou pedido foi criado durante esta conferência.
- Viewport observado: 1363 px; documento 1363 px, sem overflow horizontal, fonte carregada e nenhum erro do aplicativo capturado. Mensagens da extensão do navegador desconsideradas.
- Responsividade implementada com container queries a 720 px, prévia de 390 px e inspector acessível em celular. A conferência visual dedicada de celular/tema escuro não foi concluída: navegador não acessou o servidor local e o acesso temporário à prévia protegida foi bloqueado por revisão automática. As permissões da prévia não foram alteradas.

## Limites

A oferta conferida está em modo Stripe **test**. Cobranças live exigem conta/configuração de produção habilitadas. Integração atual: cartão, pagamento único, uma parcela. Pix, boleto, assinatura, cupom e order bump não são habilitados por controles de apresentação. Nenhuma captura própria de PAN/CVV foi introduzida. A confirmação definitiva permanece no webhook oficial.
