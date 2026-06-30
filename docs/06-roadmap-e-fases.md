# 05 — Roadmap & Fases

> Decisão: o MVP cobre o **fluxo completo** (captação → galeria → seleção → pagamento → entrega).
> Para reduzir risco, dividimos a construção em **etapas internas** que entregam valor de forma
> incremental, mas o objetivo da v1 é o ciclo inteiro funcionando.

---

## 1. Fases de construção (dentro do MVP)

### Etapa 0 — Fundação (setup)
- Monorepo (`apps/web`, `services/media-worker`, `packages/db`).
- Next.js + Tailwind + shadcn/ui; Supabase (DB/Auth); schema inicial (migrations).
- Variáveis de ambiente e segredos; deploy base na Vercel.
- **Entrega:** projeto rodando com login da fotógrafa.

### Etapa 1 — Ingestão do Google Drive
- OAuth do Drive + guardar `refresh_token`.
- Criar ensaio e vincular pasta; importar `media_items` (foto/vídeo).
- **Entrega:** ensaio criado com mídias listadas (ainda sem marca d'água).

### Etapa 2 — Processamento & marca d'água
- Fila + worker (sharp para fotos, ffmpeg para vídeos).
- Gerar previews/thumbs com marca d'água; original em storage privado.
- Configuração de marca d'água no admin.
- **Entrega:** galeria interna com previews protegidos.

### Etapa 3 — Galeria da cliente
- Acesso por link + senha (sessão temporária, rate limit).
- Abas Fotos/Vídeos, grade, lightbox/player, favoritar/seleção (carrinho persistente).
- **Entrega:** cliente acessa e seleciona itens.

### Etapa 4 — Preços & pagamento
- Configuração de pacotes/avulso/completo (fotos e vídeos).
- Carrinho com cálculo de total + seletor de pacote.
- Checkout Mercado Pago (Pix + cartão) + webhook idempotente.
- **Entrega:** cliente paga e o pedido é confirmado.

### Etapa 5 — Entrega & notificações
- Geração de links assinados (download individual e .zip) pós-pagamento.
- E-mails transacionais (acesso, pagamento aprovado, entrega) via Resend.
- Tela de confirmação/download com expiração.
- **Entrega:** ciclo completo de ponta a ponta. 🎉

### Etapa 6 — Acabamento
- Dashboard e financeiro do admin.
- Estados de erro, monitoramento (Sentry), ajustes de LGPD.
- Testes do fluxo crítico (seleção → pagamento → entrega).
- **Entrega:** MVP pronto para uso real.

---

## 2. Backlog priorizado (resumo)

| Prioridade | Item |
|-----------|------|
| 🔴 Alta | OAuth Drive + importação |
| 🔴 Alta | Marca d'água (fotos) |
| 🔴 Alta | Galeria + acesso link/senha |
| 🔴 Alta | Seleção/carrinho |
| 🔴 Alta | Checkout Pix + webhook |
| 🔴 Alta | Entrega com links assinados |
| 🟡 Média | Marca d'água (vídeos) |
| 🟡 Média | Pagamento por cartão |
| 🟡 Média | Dashboard/financeiro |
| 🟡 Média | E-mails transacionais |
| 🟢 Baixa | Landing/portfólio público |
| 🟢 Baixa | Cupons, multi-fotógrafo, WhatsApp, álbuns |

---

## 3. Riscos & mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Processamento de vídeo pesado/custoso | Alto | Worker dedicado, preview baixa resolução, duração limitada, processar sob demanda. |
| Custos de storage/egress com muitas imagens | Médio | R2 (egress grátis) + CDN + formatos WebP/AVIF. |
| Limites/quotas da API do Drive | Médio | Importação em lote com backoff; cache de metadados. |
| Cliente conseguir "roubar" preview | Médio | Baixa resolução + marca d'água diagonal; alinhar expectativa. |
| Webhook do Mercado Pago duplicado/perdido | Alto | Idempotência + reconsulta por API + reconciliação. |
| Curva de uso da fotógrafa (não técnica) | Médio | UX simples, textos guiados, onboarding curto. |
| LGPD | Médio | Consentimento, dados mínimos, política de retenção. |

---

## 4. Definição de pronto (MVP)

O MVP está pronto quando, de ponta a ponta:
1. A fotógrafa conecta o Drive e cria um ensaio importando as mídias. ✅
2. O sistema gera previews com marca d'água (fotos e vídeos). ✅
3. A cliente acessa por link + senha e seleciona itens. ✅
4. A cliente paga por Pix (e cartão) e o pagamento é confirmado por webhook. ✅
5. A cliente baixa os arquivos finais **sem marca d'água** via link assinado. ✅
6. A fotógrafa vê a venda no painel. ✅

---

## 5. Próximos passos sugeridos

1. **Validar este levantamento** com a fotógrafa (preços, pacotes, prazos, identidade visual).
2. **Definir o acento visual** e a logo/marca d'água.
3. **Criar contas:** Supabase, Cloudflare R2, Mercado Pago (credenciais de teste), Google Cloud
   (OAuth Drive), Resend, Vercel.
4. **Iniciar a Etapa 0** (fundação do projeto).
5. (Opcional) Eu posso gerar protótipos navegáveis das telas principais e/ou começar o scaffold
   do código.
