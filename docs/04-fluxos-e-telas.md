# 04 — Fluxos & Telas

> **Status:** o pagamento é implementado (Mercado Pago Checkout Pro). A cliente paga logo após
> montar a seleção; o dashboard financeiro consolidado e a tela de pedidos (A7) **ainda não
> existem** e estão marcados como _(planejado)_. Os wireframes continuam válidos como alvo de design.
> Com total maior que zero, a entrega (modo edição ou direto) só libera após o pagamento confirmado.

## 1. Jornada completa (visão macro)

```
[CAPTAÇÃO]            [PREPARAÇÃO - ADMIN]                 [VENDA - CLIENTE]               [ENTREGA]
Fotografa/filma  →   Sobe pro Google Drive           →   Recebe link + senha         →  Recebe download
                     Cria ensaio + conecta pasta          Acessa galeria                 sem marca d'água
                     Importa mídias                       Vê Fotos / Vídeos (abas)       (links assinados)
                     Sistema gera marca d'água            Seleciona favoritas
                     Define preços/pacotes                Escolhe pacote
                     Gera link + senha → envia            Envia a seleção e paga (Pix/cartão)
```

---

## 2. Fluxo da Fotógrafa (Admin)

1. **Login** com Google (somente e-mails da allowlist).
2. **Conectar Google Drive** (uma vez).
3. **Novo ensaio:** título, nome e e-mail da cliente, senha e prazo de acesso.
4. **Adicionar mídias:** importar uma **pasta do Drive** (fotos) ou enviar fotos e vídeos direto
   do computador; o progresso aparece durante o processamento (marca d'água).
5. **Configurar o ensaio:** modo de seleção (livre ou por cota), destino da seleção (edição ou
   direto), prazos e **planos de preço** (pacotes, avulso, galeria completa, vídeos).
6. **Copiar o link do ensaio** e enviar para a cliente; a senha é definida no painel.
7. **Acompanhar** a seleção enviada (a fotógrafa recebe e-mail e vê os nomes dos arquivos).
8. **Entrega (modo edição):** subir as fotos editadas e **publicar**; a cliente é avisada por e-mail.
9. **Pagamento:** ver no ensaio se a seleção está **Aguardando pagamento** ou **Paga** (método e
   data) e, se a cliente pagou fora da plataforma, usar **Marcar como pago**. Seleção paga não
   pode ser reaberta. Dashboard financeiro consolidado: _(planejado)_.

## 3. Fluxo da Cliente

1. **Abrir o link** → tela de senha → entra.
2. **Galeria:** navega nas abas **Fotos** e **Vídeos** (previews com marca d'água).
3. **Selecionar:** toca no coração/checkbox; vê contador da seleção.
4. **Revisar seleção:** abre o carrinho, confere itens, **escolhe pacote**, vê total.
5. **Pagar:** em "Ir para o pagamento", a seleção é enviada e travada e a cliente vai ao Mercado
   Pago (Pix ou cartão em até 12x). Ao voltar, `/g/[token]/selecao` confirma o pagamento.
   Se o total é zero, não há pagamento: a seleção só é enviada.
6. **Pagamento pendente:** pode **Pagar agora** (retoma o checkout), **Já paguei, verificar**
   (consulta o Mercado Pago) ou **Alterar seleção** (cancela o pedido e reabre a seleção).
7. **Download** dos arquivos sem marca d'água, após o pagamento confirmado: quando a fotógrafa
   publica a entrega (modo edição) ou logo após o pagamento (modo direto).

---

## 4. Mapa de telas

### 🔐 Área da Fotógrafa (Admin)
| # | Tela | Função |
|---|------|--------|
| A1 | **Login** | Autenticação da fotógrafa. |
| A2 | **Dashboard / Lista de Ensaios** | Ensaios com status e link para a galeria. Vendas e pendências de pagamento consolidadas são planejadas. |
| A3 | **Novo Ensaio** | Título, cliente, e-mail, senha e prazo de acesso. |
| A4 | **Detalhe do Ensaio** | Importação do Drive, upload de mídias, grade, configurações (seleção, entrega, prazos), planos de preço, senha, link, seleção da cliente, **status de pagamento** ("Aguardando pagamento" / "Paga", com método e data, e "Marcar como pago") e entrega. Tudo em `/admin/ensaios/[id]`. |
| A5 | **Marca d'água (Configurações)** | Não existe tela: o texto vem de `WATERMARK_TEXT`. Logo e opacidade são futuros. |
| A6 | **Conectar Google Drive** | Botão no `/admin` que inicia o OAuth. |
| A7 | **Financeiro / Pedidos** | Pagamentos recebidos, pendentes, histórico consolidado. _(planejado; por ensaio, o status de pagamento já aparece em A4)_ |
| A8 | **Configurações da Conta** | Conta Google Drive e perfil. _(parcial; o Mercado Pago é configurado por variáveis de ambiente, sem tela)_ |

### 🖼️ Área da Cliente
| # | Tela | Função |
|---|------|--------|
| C1 | **Acesso (link + senha)** | Entrada na galeria. |
| C2 | **Galeria — aba Fotos** | Grade de fotos com marca d'água. |
| C3 | **Galeria — aba Vídeos** | Grade de vídeos com marca d'água. |
| C4 | **Lightbox / Player** | Visualização ampliada com marca d'água + selecionar. |
| C5 | **Minha Seleção (carrinho)** | Itens escolhidos + escolha de pacote + total. |
| C6 | **Checkout** | Página do Mercado Pago (Pix ou cartão), aberta por "Ir para o pagamento". |
| C7 | **Aguardando Pagamento** | Em `/g/[token]/selecao`: "Pagar agora", "Já paguei, verificar" e "Alterar seleção". |
| C8 | **Entrega & Download** | Arquivos sem marca d'água, individuais ou em ZIP (`/g/[token]/entrega`). |

### 🌐 Públicas (opcional/fase 2)
| # | Tela | Função |
|---|------|--------|
| P1 | **Landing page** | Apresentação do trabalho da fotógrafa. |
| P2 | **Portfólio** | Galerias públicas selecionadas. |

---

## 5. Wireframes (baixa fidelidade)

### C1 — Acesso (link + senha)
```
┌───────────────────────────────┐
│           [ LOGO ]            │
│                               │
│      Ensaio de Marina 💕      │
│   Digite a senha para entrar  │
│                               │
│   ┌───────────────────────┐   │
│   │ • • • • • •           │   │
│   └───────────────────────┘   │
│      [   Entrar   ]           │
│                               │
│   Acesso válido até 30/06     │
└───────────────────────────────┘
```

### C2/C3 — Galeria (mobile)
```
┌───────────────────────────────┐
│ Ensaio Marina      ♡ 4 itens │  ← header + contador da seleção
│ ┌─────────┬─────────┐         │
│ │  Fotos  │ Vídeos  │         │  ← abas separadas
│ └─────────┴─────────┘         │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ ░img│ │ ░img│ │ ░img│       │  ← previews com marca d'água
│ │   ♡│ │   ♥│ │   ♡│        │  ← favoritar no canto
│ └─────┘ └─────┘ └─────┘       │
│ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │ ░img│ │ ░img│ │ ░img│       │
│ │   ♡│ │   ♡│ │   ♥│        │
│ └─────┘ └─────┘ └─────┘       │
│                               │
│ [   Ver minha seleção (4) →  ]│  ← CTA fixo no rodapé
└───────────────────────────────┘
```

### C4 — Lightbox / Player
```
┌───────────────────────────────┐
│ ✕                       3 / 48│
│                               │
│      ░░░ FOTO AMPLIADA ░░░     │  ← com marca d'água diagonal
│      ░░░ (marca d'água) ░░░    │
│                               │
│  ‹                          › │
│        [ ♥ Selecionar ]       │
└───────────────────────────────┘
```

### C5 — Minha Seleção (carrinho)
```
┌───────────────────────────────┐
│ ← Minha Seleção               │
│                               │
│ Fotos selecionadas: 8         │
│ ┌──┐┌──┐┌──┐┌──┐┌──┐          │  ← miniaturas
│ └──┘└──┘└──┘└──┘└──┘          │
│                               │
│ Escolha um pacote:            │
│ ( ) Pacote 5 fotos — R$ 150   │
│ (•) Pacote 10 fotos — R$ 250  │
│ ( ) Galeria completa — R$ 600 │
│                               │
│ Vídeos: 1  (R$ 80 cada)       │
│ ─────────────────────────────│
│ Total:            R$ 330,00   │
│ [     Ir para pagamento  →   ]│
└───────────────────────────────┘
```

### C7 — Aguardando pagamento
```
┌───────────────────────────────┐
│ Seleção enviada               │
│ ⏳ Aguardando pagamento       │
│    Total: R$ 330,00           │
│                               │
│ [ 💳 Pagar agora ]            │
│ [ 🔄 Já paguei, verificar ]   │
│ [ ✏️ Alterar seleção ]        │
└───────────────────────────────┘
```

### C8 — Entrega & Download
```
┌───────────────────────────────┐
│      ✅ Pagamento aprovado!   │
│                               │
│  Suas fotos estão prontas 🎉  │
│  ┌──┐┌──┐┌──┐┌──┐             │
│  └──┘└──┘└──┘└──┘             │
│  [ ⬇ Baixar todas (.zip) ]    │
│  [ ⬇ Baixar individual ]      │
│                               │
│  Links válidos até 30/07      │
└───────────────────────────────┘
```

### A2 — Dashboard (desktop, alvo; hoje só a lista de ensaios)
```
┌────────────────────────────────────────────────────┐
│ 📸 Painel        Ensaios  Financeiro  Config   [👤] │
├────────────────────────────────────────────────────┤
│  Vendas do mês     Ensaios ativos    Aguardando pgto│
│  ┌──────────┐      ┌──────────┐      ┌──────────┐   │
│  │ R$ 4.250 │      │    6     │      │    3      │  │
│  └──────────┘      └──────────┘      └──────────┘   │
│                                                      │
│  Ensaios recentes                       [+ Novo]     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Marina — Gestante      ● Pronto   2 dias atrás │ │
│  │ Família Souza          ◐ Processando           │ │
│  │ Casamento Júlia        ● Pago     R$ 1.200     │ │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### A4/A5 — Novo Ensaio + Importação
```
┌────────────────────────────────────────────────────┐
│ Novo Ensaio                                          │
│ Título:    [ Ensaio Gestante — Marina            ]   │
│ Cliente:   [ Marina Silva           ▼ ] [+ nova]     │
│ Expira em: [ 30/06/2026 ]                            │
│                                                      │
│ Pasta do Google Drive:                               │
│ [ 📁 /Ensaios/Marina-Gestante      ] [ Escolher ]    │
│                                                      │
│ [ Importar mídias ]                                  │
│ ──────────────────────────────────────────────────  │
│ Importação: 48 fotos, 3 vídeos                       │
│ Marca d'água: ████████░░ 80%  (gerando previews)     │
└────────────────────────────────────────────────────┘
```

---

## 6. Estados e mensagens importantes

| Situação | Comportamento |
|----------|---------------|
| Senha errada (cliente) | Mensagem amigável; após 5 falhas em 15 min, bloqueio temporário. |
| Ensaio expirado | Tela informando expiração e contato da fotógrafa. |
| Processamento incompleto | Galeria mostra só itens prontos; admin vê progresso. |
| Pagamento pendente | Downloads bloqueados; a cliente pode retomar o checkout, verificar ou alterar a seleção. Sem `notification_url` (dev local), a confirmação vem da sincronização no retorno. |
| Pagamento recusado ou abandonado | Pedido segue pendente; "Pagar agora" reabre o checkout e "Alterar seleção" cancela o pedido. |
| Reembolso / chargeback | Downloads bloqueados de novo. |
| Download expirado | Mensagem + opção de solicitar reenvio à fotógrafa. |
| Nenhum item selecionado | CTA de pagamento desabilitado com dica. |
