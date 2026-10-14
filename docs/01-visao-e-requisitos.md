# 01 — Visão & Requisitos

> **Status de implementação:** a plataforma cobre captação, importação, marca d'água, galeria,
> seleção, pagamento (Pix/cartão via Mercado Pago Checkout Pro) e entrega. Itens que ainda não
> existem estão marcados como _(planejado)_ ou _(parcial)_.
> Detalhes em [06 — Roadmap](06-roadmap-e-fases.md).

## 1. Visão do produto

Uma plataforma web que cobre **toda a jornada do material fotográfico**, desde a captação
da imagem até o pagamento e a entrega:

> A fotógrafa fotografa/filma o ensaio → sobe para o Google Drive → importa para a
> plataforma → o sistema gera versões com **marca d'água** → envia um **link + senha** para a
> cliente → a cliente **escolhe** fotos e vídeos → **paga via Pix/cartão** → recebe os
> arquivos **finais sem marca d'água**.

### Problema que resolve
- Hoje a seleção costuma ser feita por WhatsApp/pendrive/links soltos do Drive — confuso,
  inseguro e sem proteção contra cópia.
- Não há controle de quais fotos a cliente escolheu, nem cobrança automática.
- Risco de a cliente baixar tudo em alta sem pagar.

### Proposta de valor
- **Para a fotógrafa:** profissionaliza a entrega, automatiza cobrança, protege o trabalho.
- **Para a cliente:** experiência bonita e simples de escolher e pagar.

---

## 2. Personas

### 👩‍💼 Fotógrafa (Administradora) — "Ana"
- Tira fotos e grava vídeos de ensaios (gestante, newborn, família, casamento, eventos).
- Organiza tudo no Google Drive por pastas de ensaio.
- Quer **vender mais** e **parar de perder tempo** com seleção manual e cobrança.
- Não é técnica — a ferramenta precisa ser **simples**.

### 👰 Cliente (Compradora) — "Marina"
- Recebeu um ensaio e vai escolher as fotos/vídeos que mais gostou.
- Acessa pelo **celular** na maioria das vezes.
- Quer um processo **fácil, bonito e confiável** para escolher e pagar.

### (Futuro) Assistente / 2ª fotógrafa
- Pode ajudar a importar e organizar ensaios. *(fora do MVP, mas a modelagem prevê papéis)*

---

## 3. Escopo

### ✅ Já implementado
- Painel administrativo da fotógrafa (login Google + allowlist de e-mails).
- Conexão com Google Drive e importação de **fotos** por pasta; vídeos entram por upload direto.
- Geração automática de **previews com marca d'água** (fotos e vídeos).
- Galeria da cliente com **abas separadas de Fotos e Vídeos**, acesso por **link + senha**.
- Seleção de itens, com modo **livre** ou **por cota** (fotos inclusas + preço da extra).
- Cadastro de planos de preço: **avulso, pacotes e galeria completa** (fotos e vídeos distintos).
- Envio da seleção, com aviso por e-mail à fotógrafa.
- Entrega dos arquivos **sem marca d'água**: modo **edição** (a fotógrafa publica os finais) ou
  **direto** (a cliente baixa os originais das escolhidas), por URL assinada ou ZIP.
- Notificações por **e-mail** (seleção recebida, entrega publicada) via Resend.

### ✅ Pagamento (Mercado Pago)
- Checkout com **Pix e cartão (até 12x)** via Mercado Pago Checkout Pro, logo após o envio da seleção.
- Confirmação de pagamento via **webhook idempotente**, com sincronização no retorno da cliente.
- Liberação da entrega somente após o pagamento confirmado.
- E-mail de pagamento aprovado para a fotógrafa e para a cliente.
- Status de pagamento por ensaio no painel e baixa manual ("Marcar como pago").

### 🔭 Fases seguintes (depois do pagamento)
- Multi-fotógrafo / multi-tenant (SaaS para outras fotógrafas).
- Álbuns impressos e produtos físicos.
- Cupons e campanhas de marketing.
- App mobile dedicado.
- Assinaturas/planos.
- Integração com WhatsApp (envio automático do link).

### ❌ Fora do escopo
- Edição de fotos dentro da plataforma (continua no software da fotógrafa).
- Rede social / comentários públicos.

---

## 4. Requisitos Funcionais (RF)

### Administração (fotógrafa)
| ID | Requisito |
|----|-----------|
| RF-01 | Fazer login no painel administrativo de forma segura (Google OAuth + allowlist). |
| RF-02 | Conectar a conta do Google Drive (autorização OAuth). |
| RF-03 | Criar um ensaio e vinculá-lo a uma pasta do Google Drive. |
| RF-04 | Importar automaticamente as mídias da pasta (fotos e vídeos), identificando o tipo. |
| RF-05 | Acompanhar o status de processamento (importando / gerando marca d'água / pronto). |
| RF-06 | Configurar marca d'água. _Hoje: texto definido por variável de ambiente; logo e opacidade pela interface são futuros._ |
| RF-07 | **Liberdade total de precificação por ensaio:** definir avulso, pacotes (ex: 10 fotos), galeria completa e preço de vídeos — com valores livres por ensaio. |
| RF-07b | **Itens de brinde/cortesia:** marcar fotos/vídeos como gratuitos (preço 0) ou conceder "N itens grátis" sem afetar o pagamento dos demais; aplicar descontos/ajuste manual no total. |
| RF-08 | Gerar **link único + senha** do ensaio e compartilhar com a cliente. |
| RF-09 | Definir **prazos configuráveis por ensaio**: expiração do acesso e validade do download (com um default sugerido, mas editável). |
| RF-10 | Ver a seleção da cliente e o status do pedido em tempo real. |
| RF-11 | Acompanhar pagamentos e financeiro (recebido, pendente). _Parcial: status, método e data por ensaio, com baixa manual; dashboard financeiro consolidado é futuro._ |
| RF-12 | Reenviar acesso/entrega; reabrir ou encerrar um ensaio. |

### Cliente
| ID | Requisito |
|----|-----------|
| RF-20 | Acessar a galeria com **link + senha**. |
| RF-21 | Visualizar fotos e vídeos em **abas separadas**, com **marca d'água**. |
| RF-22 | Abrir item em tela cheia (lightbox / player) com marca d'água. |
| RF-23 | Favoritar/selecionar itens e ver um resumo da seleção (carrinho). |
| RF-24 | Escolher um pacote/forma de compra e ver o total calculado. |
| RF-25 | Pagar via **Pix** ou **cartão** na tela do Mercado Pago (Checkout Pro); boleto e caixa eletrônico ficam de fora. |
| RF-26 | Acessar o **download dos arquivos finais** sem marca d'água. _Liberado pela fotógrafa (modo `edit`) ou pelo envio da seleção (modo `direct`), sempre condicionado ao pagamento confirmado quando o total é maior que zero._ |
| RF-27 | Reacessar a entrega dentro do prazo de validade. |

### Sistema
| ID | Requisito |
|----|-----------|
| RF-30 | Gerar previews com marca d'água em resolução reduzida para fotos e vídeos. |
| RF-31 | Manter os arquivos originais **inacessíveis** antes do pagamento. |
| RF-32 | Processar o webhook do Mercado Pago e liberar a entrega ao confirmar pagamento. |
| RF-33 | Gerar links de download assinados e com expiração. _Implementado (URLs assinadas do R2); downloads bloqueados enquanto o pagamento não é confirmado._ |
| RF-34 | Enviar e-mails transacionais (acesso, pagamento, entrega). |
| RF-35 | Registrar log/auditoria de acessos, seleções e pagamentos. _Parcial: há registro de tentativas de senha e de eventos de pagamento (`payment_events`); auditoria completa é futura._ |

---

## 5. Requisitos Não-Funcionais (RNF)

| ID | Categoria | Requisito |
|----|-----------|-----------|
| RNF-01 | Usabilidade | Interface da cliente **mobile-first**, simples, no máximo 3 passos até o pagamento. |
| RNF-02 | Performance | Galeria com lazy-loading; previews otimizados (WebP/AVIF) e via CDN. |
| RNF-03 | Segurança | Originais nunca expostos publicamente; downloads via URLs assinadas e temporárias. |
| RNF-04 | Segurança | Senha do ensaio com hash scrypt; limite de tentativas (5 falhas em 15 min bloqueiam por 15 min). |
| RNF-05 | Proteção de conteúdo | Marca d'água visível e difícil de remover; preview em baixa resolução. |
| RNF-06 | Privacidade | LGPD: consentimento, dados mínimos, exclusão sob solicitação. |
| RNF-07 | Confiabilidade | Webhook idempotente (chave `paymentId:status`); reprocessamento de mídia em caso de falha. |
| RNF-08 | Escalabilidade | Processamento de mídia **inline** nos Route Handlers (sharp/ffmpeg), sem fila nem worker. Ensaios grandes são importados em lotes dentro do limite de 300 s por requisição. |
| RNF-09 | Custo | Preferir serviços com bom custo de egress (CDN/storage) para volume de imagens. |
| RNF-10 | Acessibilidade | Contraste adequado, navegação por teclado, textos alternativos. |
| RNF-11 | Observabilidade | Logs e monitoramento de erros (processamento, pagamento). _Hoje só logs do servidor; monitoramento dedicado é futuro._ |

---

## 6. User Stories principais

> **US-01** — Como fotógrafa, quero conectar uma pasta do Drive a um ensaio para que as fotos
> sejam importadas automaticamente, sem upload manual.

> **US-02** — Como fotógrafa, quero que o sistema aplique marca d'água automaticamente para
> proteger meu trabalho antes da compra.

> **US-03** — Como fotógrafa, quero gerar um link com senha e enviar para a cliente, para que
> só ela veja o ensaio.

> **US-04** — Como cliente, quero ver as fotos e os vídeos separados e marcar minhas favoritas
> no celular de forma simples.

> **US-05** — Como cliente, quero pagar por Pix em segundos e já receber as fotos finais.

> **US-06** — Como fotógrafa, quero ser avisada quando o pagamento cair e ver quanto já vendi. _(aviso por e-mail na aprovação e status por ensaio; total vendido consolidado é futuro)_

---

## 7. Regras de negócio (RN)

- **RN-01** — A cliente só vê **previews com marca d'água** antes da entrega.
- **RN-02** — O download dos originais/finais só é liberado na entrega. _Publicação pela fotógrafa (modo `edit`) ou envio da seleção (modo `direct`), **sempre após confirmação do pagamento** quando o total é maior que zero._
- **RN-03** — Fotos e vídeos têm **preços e pacotes independentes**, definidos livremente pela fotógrafa por ensaio.
- **RN-04** — Pacotes podem definir **quantidade inclusa** e **preço por item extra**.
- **RN-04b** — A fotógrafa pode conceder **brindes/cortesias** (itens com preço 0 ou "N grátis") e
  aplicar **desconto/ajuste manual** no total, sem travar o checkout dos itens pagos.
- **RN-05** — Links de entrega **expiram** após um prazo **configurável** (default sugerido: 30 dias).
- **RN-06** — O ensaio tem **prazo de acesso configurável** para a cliente escolher (default sugerido: 15 dias).
- **RN-07** — Pagamentos parciais não liberam a entrega — só o pedido **pago integralmente**; reembolso ou chargeback bloqueia a entrega de novo.
- **RN-08** — A seleção da cliente fica **salva** mesmo se ela sair e voltar (via sessão do link).
- **RN-09** — No modo de seleção **por cota**, o ensaio inclui N fotos; cada foto além da cota custa o valor da foto extra.
- **RN-10** — Uma seleção **enviada** fica travada; só a fotógrafa pode reabri-la. _(regra alvo; a reabertura pelo painel está em andamento)_
