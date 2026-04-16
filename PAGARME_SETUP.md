# Guia de Configuração Pagar.me em Produção

Você não precisa alterar o código! O sistema já está preparado. Siga os passos abaixo:

## 1. Configurar Chave Secreta no Supabase
1. Acesse o Dashboard do Supabase > Project Settings > Edge Functions.
2. Adicione uma nova variável de ambiente (Secret):
   - **Nome**: `PAGARME_SECRET_KEY`
   - **Valor**: Sua chave de API de produção (começa com `sk_` ou `ak_`).

## 2. Configurar Conta Bancária no Sistema
O sistema tenta lançar os pagamentos automaticamente em uma conta com o nome exato "Pagar.me".
1. No seu sistema, vá em **Financeiro > Contas e Categorias > Contas Bancárias**.
2. Crie uma nova conta com o nome: `Pagar.me`.

## 3. Configurar Webhook no Pagar.me
Para que o sistema saiba quando um boleto ou Pix foi pago:
1. Acesse o Dashboard da Pagar.me > Configurações > Webhooks.
2. Crie um novo Webhook:
   - **URL**: `https://<SEU-ID-SUPABASE>.supabase.co/functions/v1/pagarme-webhook`
   - **Eventos**: Marque `order.paid`, `charge.paid`, `invoice.paid`.

Pronto! O sistema agora aceitará pagamentos reais.
