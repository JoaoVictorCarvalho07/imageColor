# Plataforma de Venda de Fotos e Vídeos — Documentação

> Plataforma onde a fotógrafa publica os ensaios (fotos e vídeos, separados), as clientes
> visualizam o material **com marca d'água**, selecionam o que querem e recebem os arquivos
> finais **sem marca d'água**. As mídias podem ser puxadas do **Google Drive** ou enviadas
> direto. O **pagamento via Mercado Pago (Pix e cartão)** libera a entrega após a confirmação.

---

## Resumo das decisões

| Tema | Decisão | Situação |
|------|---------|----------|
| Acesso da cliente | **Link único + senha**, sem cadastro | Implementado |
| Acesso da fotógrafa | **Login Google (PocketBase OAuth)** + allowlist `ADMIN_EMAILS` | Implementado |
| Fonte das mídias | **Google Drive** (OAuth) e upload direto | Implementado (Drive importa só fotos) |
| Proteção | **Marca d'água** em fotos e vídeos; originais em bucket privado | Implementado |
| Seleção | Modos `free` (livre) e `quota` (cota + foto extra) | Implementado |
| Entrega | Modos `edit` (fotógrafa publica os finais) e `direct` (originais das escolhidas) | Implementado |
| Pagamento | **Pix + cartão via Mercado Pago** (Checkout Pro, webhook idempotente) | Implementado |
| Stack | Next.js 15 + PocketBase self-hosted + Cloudflare R2 (dois buckets) + Resend | Implementado |
| Processamento de mídia | Inline nos Route Handlers (sharp/ffmpeg), sem fila nem worker | Implementado |

---

## Índice da documentação

| # | Documento | O que contém |
|---|-----------|--------------|
| 01 | [Visão & Requisitos](01-visao-e-requisitos.md) | Objetivos, personas, escopo, requisitos funcionais e não-funcionais, user stories |
| 02 | [Arquitetura & Stack](02-arquitetura-e-stack.md) | Stack, decisões de arquitetura, modelo de dados do PocketBase, integrações |
| 03 | [Marca d'água & Segurança](03-marca-dagua-e-seguranca.md) | Estratégia anti-roubo, pipeline de processamento, segurança |
| 04 | [Fluxos & Telas](04-fluxos-e-telas.md) | Jornadas completas e descrição das telas (admin + cliente) |
| 05 | [Design System](05-design-system.md) | Paleta, tipografia, componentes, tom visual |
| 06 | [Roadmap & Fases](06-roadmap-e-fases.md) | Estado atual, pendências, backlog, riscos |

---

## Como usar esta documentação

1. **Leia na ordem** (01 → 06) para entender o produto de ponta a ponta.
2. Os documentos 01–03 são **decisões de produto e técnicas** (o "porquê" e o "como").
3. Os documentos 04–05 guiam o **design e a construção das telas**.
4. O documento 06 mostra **onde o projeto está** e o que vem a seguir.

Para rodar o projeto e conhecer as convenções, veja o `CLAUDE.md` na raiz do repositório.
