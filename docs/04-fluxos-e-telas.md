# 03 — Fluxos & Telas

## 1. Jornada completa (visão macro)

```
[CAPTAÇÃO]            [PREPARAÇÃO - ADMIN]                 [VENDA - CLIENTE]               [ENTREGA]
Fotografa/filma  →   Sobe pro Google Drive           →   Recebe link + senha         →  Recebe download
                     Cria ensaio + conecta pasta          Acessa galeria                 sem marca d'água
                     Importa mídias                       Vê Fotos / Vídeos (abas)       (links assinados)
                     Sistema gera marca d'água            Seleciona favoritas
                     Define preços/pacotes                Escolhe pacote
                     Gera link + senha → envia            Paga (Pix/cartão)
```

---

## 2. Fluxo da Fotógrafa (Admin)

1. **Login** no painel.
2. **Conectar Google Drive** (uma vez).
3. **Novo ensaio:** título, cliente, selecionar **pasta do Drive**, data de expiração.
4. **Importar mídias** → acompanhar status (importando → marca d'água → pronto).
5. **Configurar preços:** pacotes de fotos, fotos avulsas, preço de vídeos, galeria completa.
6. **Gerar link + senha** e enviar para a cliente (copiar link / e-mail).
7. **Acompanhar** seleção e pagamento em tempo real.
8. **Financeiro:** ver recebidos e pendentes.

## 3. Fluxo da Cliente

1. **Abrir o link** → tela de senha → entra.
2. **Galeria:** navega nas abas **Fotos** e **Vídeos** (previews com marca d'água).
3. **Selecionar:** toca no coração/checkbox; vê contador da seleção.
4. **Revisar seleção:** abre o carrinho, confere itens, **escolhe pacote**, vê total.
5. **Pagar:** Pix (QR/copia-e-cola) ou cartão.
6. **Confirmação:** pagamento aprovado → **download** dos arquivos finais.

---

## 4. Mapa de telas

### 🔐 Área da Fotógrafa (Admin)
| # | Tela | Função |
|---|------|--------|
| A1 | **Login** | Autenticação da fotógrafa. |
| A2 | **Dashboard** | Visão geral: ensaios ativos, vendas do mês, pendências. |
| A3 | **Lista de Ensaios** | Todos os ensaios com status e busca. |
| A4 | **Novo/Editar Ensaio** | Dados do ensaio + conectar pasta do Drive. |
| A5 | **Importação & Processamento** | Status de importação e geração de marca d'água. |
| A6 | **Configuração de Preços/Pacotes** | Definir planos de fotos e vídeos. |
| A7 | **Marca d'água (Configurações)** | Logo, opacidade, padrão. |
| A8 | **Compartilhar Ensaio** | Link + senha, copiar/enviar por e-mail. |
| A9 | **Detalhe do Ensaio / Seleção da Cliente** | Ver o que a cliente escolheu e status do pedido. |
| A10 | **Financeiro / Pedidos** | Pagamentos recebidos, pendentes, histórico. |
| A11 | **Configurações da Conta** | Conta Google Drive, Mercado Pago, perfil. |

### 🖼️ Área da Cliente
| # | Tela | Função |
|---|------|--------|
| C1 | **Acesso (link + senha)** | Entrada na galeria. |
| C2 | **Galeria — aba Fotos** | Grade de fotos com marca d'água. |
| C3 | **Galeria — aba Vídeos** | Grade de vídeos com marca d'água. |
| C4 | **Lightbox / Player** | Visualização ampliada com marca d'água + selecionar. |
| C5 | **Minha Seleção (carrinho)** | Itens escolhidos + escolha de pacote + total. |
| C6 | **Checkout** | Pix (QR/copia-e-cola) ou cartão. |
| C7 | **Aguardando Pagamento** | Status do Pix em tempo real. |
| C8 | **Confirmação & Download** | Arquivos finais sem marca d'água. |

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

### C6/C7 — Checkout Pix
```
┌───────────────────────────────┐
│ Pagamento — Pix               │
│   ┌───────────────┐           │
│   │  ▓▓ QR CODE ▓▓ │          │
│   └───────────────┘           │
│  [ Copiar código Pix ]        │
│                               │
│  ⏳ Aguardando pagamento...   │
│  (atualiza automaticamente)   │
└───────────────────────────────┘
```

### C8 — Confirmação & Download
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

### A2 — Dashboard (desktop)
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
| Senha errada (cliente) | Mensagem amigável + contador de tentativas / bloqueio temporário. |
| Ensaio expirado | Tela informando expiração e contato da fotógrafa. |
| Processamento incompleto | Galeria mostra só itens prontos; admin vê progresso. |
| Pix pendente | Tela de espera com atualização automática (polling/realtime). |
| Pagamento falhou | Opção de tentar de novo / trocar método. |
| Download expirado | Mensagem + opção de solicitar reenvio à fotógrafa. |
| Nenhum item selecionado | CTA de pagamento desabilitado com dica. |
