# TODO

## Migração para a VM
- Validar o webhook com "Simular notificação" no painel do Mercado Pago
- Pagamento real pequeno seguido de estorno, para validar aprovação e bloqueio
- Na Vercel: apagar as variáveis de ambiente e tirar o domínio `galeria`; manter o projeto só para o redirecionamento de `imagecolor-nu.vercel.app`
- Trocar a chave do R2 e a do Resend (ficaram legíveis na Vercel)
- Backup do PocketBase (pedidos e pagamentos agora vivem lá)

## Depois
- Limpeza periódica de objetos órfãos no R2 (finais enviados sem `register`)
- Testar pagamento por Pix
- Painel financeiro consolidado (pedidos e recebimentos de todos os ensaios)
