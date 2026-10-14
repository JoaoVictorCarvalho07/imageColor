# imageColor

Plataforma de venda de fotos e vídeos da fotógrafa Isabel Pontes (Bebel). A cliente abre um link
com senha, vê previews com marca d'água, seleciona, paga pelo Mercado Pago (Pix ou cartão) e recebe os arquivos sem marca. Documentação de produto em `docs/`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · PocketBase self-hosted ·
Cloudflare R2 · sharp · ffmpeg-static · Resend · Google Drive API · zustand · pnpm.

## Como rodar

```
pnpm install
cp .env.example .env.local
node --env-file=.env.local scripts/pb-setup.mjs
pnpm dev
pnpm typecheck
```

- `pb-setup.mjs` cria as coleções no PocketBase e é idempotente; rode de novo quando o schema mudar.
- Outros scripts em `scripts/` (`test-email`, `test-notify`, `test-r2`, `pb-verify`) rodam com
  `node --env-file=.env.local scripts/<nome>.mjs`.
- Variáveis de ambiente: ver `.env.example`.

## Arquitetura

- **PocketBase com coleções fechadas.** Nenhuma coleção tem regra de acesso. O servidor Next.js
  autentica como superuser (`lib/pb/superuser.ts`) e faz o gating em código (senha, sessão,
  expiração). A cliente nunca fala com o PocketBase; o navegador só o usa no login da fotógrafa.
- **Admin:** login Google via PocketBase OAuth (coleção `users`) + allowlist `ADMIN_EMAILS`
  (sem a variável, ninguém entra). `middleware.ts` é só barreira de UX; a autorização real é
  `getAdminUser()` / `requireAdmin()` em `lib/pb/session.ts`, chamada em toda página, Server Action
  e Route Handler do admin.
- **Cliente:** token do ensaio na URL + senha (scrypt) abre uma sessão em `gallery_sessions`
  (cookie httpOnly `ic_sess_<token>`, 12 h). Tentativas de senha limitadas por `lib/pb/rateLimit.ts`.
- **Dois buckets no R2.** `image-color` (público): só preview e thumb com marca d'água.
  `image-color-private`: originais e finais, acessados apenas por URL assinada. Os nomes ficam em
  `lib/r2.ts`.
- **Processamento inline.** sharp e ffmpeg rodam dentro dos Route Handlers
  (`runtime = "nodejs"`, `maxDuration = 300`). Não há fila nem worker.
- **Upload:** o navegador envia o original direto ao R2 privado por URL assinada (`/presign`) e
  chama `/upload` para gerar derivados e registrar em `media_items`. A importação do Drive
  (`/drive-import`) só traz fotos e responde em NDJSON.
- **Modos de seleção** (`galleries.selection_mode`): `free` (sem limite) ou `quota` (N fotos
  inclusas, `extra_photo_cents` por foto extra).
- **Modos de entrega** (`galleries.delivery_mode`): `edit` (a fotógrafa sobe os finais e publica
  em `delivered_at`) ou `direct` (a cliente baixa os originais das escolhidas ao enviar a seleção).
- **Uma fotógrafa só.** Dados do estúdio vêm de `NEXT_PUBLIC_STUDIO_NAME` e `WATERMARK_TEXT`;
  `drive_connections` guarda uma única conexão.
- **E2E de desenvolvimento:** `/api/dev/e2e` roda uma suíte ponta a ponta e só responde com
  `ENABLE_DEV_E2E=1` e sessão de admin. Nunca habilitar em produção.
- **Instância superuser compartilhada.** `superuserPb()` reaproveita um único cliente entre
  requisições, com `autoCancellation(false)` (senão o SDK aborta chamadas concorrentes) e uma só
  autenticação em voo.
- **Datas vazias no PocketBase** são `""`, não `null`: limpar campo de data exige string vazia, e a
  leitura normaliza `""` para `null`.
- **`cascadeDelete` nas relações** (`scripts/pb-setup.mjs`): `true` só para filhos da galeria (apagou o
  ensaio, some tudo dele). Referências laterais (seleção citando fotos ou pacote) são `false`, senão
  apagar uma foto levaria a seleção inteira da cliente.
- **Conta Google do Drive é campo informativo e opcional** em `drive_connections`: se o `/userinfo`
  falhar, o campo vem vazio e, sendo obrigatório, a conexão inteira seria rejeitada.
- **Pagamento: Mercado Pago Checkout Pro** (`lib/mercadopago.ts`, `lib/pb/orders.ts`), via
  `fetch`, sem SDK. Pix e cartão; boleto e lotérica excluídos. Confirmar uma seleção com valor
  cria um pedido em `orders` (snapshot das mídias, pacotes e total) e redireciona para o checkout.
- **O pagamento só vale depois de consultado na API do Mercado Pago.** O webhook
  (`/api/webhooks/mercadopago`) e a volta do checkout trazem só o id; o servidor busca o pagamento
  e confere valor e moeda contra o pedido. A assinatura `x-signature` é checada quando vem, mas a
  segurança está na consulta. Sem webhook (ex.: localhost), a tela de seleção sincroniza o pedido
  pendente pela busca por `external_reference`.
- **Idempotência:** aplicar um pagamento é idempotente (só grava estado). `payment_events` tem
  chave única `paymentId:status` e só controla o envio de e-mail, para não notificar duas vezes.
- **Pagamento aprovado vence.** Se a cliente pagar um pedido antigo depois de alterar a seleção,
  a seleção volta ao que foi pago (snapshot do pedido). Estorno ou chargeback volta a bloquear.

## Estrutura

- `app/admin` painel · `app/g/[token]` galeria da cliente · `app/api` rotas
- `lib/pb` acesso ao PocketBase · `lib/r2.ts` storage · `lib/mediaPipeline.ts` fotos ·
  `lib/video.ts` vídeos · `lib/watermark.ts` marca d'água · `lib/google.ts` Drive ·
  `lib/notifications.ts` e `lib/email.ts` e-mails
- `scripts/pb-setup.mjs` schema do PocketBase

## Convenções

- **Código sem comentários.** Exceções fechadas: `// TODO assunto`, diretivas de ferramenta
  (`eslint-disable`, `@ts-expect-error`, `prettier-ignore`), texto que chega ao usuário final,
  licença ou atribuição exigida por terceiro, e citação de fonte externa de fórmula ou algoritmo
  não óbvio. Se o trecho só se entende com prosa, renomeie ou extraia função.
- **Decisões vivem aqui, só aqui.** Decisão de arquitetura, produto ou trade-off vai para este
  `CLAUDE.md`, nunca para comentário no código. Sem `CLAUDE.md`, vai para o corpo do PR.
- **Commits:** uma linha, Conventional Commits, em português, curta. Ex.:
  `feat(courses): tabela e CRUD do produtor`. Sem corpo nem bullets.
- **Documentos de tarefas** (`TODO.md`): ao concluir, apague a tarefa. Sem `[x]`, sem relato do
  que foi feito.
- Textos de interface e documentação em português do Brasil.

## Preço e seleção

- **Fonte única do cálculo:** `quoteSelection` em `lib/pricing.ts`. A tela da cliente, o admin e o
  checkout (`lib/pb/orders.ts`) usam a mesma função; o servidor recalcula sempre, nunca confia no total
  vindo do navegador.
- **Servidor é a verdade da seleção.** `selections` guarda as mídias, o pacote de fotos
  (`contracted_plan`) e o de vídeos (`video_plan`). O store do navegador (`store/selection.ts`)
  só espelha em memória, é semeado pela página e salva com debounce. Sem localStorage.
- **Validação em `writeSelection`** (`lib/pb/gallery.ts`): descarta ids que não são mídias
  prontas da galeria, remove duplicatas, rejeita pacote de outra galeria ou tipo errado e aplica
  o limite quando não há preço de extra.
- **Seleção enviada fica travada.** Com pagamento pendente, a própria cliente pode desistir e
  alterar (cancela o pedido). Sem valor a pagar, ou depois de paga, só a fotógrafa reabre
  (`reopenSelectionAction`); seleção paga não reabre.
- **Entrega só após pagamento.** `selections.amount_cents` guarda o total. Com valor maior que zero
  e status diferente de `paid`, nenhum download sai: nem originais (`direct`) nem finais (`edit`),
  e o e-mail de entrega publicada não é enviado. Total zero libera como antes.
- **Pagamento por fora:** a fotógrafa pode marcar como pago no admin (`markPaidAction`).
- **Regras por tipo de pacote** (um pacote de foto e um de vídeo por seleção):
  - sem pacote: cota da galeria (`selection_limit`) + `extra_photo_cents` por foto além dela;
    no modo `free`, sem custo.
  - `package`: preço do pacote; o limite vira cota da galeria + `included_qty`; extras usam
    `extra_item_cents` do pacote, ou o extra da galeria se o pacote não tiver.
  - `single`: preço por item além da cota da galeria, sem limite.
  - `full`: preço fixo, todas as mídias daquele tipo entram.
  - vídeo sem pacote contratado: usa o primeiro plano `single` de vídeo, se houver; senão, sem custo.
- **Extra em branco = limite rígido.** Se não há preço de extra (null), a cliente não passa do
  limite. Preço 0 significa extra gratuito.
- **Planos são atualizados no lugar** (`savePlansAction`), preservando ids para não quebrar o
  pacote já contratado pela cliente.
- **Senha da galeria:** mínimo de 6 caracteres; senha vazia nunca abre sessão.
