# 06 — Roadmap & Fases

> O objetivo da v1 é o **fluxo completo** (captação → galeria → seleção → pagamento → entrega).
> O sistema cobre o fluxo inteiro, incluindo o pagamento com Mercado Pago. Este documento lista
> só o que falta.

---

## 1. Estado atual

| Etapa | Escopo | Situação |
|-------|--------|----------|
| 0 — Fundação | Next.js, Tailwind, PocketBase self-hosted, schema por `scripts/pb-setup.mjs`, login Google com allowlist | Pronta |
| 1 — Ingestão do Drive | OAuth do Drive, importação de **fotos** por pasta, upload direto de fotos e vídeos | Pronta |
| 2 — Processamento | Marca d'água em fotos (sharp) e vídeos (ffmpeg), inline nos Route Handlers, dois buckets no R2 | Pronta |
| 3 — Galeria da cliente | Link + senha, abas Fotos e Vídeos, lightbox, seleção persistente, modos `free` e `quota` | Pronta |
| 5 — Entrega e notificações | Modos `edit` e `direct`, URLs assinadas, ZIP, e-mails via Resend; downloads condicionados ao pagamento | Pronta |
| 4 — Preços e pagamento | Planos de preço, checkout Mercado Pago (Pix e cartão), pedidos, webhook idempotente, baixa manual | Pronta |
| 6 — Acabamento | Dashboard financeiro, monitoramento, testes automatizados do fluxo crítico | Parcial: há uma suíte ponta a ponta de desenvolvimento (`/api/dev/e2e`) |

Pendências de endurecimento (validação da seleção no servidor, limite de tentativas, mídia, bugs
da cliente) estão no `TODO.md` na raiz.

---

## 2. Para colocar o pagamento em produção

- Rodar `node --env-file=.env.local scripts/pb-setup.mjs` no PocketBase de produção (cria `orders`,
  `payment_events` e `selections.amount_cents`).
- Definir `MERCADOPAGO_ACCESS_TOKEN` (produção) e `APP_URL` com https.
- Cadastrar no painel do Mercado Pago a URL `<APP_URL>/api/webhooks/mercadopago` e copiar a
  assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`.

---

## 3. Backlog priorizado

| Prioridade | Item |
|-----------|------|
| 🟡 Média | Dashboard/financeiro consolidado |
| 🟡 Média | Limpeza de objetos órfãos no R2 |
| 🟡 Média | Worker/fila para vídeos longos |
| 🟡 Média | Importar vídeos do Drive (hoje só fotos) |
| 🟡 Média | Logo e opacidade da marca d'água pela interface |
| 🟢 Baixa | Landing/portfólio público |
| 🟢 Baixa | Cupons, multi-fotógrafo, WhatsApp, álbuns |

---

## 4. Riscos & mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Processamento inline estoura o tempo da função (vídeos longos, lotes grandes de fotos) | Alto | Preview limitado a 90 s; importação do Drive em fluxo contínuo, uma foto por vez; se virar gargalo, extrair um worker com fila. |
| Custos de storage/egress com muitas imagens | Médio | R2 (egress grátis) + previews em WebP. |
| Limites/quotas da API do Drive | Médio | Não reimportar o que já veio (por `drive_file_id`); retry e timeout por arquivo estão no `TODO.md`. |
| Cliente conseguir "roubar" preview | Médio | Baixa resolução + marca d'água diagonal; alinhar expectativa. |
| Webhook do Mercado Pago duplicado/perdido | Alto | Idempotência por `paymentId:status`, reconsulta por API e sincronização no retorno da cliente e em "Já paguei, verificar". |
| PocketBase self-hosted: backup e disponibilidade | Alto | Backup periódico do `pb_data`; superuser com senha forte; servidor fora da internet pública quando possível. |
| Curva de uso da fotógrafa (não técnica) | Médio | UX simples, textos guiados, onboarding curto. |
| LGPD | Médio | Consentimento, dados mínimos, política de retenção. |

---

## 5. Definição de pronto (MVP)

O MVP está pronto quando, de ponta a ponta, **todos** os itens abaixo valerem. Os itens já
atendidos (Drive, marca d'água em fotos e vídeos, acesso por link e senha, seleção, entrega por
URL assinada) não aparecem aqui; falta:

- [ ] Pagamento em produção configurado (seção 2) e testado com um pagamento real.
- [ ] A fotógrafa vê o total recebido e pendente consolidado no painel.
- [ ] Teste automatizado cobre seleção → pagamento → entrega.

---

## 6. Próximos passos sugeridos

1. **Validar com a fotógrafa** preços, pacotes, prazos e o fluxo de seleção por cota.
2. **Concluir o endurecimento** listado no `TODO.md` antes de abrir para clientes reais.
3. **Ativar o pagamento em produção** conforme a seção 2.
