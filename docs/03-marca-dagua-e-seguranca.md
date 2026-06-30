# 02 — Marca d'água & Segurança

A proteção do trabalho é um requisito central. A estratégia combina **prevenção** (dificultar a
cópia) com a regra de ouro: **o original nunca sai antes do pagamento**.

---

## 1. Princípios

1. **Original isolado:** o arquivo em alta resolução fica em storage **privado**, sem URL pública,
   e só é entregue via **link assinado e temporário após o pagamento**.
2. **Preview degradado + marca d'água:** o que a cliente vê é uma versão **reduzida** e
   **marcada**, inútil para impressão/uso profissional.
3. **Defesa em profundidade:** nenhuma proteção de browser é 100%, então a real proteção é a
   combinação resolução baixa + marca d'água + original inacessível.

---

## 2. Marca d'água em fotos (sharp)

Pipeline por foto:
1. Baixar o original do Drive (stream).
2. Redimensionar para **preview** (ex.: borda maior = 1600px) e **thumb** (ex.: 400px).
3. Aplicar **marca d'água**:
   - **Logo/nome** semitransparente, **repetido em padrão diagonal** (tiled) por toda a imagem —
     muito mais difícil de remover do que uma marca só no canto.
   - Opacidade configurável (ex.: 12–25%).
   - Cor adaptável (clara/escura) para manter legibilidade.
4. Exportar em **WebP/AVIF** (qualidade ~70%) para leveza.
5. Subir preview + thumb para o **R2** (público via CDN) e o original para bucket **privado**.

Parâmetros configuráveis pela fotógrafa:
- Logo (upload) ou texto (nome/@).
- Opacidade, tamanho, densidade do padrão, posição (tiled / centro / canto).

> **Por que padrão diagonal repetido?** Uma marca única no canto é facilmente cortada. O padrão
> que cobre a imagem toda obrigaria reconstrução manual, inviabilizando o "roubo" prático.

---

## 3. Marca d'água em vídeos (ffmpeg)

Vídeo é mais pesado, então a versão de preview é bem mais restrita:
1. **Transcodificar** para resolução baixa (ex.: 540p/720p) e bitrate reduzido.
2. **Overlay** do logo/marca (PNG semitransparente), de preferência em movimento sutil ou em
   posição que cubra área central periodicamente.
3. Opcional: **limitar a duração** do preview (ex.: primeiros 30–60s) para ensaios longos.
4. Gerar também um **poster/thumbnail** com marca d'água (frame extraído).
5. Servir o preview via CDN; original transcodificado/final fica privado até o pagamento.

> Como ffmpeg consome CPU/tempo, o processamento de vídeo roda **sempre no worker dedicado**,
> nunca em função serverless.

---

## 4. Proteções no navegador (camada extra, não única)

Servem para desencorajar o usuário casual — **não substituem** as proteções acima:
- Desabilitar menu de contexto (botão direito) e arrastar imagem.
- Servir imagem como `background` ou via `<canvas>` para dificultar "salvar imagem".
- Não incluir o preview em alta no DOM (apenas a resolução reduzida).
- Atributos anti-cache agressivo onde fizer sentido.
- (Opcional/avançado) **marca d'água invisível/forense** com ID da cliente para rastrear
  vazamentos — fase futura.

> Importante alinhar expectativa com a fotógrafa: screenshot do preview sempre será possível, mas
> sairá em baixa resolução e marcado — sem valor de uso.

---

## 5. Segurança de acesso

### Acesso da cliente (link + senha)
- Link: `/g/{access_token}` com token longo e aleatório (não sequencial).
- Senha do ensaio: armazenada como **hash** (bcrypt/argon2).
- Ao acertar a senha, cria-se uma **sessão temporária** (cookie httpOnly) válida por X horas.
- **Rate limiting** nas tentativas de senha (anti brute-force).
- Ensaio respeita `expires_at` (acesso expira).

### Downloads pós-pagamento
- URLs **assinadas** (R2/S3 presigned) com expiração curta por arquivo.
- `deliveries.expires_at` limita o período total de acesso à entrega.
- Cada download pode ser **logado** (auditoria).

### Painel admin
- Login via Supabase Auth (e-mail/senha + opção de 2FA futuro).
- Row Level Security no Postgres: cada fotógrafa só acessa seus próprios dados.

### Infra & segredos
- Segredos (Drive `refresh_token`, chaves Mercado Pago) em variáveis de ambiente / secret manager;
  `refresh_token` **criptografado** no banco.
- Webhook do Mercado Pago **validado por assinatura** e tratado de forma **idempotente**.
- HTTPS obrigatório em tudo.

---

## 6. LGPD & privacidade

- Coletar **dados mínimos** da cliente (nome, e-mail, telefone opcional).
- **Consentimento** claro sobre uso e armazenamento das imagens.
- Política de **retenção**: definir prazo para apagar ensaios/arquivos antigos.
- Direito de **exclusão** mediante solicitação.
- Aviso de privacidade simples e acessível na plataforma.

---

## 7. Resumo da estratégia anti-roubo

| Camada | Medida |
|--------|--------|
| Conteúdo | Preview em baixa resolução |
| Conteúdo | Marca d'água em padrão diagonal repetido |
| Conteúdo | Vídeo em baixa resolução + overlay (+ duração limitada opcional) |
| Acesso | Link aleatório + senha com hash + sessão temporária + rate limit |
| Armazenamento | Original em bucket privado, nunca público |
| Entrega | URLs assinadas e temporárias só após pagamento |
| Navegador | Bloqueios de download casual (camada extra) |
| Forense (futuro) | Marca d'água invisível por cliente |
