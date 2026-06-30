# 01 — Arquitetura & Stack

## 1. Stack recomendada (e por quê)

| Camada | Tecnologia | Por que |
|--------|-----------|---------|
| **Frontend / Web** | **Next.js 15 (App Router) + React + TypeScript** | Um único projeto fullstack, SSR para galeria rápida e boa para SEO da landing; ecossistema enorme. |
| **UI** | **Tailwind CSS + shadcn/ui** | Telas bonitas e consistentes rápido; componentes acessíveis prontos. |
| **Backend / API** | **Next.js Route Handlers + Server Actions** | Sem servidor separado para o MVP; menos peças para manter. |
| **Banco de dados** | **PostgreSQL (via Supabase)** | Relacional, robusto, com Row Level Security. Supabase já entrega Auth, Storage e DB juntos. |
| **Auth (admin)** | **Supabase Auth** | Login da fotógrafa pronto e seguro. |
| **Acesso da cliente** | **Token de link + senha (custom)** | Sem cadastro: o link carrega um token, a senha é validada e cria uma sessão temporária. |
| **Storage de derivados** | **Cloudflare R2** (ou Supabase Storage) | Guarda previews/thumbs com marca d'água. R2 tem **egress grátis** — ideal para muitas imagens. |
| **CDN** | **Cloudflare** | Entrega rápida das imagens com cache global. |
| **Processamento de imagem** | **sharp** (Node) | Redimensiona e aplica marca d'água em fotos com alta performance. |
| **Processamento de vídeo** | **ffmpeg** | Gera preview de baixa resolução com overlay de marca d'água. |
| **Fila / jobs** | **Inngest** (ou BullMQ + Upstash Redis) | Processamento de mídia desacoplado e resiliente, fora do tempo limite das funções serverless. |
| **Worker de mídia** | **Container Node em Railway/Render/Fly** | sharp+ffmpeg precisam de CPU/tempo; roda fora da Vercel. |
| **Integração Drive** | **Google Drive API (OAuth2)** | A fotógrafa autoriza a própria conta; importamos os arquivos. |
| **Pagamento** | **Mercado Pago (SDK + Webhooks)** | Pix (QR + copia-e-cola) e cartão; padrão no Brasil. |
| **E-mail** | **Resend** | E-mails transacionais simples e com boa entregabilidade. |
| **Hospedagem (web)** | **Vercel** | Deploy nativo de Next.js, simples e escalável. |
| **Monitoramento** | **Sentry** | Captura erros de processamento e pagamento. |

> **Resumo da arquitetura:** Next.js na Vercel (site + API) · Supabase (DB/Auth) · R2+Cloudflare
> (mídia) · Worker Node (sharp/ffmpeg) acionado por fila · Google Drive (origem) · Mercado Pago
> (pagamento) · Resend (e-mail).

### Por que não tudo na Vercel?
O processamento de **vídeo (ffmpeg)** e lotes grandes de **fotos** estoura os limites de tempo e
memória das funções serverless. Por isso o **worker dedicado** + **fila**. O resto (site, API,
checkout, galeria) roda tranquilo na Vercel.

### Alternativa "tudo Supabase" (mais simples, menos flexível)
Storage e até funções de processamento no Supabase. Funciona para fotos; para vídeo ainda é
melhor um worker. Decidiremos na implementação conforme volume real.

---

## 2. Diagrama de arquitetura (visão lógica)

```
                         ┌──────────────────────────┐
                         │     Google Drive          │
                         │  (originais da fotógrafa) │
                         └────────────┬──────────────┘
                                      │  Drive API (OAuth2)
                                      ▼
┌─────────────┐   ações   ┌────────────────────────┐   enfileira   ┌─────────────────┐
│  Painel     │──────────▶│   Next.js (Vercel)      │──────────────▶│   Fila (Inngest)│
│  Admin      │           │  - Web (galeria/admin)  │               └────────┬────────┘
│ (fotógrafa) │◀──────────│  - API / Server Actions │                        │
└─────────────┘   dados   │  - Checkout / Webhooks  │                        ▼
                          └───────┬─────────┬───────┘            ┌────────────────────┐
                                  │         │                    │  Worker de mídia   │
                          ┌───────▼──┐  ┌───▼──────┐             │  (sharp + ffmpeg)  │
                          │ Supabase │  │ Mercado  │             │  marca d'água +    │
                          │ Postgres │  │  Pago    │             │  resize/transcode  │
                          │  + Auth  │  │ Pix/Card │             └─────────┬──────────┘
                          └──────────┘  └──────────┘                       │
                                  ▲                                        ▼
┌─────────────┐   link+senha     │              ┌──────────────────────────────────────┐
│   Cliente   │──────────────────┘              │  Cloudflare R2 + CDN                  │
│ (navegador) │◀───── previews com marca d'água ─┤  - previews/thumbs (marca d'água)    │
│             │◀───── download final (assinado) ─┤  - originais privados (pós-pagamento)│
└─────────────┘                                  └──────────────────────────────────────┘
```

---

## 3. Modelo de dados (entidades principais)

> Postgres (Supabase). Nomes em inglês para o código; descrição em português.

### `users` (fotógrafa / admin)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| email | text | login |
| name | text | nome |
| role | enum(`owner`,`assistant`) | papel (futuro multi-usuário) |
| created_at | timestamptz | — |

### `drive_connections`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| user_id | uuid (FK) | dona da conexão |
| google_account_email | text | conta autorizada |
| refresh_token | text (cripto) | para renovar acesso |
| created_at | timestamptz | — |

### `clients`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| name | text | nome da cliente |
| email | text | para envio do link/entrega |
| phone | text | WhatsApp (futuro) |

### `galleries` (ensaios)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| user_id | uuid (FK) | fotógrafa |
| client_id | uuid (FK, nullable) | cliente associada |
| title | text | ex.: "Ensaio Gestante — Marina" |
| drive_folder_id | text | pasta de origem no Drive |
| access_token | text (único) | parte do link público |
| password_hash | text | senha do ensaio |
| status | enum(`draft`,`processing`,`ready`,`closed`) | estado |
| expires_at | timestamptz | prazo para a cliente escolher |
| cover_media_id | uuid (nullable) | capa da galeria |
| created_at | timestamptz | — |

### `media_items`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| gallery_id | uuid (FK) | ensaio |
| type | enum(`photo`,`video`) | separa abas |
| drive_file_id | text | arquivo de origem |
| original_key | text | caminho do original no storage privado |
| preview_key | text | preview com marca d'água |
| thumb_key | text | miniatura com marca d'água |
| width / height | int | dimensões |
| duration_sec | int (nullable) | vídeos |
| status | enum(`pending`,`processing`,`ready`,`failed`) | processamento |
| price_cents | int (nullable) | preço avulso individual (opcional) |
| created_at | timestamptz | — |

### `pricing_plans` (por ensaio)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| gallery_id | uuid (FK) | — |
| media_type | enum(`photo`,`video`) | aplica a fotos ou vídeos |
| kind | enum(`single`,`package`,`full`) | avulso / pacote / completo |
| name | text | ex.: "Pacote 10 fotos" |
| included_qty | int (nullable) | qtd inclusa no pacote |
| price_cents | int | preço do plano |
| extra_item_cents | int (nullable) | preço por item extra |

### `selections` (carrinho/sessão da cliente)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| gallery_id | uuid (FK) | — |
| session_token | text | sessão da cliente (cookie) |
| status | enum(`open`,`submitted`,`paid`) | — |
| created_at | timestamptz | — |

### `selection_items`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| selection_id | uuid (FK) | — |
| media_id | uuid (FK) | item escolhido |

### `orders`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| gallery_id | uuid (FK) | — |
| selection_id | uuid (FK) | — |
| subtotal_cents | int | soma dos itens antes de ajustes |
| discount_cents | int (default 0) | desconto/ajuste manual da fotógrafa |
| amount_cents | int | total a pagar (subtotal − desconto) |
| status | enum(`pending`,`paid`,`expired`,`canceled`) | — |
| payment_provider | text | "mercadopago" |
| provider_payment_id | text | id do pagamento |
| payment_method | enum(`pix`,`card`) | — |
| paid_at | timestamptz (nullable) | — |
| created_at | timestamptz | — |

### `order_items`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| order_id | uuid (FK) | — |
| media_id | uuid (FK) | item comprado |
| price_cents | int | preço aplicado (0 = brinde/cortesia) |
| is_gift | bool (default false) | item concedido como brinde |

### `deliveries`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| order_id | uuid (FK) | — |
| download_url | text | link assinado |
| expires_at | timestamptz | validade do download |
| created_at | timestamptz | — |

### `audit_logs`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid (PK) | — |
| gallery_id | uuid (nullable) | — |
| event | text | ex.: `gallery_access`, `payment_approved` |
| metadata | jsonb | detalhes |
| created_at | timestamptz | — |

### Relações (resumo)
```
users 1─* galleries 1─* media_items
galleries 1─* pricing_plans
galleries 1─* selections 1─* selection_items *─1 media_items
galleries 1─* orders 1─* order_items
orders 1─1 deliveries
```

---

## 4. Integração com Google Drive

**Modelo:** OAuth 2.0 com a conta da própria fotógrafa (escopo `drive.readonly`).

Fluxo:
1. No painel, a fotógrafa clica em **"Conectar Google Drive"** → consentimento Google.
2. Guardamos o `refresh_token` (criptografado) em `drive_connections`.
3. Ao criar um ensaio, a fotógrafa **escolhe a pasta** (ou cola o link/ID da pasta).
4. **Importação:** listamos os arquivos da pasta (`files.list`), identificamos foto vs. vídeo
   por MIME type, e criamos `media_items` com `status=pending`.
5. O worker baixa cada arquivo (stream), gera derivados com marca d'água e guarda no R2.
6. O **original** é copiado para um bucket **privado** (ou mantido no Drive sem link público) e
   só é exposto via URL assinada após o pagamento.

> Para MVP, a importação é acionada por botão. Sincronização automática (Drive "watch"/push
> notifications) entra em fase posterior.

---

## 5. Integração com Mercado Pago

**Pix e cartão** via API do Mercado Pago.

- **Pix:** criamos um pagamento → recebemos **QR Code** + **copia-e-cola** → exibimos para a
  cliente. Confirmação chega por **webhook** (`payment.updated` → status `approved`).
- **Cartão:** tokenização no cliente (SDK/Bricks) → criamos o pagamento no servidor.
- **Webhook idempotente:** ao receber `approved`, marcamos `orders.status = paid`, geramos a
  `delivery` (URLs assinadas) e disparamos e-mail de entrega.
- **Conciliação:** consultamos o pagamento pela API para confirmar antes de liberar (não confiar
  só no payload do webhook).

```
Cliente confirma seleção
        │
        ▼
POST /api/checkout  ── cria order(pending) + pagamento no Mercado Pago
        │
        ▼
Pix: exibe QR/copia-e-cola   |   Cartão: confirma na hora
        │
        ▼ (assíncrono)
Webhook Mercado Pago ── valida ── order=paid ── gera delivery ── e-mail
        │
        ▼
Cliente vê tela de download (arquivos sem marca d'água)
```

---

## 6. Estrutura de pastas do projeto (proposta)

```
imageColor/
├─ docs/                      # esta documentação
├─ apps/
│  └─ web/                    # Next.js (site + admin + API)
│     ├─ app/
│     │  ├─ (admin)/          # painel da fotógrafa (protegido)
│     │  ├─ (client)/g/[token]/  # galeria da cliente
│     │  ├─ api/              # route handlers (checkout, webhooks, drive)
│     ├─ components/          # UI (shadcn/ui)
│     ├─ lib/                 # clients: supabase, mercadopago, drive, storage
│     └─ ...
├─ services/
│  └─ media-worker/           # worker Node (sharp + ffmpeg) + consumidor da fila
├─ packages/
│  ├─ db/                     # schema/migrations (Drizzle/Prisma) + tipos
│  └─ shared/                 # tipos e utils compartilhados
└─ infra/                     # IaC/configs de deploy (opcional)
```

> Monorepo (pnpm workspaces / Turborepo) para compartilhar tipos entre web e worker.
> Para um MVP enxuto, é possível começar **só com `apps/web` + `services/media-worker`**.
