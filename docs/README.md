# 📸 Plataforma de Venda de Fotos e Vídeos — Documentação

> Plataforma onde a fotógrafa publica os ensaios (fotos e vídeos, separados), as clientes
> visualizam o material **com marca d'água**, selecionam o que querem, pagam via **Pix/cartão
> (Mercado Pago)** e recebem os arquivos finais **sem marca d'água**. As mídias são puxadas
> direto do **Google Drive**.

---

## 🎯 Resumo das decisões já tomadas

| Tema | Decisão |
|------|---------|
| Pagamento | **Pix + Mercado Pago** (cartão e Pix) |
| Acesso da cliente | **Link único + senha** (sem necessidade de cadastro) |
| Fonte das mídias | **Google Drive** (importação automática) |
| Proteção | **Marca d'água** em fotos e vídeos antes da compra |
| Escopo do MVP | **Fluxo completo**: captação → galeria → seleção → pagamento → entrega |
| Stack | Definida neste documento (Next.js + Supabase + worker de mídia) |

---

## 📚 Índice da documentação

| # | Documento | O que contém |
|---|-----------|--------------|
| 00 | [Visão & Requisitos](01-visao-e-requisitos.md) | Objetivos, personas, escopo, requisitos funcionais e não-funcionais, user stories |
| 01 | [Arquitetura & Stack](02-arquitetura-e-stack.md) | Stack escolhida e justificativa, arquitetura, modelo de dados, integrações |
| 02 | [Marca d'água & Segurança](03-marca-dagua-e-seguranca.md) | Estratégia anti-roubo, pipeline de processamento, segurança |
| 03 | [Fluxos & Telas](04-fluxos-e-telas.md) | Jornadas completas e descrição de todas as telas (admin + cliente) |
| 04 | [Design System](05-design-system.md) | Paleta, tipografia, componentes, tom visual |
| 05 | [Roadmap & Fases](06-roadmap-e-fases.md) | MVP, fases, backlog priorizado, riscos e estimativas |

---

## 🧭 Como usar esta documentação

1. **Leia na ordem** (00 → 05) para entender o produto de ponta a ponta.
2. Os documentos 00–02 são **decisões de produto e técnicas** (o "porquê" e o "como").
3. Os documentos 03–04 guiam o **design e a construção das telas**.
4. O documento 05 é o **plano de execução** — por onde começar a codar.

> **Status:** versão 1.0 — levantamento inicial. Tudo aqui é revisável conforme validamos com a fotógrafa e com clientes reais.
