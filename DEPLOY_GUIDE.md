# Guia de Deploy - Sentry GitHub Webhook

## Resumo do Projeto

Você criou com sucesso um webhook server que integra Sentry com GitHub! O servidor Express recebe eventos do Sentry e cria automaticamente issues no GitHub.

## Arquivos Criados

✅ **webhook.js** - Servidor principal com lógica de integração
✅ **package.json** - Dependências (express, @octokit/rest, dotenv)
✅ **server.js** - Servidor existente
✅ **.env.example** - Template de variáveis de ambiente

## Próximos Passos

### 1. Deploy no Railway

O Railway é recomendado para deploy rápido e fácil:

1. Acesse [railway.app](https://railway.app)
2. Faça login com sua conta GitHub
3. Clique em "New Project" > "Deploy from GitHub repo"
4. Selecione o repositório `sentry-github-webhook`
5. Railway detectará automaticamente o `Procfile`

### 2. Configurar Variáveis de Ambiente no Railway

No painel do Railway, adicione as seguintes variáveis:

```
GITHUB_TOKEN=seu_token_github_aqui
GITHUB_OWNER=roquearas
GITHUB_REPO=nome_do_seu_repositorio_para_issues
SENTRY_WEBHOOK_SECRET=opcional_para_segurança
PORT=3000
```

**Como obter o GitHub Token:**
1. Vá para https://github.com/settings/tokens
2. Clique em "Generate new token" > "Classic"
3. Dê um nome: "Sentry Webhook Integration"
4. Selecione o escopo: `repo` (controle total de repositórios privados)
5. Clique em "Generate token"
6. **COPIE O TOKEN IMEDIATAMENTE** (você não verá ele novamente)

### 3. Obter a URL do Deploy

Após o deploy no Railway:
1. Vá em "Settings" do seu projeto
2. Clique em "Generate Domain"
3. Copie a URL gerada (ex: `https://seu-app.up.railway.app`)
4. Sua URL do webhook será: `https://seu-app.up.railway.app/webhook/sentry`

### 4. Configurar Webhook no Sentry

Volte para o Sentry:

1. Acesse: https://roque-e3.sentry.io/settings/projects/node-express/hooks/
2. Clique em "Create New Hook"
3. **URL**: Cole a URL do Railway + `/webhook/sentry`
4. **Events**: Marque as opções:
   - ☑️ `event.created` (quando um novo erro é detectado)
   - ☑️ `event.alert` (quando um alerta é disparado)
5. Deixe **Active** marcado
6. Clique em "Create Hook"

### 5. Testar a Integração

**Opção 1: Gerar um erro real**
- Provoque um erro na sua aplicação que está sendo monitorada pelo Sentry
- Aguarde alguns segundos
- Verifique se uma issue foi criada automaticamente no GitHub

**Opção 2: Testar manualmente com cURL**
```bash
curl -X POST https://seu-app.up.railway.app/health
```

Deve retornar:
```json
{"status": "ok", "timestamp": "2024-..."}
```

## Como Funciona

1. **Sentry detecta erro** → Envia webhook para sua URL
2. **Seu servidor recebe** → Processa o payload do Sentry
3. **Cria issue no GitHub** → Com detalhes completos:
   - Título: `[Sentry] Tipo do erro`
   - Descrição: Projeto, severidade, contador, timestamps
   - Stack trace completo
   - Link direto para o Sentry
   - Labels automáticas (sentry, bug, level)

## Estrutura da Issue Criada

```markdown
## Erro detectado pelo Sentry

**Project:** node-express
**Level:** error
**Count:** 5
**First Seen:** 2024-01-15 10:30:00
**Last Seen:** 2024-01-15 14:45:00

**Link:** https://sentry.io/...

### Stack Trace
\`\`\`
Error: Cannot read property 'foo' of undefined
  at handler (index.js:45:10)
\`\`\`
```

## Monitoramento

### Logs no Railway
- Acesse o painel do Railway
- Veja os logs em tempo real
- Procure por mensagens como:
  - `Webhook server rodando na porta 3000`
  - `Evento recebido do Sentry: created`
  - `Issue criada no GitHub: https://github.com/...`

### Health Check
Acesse: `https://seu-app.up.railway.app/health`

Deve retornar status 200 com:
```json
{"status": "ok", "timestamp": "..."}
```

## Troubleshooting

### Erro: "Invalid signature"
- Verifique se `SENTRY_WEBHOOK_SECRET` está configurado corretamente
- Se não estiver usando, deixe vazio

### Issues não são criadas
1. Verifique os logs no Railway
2. Confirme que `GITHUB_TOKEN` tem permissões de `repo`
3. Verifique se `GITHUB_OWNER` e `GITHUB_REPO` estão corretos
4. Teste o endpoint `/health` para verificar se o servidor está rodando

### Webhook não recebe eventos
1. Verifique a URL do webhook no Sentry
2. Confirme que o webhook está **Active**
3. Verifique se os eventos corretos estão marcados
4. Teste com um erro real na aplicação

## Segurança

✅ Verificação de assinatura HMAC (opcional)
✅ Variáveis de ambiente para credenciais
✅ GitHub token com escopo mínimo necessário
✅ Logs de todos os eventos processados

## Alterna tivas ao Railway

### Heroku
```bash
heroku create seu-app
heroku config:set GITHUB_TOKEN=...
heroku config:set GITHUB_OWNER=...
heroku config:set GITHUB_REPO=...
git push heroku main
```

### Vercel/Netlify
- Não recomendado para webhooks de longa duração
- Melhor para serverless functions

## Manutenção

- **Atualizar código**: Faça push para o GitHub, Railway fará redeploy automático
- **Ver issues criadas**: Verifique o repositório GitHub configurado
- **Monitorar erros**: Acesse os logs do Railway

## Próximas Melhorias

- [ ] Adicionar filtros por severidade (apenas errors, ignorar warnings)
- [ ] Agrupar múltiplos eventos do mesmo erro
- [ ] Fechar issues automaticamente quando erro for resolvido no Sentry
- [ ] Adicionar notificações por email/Slack
- [ ] Dashboard para estatísticas de erros

---

✅ **Integração Sentry + GitHub configurada com sucesso!**
