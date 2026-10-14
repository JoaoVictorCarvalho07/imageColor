# 03 — Marca d'água & Segurança

A proteção do trabalho é um requisito central. A estratégia combina **prevenção** (dificultar a
cópia) com a regra de ouro: **o original nunca fica num lugar público**.

---

## 1. Princípios

1. **Original isolado:** o arquivo em alta resolução fica no bucket **privado**
   (`image-color-private`), sem URL pública, e só sai por URL assinada e temporária.
2. **Preview degradado + marca d'água:** o que a cliente vê é uma versão **reduzida** e
   **marcada**, guardada no bucket público (`image-color`). Nada sem marca d'água vai para lá.
3. **Defesa em profundidade:** nenhuma proteção de navegador é 100%, então a proteção real é a
   combinação resolução baixa + marca d'água + original inacessível.

> **Estado atual:** a liberação dos originais/finais depende da ação da fotógrafa (modo `edit`) ou
> do envio da seleção (modo `direct`) **e** do pagamento confirmado: enquanto o total da seleção for
> maior que zero e ela não estiver `paid`, nenhuma URL assinada nem ZIP é gerado.

---

## 2. Marca d'água em fotos (sharp)

Pipeline por foto (`lib/watermark.ts` e `lib/mediaPipeline.ts`), executado **dentro do Route
Handler**, sem fila:

1. Obter o original: upload direto do navegador ao R2 privado (presign) ou download do Drive.
2. Redimensionar: **preview** com maior lado de 1600 px e **thumb** com 400 px, respeitando a
   orientação EXIF e sem ampliar.
3. Aplicar a marca d'água: texto (`WATERMARK_TEXT`, padrão o nome do estúdio em maiúsculas)
   **repetido em padrão diagonal** (rotação de -30 graus) sobre a imagem inteira, opacidade 0,22.
4. Exportar em **WebP** (qualidade 72 no preview, 70 no thumb).
5. Subir preview e thumb ao bucket **público**, o original ao **privado**, e criar o registro em
   `media_items` (`status = ready`).

> **Por que padrão diagonal repetido?** Uma marca única no canto é facilmente cortada. O padrão
> que cobre a imagem toda obriga a reconstrução manual.

A marca é **texto** configurado por variável de ambiente. Logo em imagem e ajuste de opacidade
pela interface não existem hoje.

---

## 3. Marca d'água em vídeos (ffmpeg)

Pipeline em `lib/video.ts`, também inline no Route Handler `/upload`:

1. **Transcodificar** para H.264 com largura máxima de 1280 px, CRF 30, áudio AAC 128k.
2. **Overlay** de um PNG transparente com o mesmo padrão diagonal repetido.
3. **Limitar a duração** do preview a **90 s**.
4. Gerar um **poster** WebP (640 px) a partir do primeiro frame já marcado.
5. Preview e poster vão ao bucket público; o original fica no privado.

> Como o ffmpeg consome CPU e tempo, vídeos longos podem estourar o `maxDuration` (300 s) da
> função. Não há worker dedicado hoje. O limite está registrado como risco no
> [roadmap](06-roadmap-e-fases.md).

---

## 4. Proteções no navegador (camada extra, não única)

Servem para desencorajar o uso casual e **não substituem** as proteções acima:
- Apenas o preview reduzido chega ao DOM; o original nunca é referenciado ali.
- (A fazer) bloquear menu de contexto e arrastar imagem.
- (Futuro) marca d'água invisível/forense com ID da cliente para rastrear vazamentos.

> Screenshot do preview sempre será possível, mas sairá em baixa resolução e marcado, sem valor
> de uso.

---

## 5. Segurança de acesso

### Acesso da cliente (link + senha)
- Link `/g/<access_token>`, token aleatório de 9 bytes em base64url (não sequencial).
- Senha do ensaio guardada como hash **scrypt** com salt, comparada em tempo constante.
- Ao acertar a senha, cria-se um registro em `gallery_sessions` e um cookie **httpOnly** com
  validade de **12 horas**, restrito ao caminho `/g/<token>`.
- O acesso respeita `access_expires_at`: depois dela, nem a senha abre a galeria.
- Limite de tentativas de senha (anti força bruta): 5 falhas em 15 minutos bloqueiam por 15
  minutos a combinação token + IP, registrada em `login_attempts`.
- A cliente nunca consulta o PocketBase: toda leitura passa por `lib/pb/gallery.ts`, que valida a
  sessão antes de devolver qualquer dado.

### Downloads
- Previews e thumbs: URL pública do R2.
- Originais e finais: **URLs assinadas** do bucket privado (padrão de 6 h), geradas no servidor
  só depois de validar a sessão e o estado da entrega.
- O ZIP (`/g/<token>/finals-zip`) é montado no servidor, também após validar a sessão.

### Painel admin
- Login por **Google OAuth do PocketBase**. Como o PocketBase cria registro para qualquer conta
  Google, a **allowlist `ADMIN_EMAILS`** é obrigatória; sem ela ninguém entra (fail-closed).
- `middleware.ts` é só barreira de UX. Cada página, Server Action e Route Handler do admin chama
  `getAdminUser()` / `requireAdmin()`, que valida o token no PocketBase.
- Coleções do PocketBase sem regras de acesso: nenhuma leitura ou escrita direta por clientes.

### Infra e segredos
- Segredos só em variáveis de ambiente (`.env.local` fora do git).
- O `refresh_token` do Drive é guardado **criptografado** (AES-256-GCM, `APP_ENCRYPTION_KEY`).
- Rotas de desenvolvimento (`/api/dev/e2e`) exigem `ENABLE_DEV_E2E=1` e sessão de admin.
- HTTPS obrigatório em produção.
- **Webhook do Mercado Pago** (`/api/webhooks/mercadopago`):
  - O corpo da notificação não é confiável: o servidor busca o pagamento na API do Mercado Pago
    (com `MERCADOPAGO_ACCESS_TOKEN`) e decide só pelo que ela devolve.
  - Confere valor (pago >= total do pedido) e moeda (BRL); divergência não libera nada.
  - O cabeçalho `x-signature` é validado com `MERCADOPAGO_WEBHOOK_SECRET` quando presente;
    assinatura inválida responde 401.
  - Idempotência pela chave única `paymentId:status` em `payment_events`: notificações repetidas
    não reenviam e-mails nem reaplicam efeitos.
  - Reembolso ou chargeback bloqueiam os downloads novamente.
  - A seleção enviada fica travada durante o pagamento e o total é recalculado no servidor, nunca
    aceito do navegador.

---

## 6. LGPD & privacidade

- Coletar **dados mínimos** da cliente (nome e e-mail do ensaio).
- **Consentimento** claro sobre uso e armazenamento das imagens.
- Política de **retenção**: definir prazo para apagar ensaios e arquivos antigos.
- Direito de **exclusão**: apagar um ensaio remove registros e objetos do R2 (público e privado).
- Aviso de privacidade simples e acessível (a fazer).

---

## 7. Resumo da estratégia anti-roubo

| Camada | Medida |
|--------|--------|
| Conteúdo | Preview em baixa resolução (1600 px) |
| Conteúdo | Marca d'água em padrão diagonal repetido |
| Conteúdo | Vídeo reduzido + overlay + duração limitada a 90 s |
| Acesso | Link aleatório + senha com scrypt + sessão de 12 h + limite de tentativas |
| Armazenamento | Original em bucket privado, nunca público |
| Entrega | URLs assinadas e temporárias |
| Navegador | Bloqueios de download casual (camada extra) |
| Pagamento | Downloads só após confirmação do Mercado Pago (reconsulta por API, valor conferido, webhook idempotente) |
| Forense (futuro) | Marca d'água invisível por cliente |
