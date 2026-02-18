# Deploy na Vercel (Serverless)

Este projeto suporta deploy serverless na Vercel com endpoints:

- `POST /webhook/sentry` (principal)
- `POST /sentry-webhook` (compatibilidade legado)
- `GET /health`

## 1. Variáveis de ambiente obrigatórias

Configure no projeto Vercel:

```bash
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=roquearas
GITHUB_REPO=nome-do-repo-destino
```

Opcional (recomendado para segurança):

```bash
SENTRY_WEBHOOK_SECRET=seu_secret_do_webhook
ALERT_WEBHOOK_URL=https://seu-slack-ou-discord-webhook
ALERT_WEBHOOK_TOKEN=opcional_bearer_token
```

## 2. Deploy

Se estiver usando GitHub integration da Vercel:

1. Importe o repositório.
2. Adicione as variáveis de ambiente.
3. Clique em `Deploy`.

Se estiver usando CLI:

```bash
npm i -g vercel
vercel
```

## 3. Configuração no Sentry

Após deploy, pegue a URL final da Vercel e configure:

```text
https://SEU_APP.vercel.app/webhook/sentry
```

Para instalações antigas, `/sentry-webhook` também funciona.

## 4. Teste rápido

Health check:

```bash
curl -i https://SEU_APP.vercel.app/health
```

Webhook (sem assinatura, para teste inicial):

```bash
curl -i -X POST https://SEU_APP.vercel.app/webhook/sentry \
  -H 'content-type: application/json' \
  -d '{"action":"issue.created","data":{"issue":{"title":"Teste Vercel","level":"error","url":"https://sentry.io/issues/1","culprit":"stack trace de teste","stats":{"24h":[[0,1]]}}}}'
```

## 5. Troubleshooting

- `401 Invalid webhook signature`: `SENTRY_WEBHOOK_SECRET` não bate com o configurado no Sentry.
- `500 Missing required environment variables`: faltam variáveis no painel da Vercel.
- `500 GitHub authentication failed (401)`: token inválido ou sem escopo.
- `500 GitHub repository not found (404)`: `GITHUB_OWNER`/`GITHUB_REPO` incorretos.
- `429 Too many requests`: rate limit em janela de 15 min.
