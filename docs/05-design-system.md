# 04 — Design System

> A plataforma é sobre **imagens**. O design deve **desaparecer** e deixar as fotos brilharem:
> muito espaço em branco, neutros suaves, tipografia elegante e UI minimalista.

---

## 1. Tom & princípios visuais

- **Imagery-first:** a interface é moldura, não protagonista. Fundos neutros, sem ruído.
- **Elegante e acolhedor:** sofisticado, mas caloroso (público de ensaios afetivos).
- **Mobile-first:** a cliente usa o celular; tudo precisa funcionar no toque.
- **Calmo:** poucas cores, hierarquia clara, micro-interações sutis.

---

## 2. Paleta de cores — extraída do site da Isabel Pontes (Bebel)

> A paleta vem do site oficial da fotógrafa (`siteIsabelPontes/src/globals.css`) para manter
> **continuidade de marca**. Base **marrom**, accent **verde floresta** e detalhes em **dourado**.
> O site já define tema claro e escuro — reaproveitamos ambos.

### Tema claro
| Papel | Token | HSL | Hex aprox. | Uso |
|-------|-------|-----|-----------|-----|
| Marrom base | `primary` | `22 26% 18%` | `#3A2A22` | Texto principal, header, botões escuros |
| Verde floresta | `accent` | `166 30% 21%` | `#1F3A34` | CTA/ações, destaques, links |
| Dourado | `gold` | `43 38% 63%` | `#C9B078` | Detalhes finos, marca d'água, ícones premium |
| Dourado suave | `gold-soft` | `43 52% 85%` | `#E6D3A3` | Fundos de destaque leve, badges |
| Creme (fundo) | `background` | `35 29% 92%` | `#F2EBE1` | Fundo principal |
| Card/superfície | `card` | `30 29% 93%` | `#F3E9DD` | Cards, modais, painéis |
| Bege | `bege` | — | `#F5E6D3` | Superfície quente alternativa |
| Texto suave | `muted-foreground` | `22 12% 38%` | `#6B5E54` | Texto secundário |
| Borda | `border` | `24 15% 84%` | `#DCD5CC` | Linhas e divisórias |
| Vinho (erro) | `destructive` | `346 50% 24%` | `#5A1E2C` | Erros / danger |

### Tema escuro (também já definido no site)
| Papel | HSL | Hex aprox. |
|-------|-----|-----------|
| Fundo | `22 26% 18%` | `#3A2A22` |
| Card | `22 22% 12%` | `#241B16` |
| Verde accent | `166 26% 28%` | `#345A50` |
| Dourado | `43 48% 76%` | `#DCC79A` |

---

## 3. Tipografia — mesma do site

| Papel | Fonte | Observação |
|-------|-------|------------|
| Títulos / display | **Cormorant Garamond** (serif) | Pesos 300/400/500 + itálico. Elegância editorial. |
| Interface / corpo | **Jost** (sans-serif) | Pesos 300/400. Geométrica e limpa. |

Escala fluida (do site, `clamp`): `Display 2.5–4rem` · `H1 2–3rem` · `H2 1.5–2.25rem` ·
`H3 1.25–1.75rem` · `Body 1rem` · `Label 0.875rem` (uppercase, tracking largo) · `Caption 0.75rem`
(itálico serif). Leading do corpo: 1.6.

> [!tip] Labels em `Jost` 300 com `letter-spacing` largo e `UPPERCASE` são a assinatura do site —
> usar em rótulos de seção e botões secundários.

---

## 4. Espaçamento, raio e sombra (do site)

- **Grid de espaçamento (8px):** 8, 16, 24, 32, 48, 64, 96, 128.
- **Raio:** `sm 2px` · `md 4px` · `lg 8px` · `xl 16px` · `full 9999px`. Cantos **discretos** (assinatura sóbria do site).
- **Sombra (tom quente):** `sm 0 1px 3px rgba(42,32,24,.08)` → `xl 0 20px 60px rgba(42,32,24,.22)`.
- **Transições:** `fast 150ms` · `base 250ms` · `spring 350ms cubic-bezier(.25,.46,.45,.94)`.
- **Container:** máx. ~1200px no desktop; galeria pode usar largura total com gutters.

---

## 5. Componentes-chave

| Componente | Notas |
|-----------|-------|
| **Botão** | Primário (accent), secundário (contorno), texto. Toque mín. 44px. |
| **Tabs** | Fotos / Vídeos — destaque com sublinhado no accent. |
| **Card de mídia** | Imagem com marca d'água, ícone de favoritar no canto, estado "selecionado". |
| **Grade (masonry/grid)** | Responsiva: 2 col. (mobile) → 3–4 (tablet) → 4–5 (desktop). |
| **Lightbox** | Fundo escuro, navegação ‹ ›, botão selecionar, contador. |
| **Player de vídeo** | Controles mínimos, overlay de marca d'água persistente. |
| **Barra de seleção** | Rodapé fixo (mobile) com contador e CTA "Ver seleção". |
| **Seletor de pacote** | Cards de opção (radio) com preço e quantidade inclusa. |
| **Checkout Pix** | QR + botão copiar + status ao vivo. |
| **Toast/feedback** | Confirmações sutis (item adicionado, link copiado). |
| **Empty/erro/loading** | Skeletons na galeria; estados amigáveis. |

---

## 6. Padrões de interação

- **Favoritar:** toque no coração no card **ou** no lightbox; animação leve.
- **Feedback de seleção:** contador sempre visível; item selecionado ganha borda accent + check.
- **Carregamento:** skeletons + lazy-load progressivo conforme rola.
- **Marca d'água:** sempre presente nos previews (grade, lightbox e player).
- **Acessibilidade:** foco visível, navegação por teclado no lightbox (setas/esc), alt text,
  contraste AA.

---

## 7. Identidade

- A plataforma **herda a identidade do site da Isabel Pontes (Bebel)**: mesma paleta (marrom /
  verde floresta / dourado) e mesmas fontes (Cormorant Garamond + Jost) — garante que a cliente
  sinta que é o "mesmo mundo" da fotógrafa.
- Usar a **logo/wordmark já existente** da fotógrafa para o topo da plataforma e para a
  **marca d'água** (preferir o dourado `#C9B078` em baixa opacidade sobre as fotos).
- Nome de produto (placeholder do repo: `imageColor`) ainda a validar com a fotógrafa.
