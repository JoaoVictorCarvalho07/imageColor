# TODO

## Antes do deploy
- Preencher `MERCADOPAGO_ACCESS_TOKEN` (teste em dev, produção no deploy) e `APP_URL=https://galeria.isabelpontes.com.br` na Vercel
- Rodar `node scripts/setup-r2-cors.mjs` com o `APP_URL` de produção no `.env.local`, para liberar o upload direto do domínio novo
- Conferir `GOOGLE_REDIRECT_URI` na Vercel e no Google Cloud apontando para `https://galeria.isabelpontes.com.br/api/admin/drive/callback`
- Cadastrar `<APP_URL>/api/webhooks/mercadopago` em Webhooks no painel do Mercado Pago (evento "Pagamentos") e copiar a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`
- Rodar a suíte `/api/dev/e2e` (com `ENABLE_DEV_E2E=1`) contra o ambiente de dev
- Testar pagamento por Pix no ambiente de teste do Mercado Pago e o webhook em produção (botão "Simular notificação")

## Depois
- Limpeza periódica de objetos órfãos no R2 (finais enviados sem `register`)
- Processamento de vídeo fora da rota serverless (worker) se vídeos grandes estourarem o `maxDuration`
- Painel financeiro consolidado (pedidos e recebimentos de todos os ensaios)
