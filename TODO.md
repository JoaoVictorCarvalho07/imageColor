# TODO

## Migração para a VM
- Preencher `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` (produção) em `~/apps/galeria/.env` e rodar o deploy de novo
- Cadastrar `https://galeria.isabelpontes.com.br/api/webhooks/mercadopago` no modo produtivo do Mercado Pago (evento "Pagamentos (legacy)") e validar com "Simular notificação"
- Pagamento real pequeno seguido de estorno, para validar aprovação e bloqueio
- Merge do PR; dali em diante, deploy com `bash ~/apps/galeria/src/deploy/vm/subir.sh master`
- Na Vercel: apagar as variáveis de ambiente e tirar o domínio `galeria`; manter o projeto só para o redirecionamento de `imagecolor-nu.vercel.app`
- Trocar a chave do R2 e a do Resend (ficaram legíveis na Vercel)
- Backup do PocketBase (pedidos e pagamentos agora vivem lá)

## Depois
- Limpeza periódica de objetos órfãos no R2 (finais enviados sem `register`)
- Testar pagamento por Pix
- Painel financeiro consolidado (pedidos e recebimentos de todos os ensaios)
