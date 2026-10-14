# 02 — Arquitetura & Stack

> Este documento descreve o sistema **como está hoje**, incluindo o pagamento via Mercado Pago.

## 1. Stack

| Camada | Tecnologia | Observação |
|--------|-----------|------------|
| Web + API | **Next.js 15 (App Router) + React 19 + TypeScript** | Páginas, Server Actions e Route Handlers no mesmo projeto. Sem servidor separado. |
| UI | **Tailwind CSS 4** + lucide-react | Estado da seleção da cliente em **zustand** (persistido no navegador). |
| Banco | **PocketBase self-hosted** | Coleções **fechadas**; só o superuser acessa. |
| Auth da fotógrafa | **Google OAuth do PocketBase** (coleção `users`) + allowlist `ADMIN_EMAILS` | O PocketBase cria registro para qualquer conta Google; a allowlist é quem autoriza. |
| Acesso da cliente | **Token na URL + senha** (scrypt) → sessão em `gallery_sessions` | Cookie httpOnly `ic_sess_<token>`, validade de 12 h. |
| Storage | **Cloudflare R2**, dois buckets | `image-color` (público) e `image-color-private` (privado). |
| Imagem | **sharp** | Preview 1600 px e thumb 400 px em WebP, com marca d'água em padrão diagonal. |
| Vídeo | **ffmpeg-static** | Preview até 1280 px de largura, limitado a 90 s, com overlay de marca d'água. |
| Drive | **Google Drive API (OAuth2)** | Escopos `drive.readonly` e `userinfo.email`; `refresh_token` criptografado (AES-256-GCM). |
| E-mail | **Resend** | Sem `RESEND_API_KEY` o envio é apenas simulado no log. |
| ZIP | **archiver** | Download "todas as fotos" montado no servidor. |
| Hospedagem | Vercel (web) + PocketBase em servidor próprio | Rotas pesadas usam `maxDuration` de 300 s. |
| Pagamento | **Mercado Pago Checkout Pro** (via `fetch`, sem SDK) | Pix e cartão em até 12x; boleto e caixa eletrônico excluídos. Ver seção 7. |

### Decisões de arquitetura

- **Coleções fechadas + gating no servidor.** Nenhuma coleção tem regra de acesso (`rules = null`).
  O servidor Next.js autentica como superuser (`lib/pb/superuser.ts`) e faz a checagem em código:
  senha, validade da sessão, expiração do acesso, dono do ensaio. A cliente nunca fala com o
  PocketBase. O único uso do PocketBase no navegador é o login OAuth da fotógrafa
  (`lib/pb/browser.ts`).
- **Dois buckets.** O público guarda só o que já tem marca d'água (preview e thumb). Originais e
  fotos finais ficam no privado e só saem por URL assinada (`r2SignedUrl`, 6 h por padrão).
- **Processamento inline, sem fila nem worker.** sharp e ffmpeg rodam dentro do próprio Route
  Handler (`runtime = "nodejs"`, `maxDuration = 300`). Não há Inngest, BullMQ nem container de
  mídia. O limite de tempo da função é o teto prático de um lote (ver [06](06-roadmap-e-fases.md)).
- **Upload direto ao R2.** O navegador pede uma URL assinada de PUT (`/presign`), envia o original
  ao bucket privado e chama `/upload`, que baixa o original, gera os derivados e registra em
  `media_items`. Isso contorna o limite de corpo da Vercel.
- **Admin em duas camadas.** O `middleware.ts` só redireciona quem claramente não está logado
  (checa expiração do JWT, sem validar assinatura). Quem autoriza é `getAdminUser()` /
  `requireAdmin()`, que valida o token **no PocketBase** e confere `ADMIN_EMAILS`. Sem a variável,
  ninguém entra.
- **Uma fotógrafa só.** Dados do estúdio são variáveis de ambiente (`NEXT_PUBLIC_STUDIO_NAME`,
  `WATERMARK_TEXT`), não tabela. `drive_connections` guarda uma única conexão (a nova substitui
  a anterior). O multi-fotógrafo está fora do escopo atual.

---

## 2. Diagrama

```
 Fotógrafa ──Google OAuth──▶ PocketBase (users) ──cookie pb_admin──┐
                                                                   │
 ┌───────────────────────── Next.js (Vercel) ──────────────────────▼──────┐
 │  /admin/*  painel         /g/[token]/*  galeria da cliente             │
 │  /api/admin/*  upload, presign, drive, finals    sharp + ffmpeg inline │
 └──────┬───────────────┬───────────────────┬──────────────────┬──────────┘
        │ superuser     │ S3 API            │ OAuth2           │ HTTPS
        ▼               ▼                   ▼                  ▼
  PocketBase       Cloudflare R2        Google Drive         Resend
  (coleções      ┌ image-color (público: preview/thumb)     (e-mails)
   fechadas)     └ image-color-private (original/final)
                       ▲
 Cliente ──link+senha──┘ previews por URL pública; originais/finais por URL assinada
```

---

## 3. Modelo de dados (PocketBase)

Definido em `scripts/pb-setup.mjs`, idempotente: coleções já existentes são puladas. Todas
as coleções são do tipo base, com regras fechadas e os campos `created`/`updated`.

### `galleries` (ensaios)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| title | text | título do ensaio |
| client_name / client_email | text / email | cliente; o e-mail recebe o aviso de entrega |
| access_token | text, único | parte do link público `/g/<token>` |
| password_hash | text | `scrypt$<salt>$<hash>` |
| status | select | `draft`, `processing`, `ready`, `closed` |
| access_expires_at | date | fim do acesso da cliente |
| download_expires_days | number | validade do download (padrão 30) |
| selection_mode | select | `free` ou `quota` |
| selection_limit | number | cota de fotos inclusas (modo `quota`) |
| extra_photo_cents | number | preço da foto extra além da cota (modo `quota`) |
| delivery_mode | select | `edit` ou `direct` |
| delivered_at | date | quando a entrega editada foi publicada |
| drive_folder_id | text | pasta do Drive de origem |

### `media_items`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| gallery | relação → galleries | cascade |
| type | select | `photo` ou `video` |
| status | select | `pending`, `ready`, `failed` |
| filename | text | nome original |
| preview_key / thumb_key | text | chaves no bucket **público** |
| original_key | text | chave no bucket **privado** |
| drive_file_id | text | evita reimportar do Drive |
| position | number | ordem na grade |
| width / height / duration_sec | number | dimensões e duração |

### `pricing_plans`
Planos por ensaio: `gallery`, `media_type` (`photo`/`video`), `kind` (`single` avulso, `package`
pacote, `full` galeria completa), `name`, `included_qty`, `price_cents`, `extra_item_cents`.

### `final_assets`
Fotos editadas da entrega (modo `edit`): `gallery`, `storage_key` (bucket privado), `filename`.

### `gallery_sessions`
Sessão da cliente após acertar a senha: `gallery`, `token` (único), `expires_at`.

### `selections`
Uma seleção por ensaio: `gallery`, `status` (`open`, `submitted`, `paid`), `media` (relação
múltipla → `media_items`, até 2000, sem cascade), `contracted_plan` (relação → `pricing_plans`,
sem cascade), `video_plan` (relação → `pricing_plans`, sem cascade), `submitted_at` e
`amount_cents` (total calculado por `quoteSelection` no envio; base do bloqueio de downloads e do
pedido). A tabela intermediária `selection_items` do modelo antigo não existe:
a relação múltipla a substitui.

### `drive_connections`
`google_account_email` (informativo) e `refresh_token_encrypted` (AES-256-GCM, chave em
`APP_ENCRYPTION_KEY`).

### `login_attempts`
Limite de tentativas de senha da galeria: `key` (token do ensaio + IP), `count`, `window_start` e
`blocked_until`. Cinco falhas em 15 minutos bloqueiam a chave por 15 minutos
(`lib/pb/rateLimit.ts`). Se a coleção não existir, o limite fica desativado e o log avisa.

### `orders`
Pedido de pagamento, criado quando a seleção é enviada com total maior que zero. É um **snapshot**
da seleção: `gallery`, `selection` (sem cascade), `status` (`pending`, `paid`, `cancelled`,
`refunded`), `amount_cents`, `media` (json), `photo_plan`, `video_plan`, `quote` (json),
`preference_id`, `checkout_url`, `payment_id`, `payment_status`, `payment_method` e `paid_at`.

### `payment_events`
Registro de idempotência dos webhooks: `key` (único, `paymentId:status`), `order`, `payment_id` e
`status`. Só quem consegue criar a chave dispara e-mails e efeitos colaterais.

### Relações
```
galleries 1─* media_items
galleries 1─* pricing_plans
galleries 1─* final_assets
galleries 1─* gallery_sessions
galleries 1─1 selections *─* media_items
selections *─1 pricing_plans (contracted_plan, video_plan)
galleries 1─* orders *─1 selections
orders 1─* payment_events
```

`order_items` e `deliveries` do desenho original não existem: o pedido guarda o snapshot da seleção
em `orders.media` e a entrega é derivada de `final_assets`/`media_items`.

---

## 4. Modos de seleção e de entrega

**Seleção** (`galleries.selection_mode`):
- `free`: a cliente escolhe sem limite; o total sai do plano contratado (`lib/pricing.ts`).
- `quota`: o ensaio inclui `selection_limit` fotos; cada foto além da cota custa
  `extra_photo_cents`.

**Entrega** (`galleries.delivery_mode`):
- `edit` (padrão): a fotógrafa edita as escolhidas, sobe os finais (`final_assets`) e publica
  (`delivered_at`). A cliente é avisada por e-mail e baixa os finais.
- `direct`: assim que a cliente **envia** a seleção, ela baixa os **originais** das fotos escolhidas.

A entrega é liberada pela ação da fotógrafa (`edit`) ou pelo envio da seleção (`direct`), mas
**os downloads (originais e finais) ficam bloqueados enquanto `selections.amount_cents` for maior
que zero e a seleção não estiver `paid`**. O e-mail de entrega publicada também não sai enquanto
não houver pagamento. Total zero não gera pedido: o fluxo segue como antes.

---

## 5. Integração com Google Drive

OAuth 2.0 com a conta da fotógrafa (`drive.readonly` + `userinfo.email`).

1. Em `/admin`, "Conectar Google Drive" leva ao consentimento (`/api/admin/drive/connect`).
2. O callback troca o código, descobre o e-mail da conta e grava o `refresh_token` criptografado
   em `drive_connections`, substituindo a conexão anterior.
3. No ensaio, a fotógrafa cola o link ou o ID da pasta. A rota `drive-import` lista as **imagens**
   da pasta (paginado), pula as já importadas (`drive_file_id`) e processa uma a uma, devolvendo
   o progresso em NDJSON.
4. Cada foto vira preview e thumb (público) e original (privado) via `storePhoto`.

Vídeos não são importados do Drive: entram por upload direto (presign + `/upload`).

---

## 6. Rotas principais

| Rota | Função |
|------|--------|
| `/admin/login` | Login Google (PocketBase OAuth) |
| `/admin`, `/admin/ensaios/novo`, `/admin/ensaios/[id]` | Painel, criação e gestão do ensaio |
| `/api/admin/drive/connect`, `/callback` | Conexão com o Drive |
| `/api/admin/ensaios/[id]/presign`, `/upload` | Upload direto ao R2 e processamento |
| `/api/admin/ensaios/[id]/drive-import` | Importação da pasta do Drive |
| `/api/admin/ensaios/[id]/finals` | Upload dos finais editados |
| `/api/admin/ensaios/[id]/media/[mediaId]` | Remoção de mídia |
| `/api/admin/ensaios/[id]` (DELETE) | Remove o ensaio e seus objetos no R2 |
| `/g/[token]` | Acesso da cliente (senha) |
| `/g/[token]/galeria`, `/selecao`, `/entrega` | Galeria, seleção e download |
| `/g/[token]/finals-zip` | ZIP das fotos entregues |
| `/api/webhooks/mercadopago` | Webhook de pagamento do Mercado Pago |
| `/api/dev/e2e` | Suíte ponta a ponta de desenvolvimento (ver abaixo) |

`/api/dev/e2e` só deve responder com `ENABLE_DEV_E2E=1` **e** sessão de admin. Nunca habilitar
em produção.

---

## 7. Integração com Mercado Pago

Checkout Pro chamado por `fetch` em `lib/mercadopago.ts`; pedidos e eventos em `lib/pb/orders.ts`.
O total vem sempre de `quoteSelection` (`lib/pricing.ts`), recalculado no servidor.

**Fluxo**
1. A cliente escolhe as fotos por pacote/cota e vê o total. Em "Ir para o pagamento", o servidor
   valida, envia e **trava** a seleção, grava `selections.amount_cents` e cria o `orders`
   (snapshot, `pending`).
2. O servidor cria a preferência (Pix e cartão em até 12x; `ticket` e `atm` excluídos) com o id do
   pedido como `external_reference` e redireciona a cliente ao Mercado Pago.
3. O `back_url` volta a `/g/[token]/selecao`, que sincroniza pedidos pendentes consultando os
   pagamentos por `external_reference`.
4. O webhook `/api/webhooks/mercadopago` busca o pagamento na API, confere valor e moeda e
   atualiza o pedido. `approved` marca pedido e seleção como `paid` (a seleção volta ao snapshot do
   pedido) e envia e-mail à fotógrafa e à cliente. `refunded`/`charged_back` bloqueiam os downloads
   de novo.
5. Com pagamento pendente a cliente pode **Pagar agora** (retoma o checkout), **Já paguei,
   verificar** (sincroniza) ou **Alterar seleção** (cancela o pedido e reabre a seleção).

**Regras**
- A `notification_url` só é enviada quando `APP_URL` é https; em desenvolvimento local vale a
  sincronização no retorno.
- Seleção `paid` não pode ser reaberta. Pagamento feito fora da plataforma é registrado pela
  fotógrafa com "Marcar como pago".
- Segurança do webhook: ver [03](03-marca-dagua-e-seguranca.md).

---

## 8. Variáveis de ambiente

Lista completa e comentada em `.env.example`. Grupos: PocketBase (`NEXT_PUBLIC_POCKETBASE_URL`,
`POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`), `ADMIN_EMAILS`, R2
(`CLOUDFLARE_R2_*`), Google (`GOOGLE_*`), `APP_ENCRYPTION_KEY`, `APP_URL`, Mercado Pago (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`), Resend (`RESEND_API_KEY`,
`EMAIL_FROM`), estúdio (`NEXT_PUBLIC_STUDIO_NAME`, `WATERMARK_TEXT`) e desenvolvimento
(`ENABLE_DEV_E2E`, `E2E_IMAGE_DIR`).
