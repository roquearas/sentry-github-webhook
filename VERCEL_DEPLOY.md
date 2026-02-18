# Deploy na Vercel - Sentry GitHub Webhook

## ✅ Arquivos Criados para Vercel

Seu repositório agora está pronto para deploy na Vercel com:

- ✅ `vercel.json` - Configuração de rotas e builds
- ✅ `api/webhook.js` - Serverless function para receber webhooks do Sentry
- ✅ `api/health.js` - Health check endpoint

## Passo a Passo - Deploy na Vercel

### 1. Acessar Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em **"Add New..."** > **"Project"**

### 2. Importar Repositório

1. Procure por `sentry-github-webhook` na lista de repositórios
2. Clique em **"Import"**
3. A Vercel detectará automaticamente que é um projeto Node.js

### 3. Configurar Variáveis de Ambiente

**IMPORTANTE:** Antes de fazer o deploy, adicione as variáveis de ambiente:

1. Na tela de import, expanda **"Environment Variables"**
2. Adicione as seguintes variáveis:

```bash
GITHUB_TOKEN=seu_token_github_aqui
GITHUB_OWNER=roquearas
GITHUB_REPO=nome_do_repositorio_para_issues
SENTRY_WEBHOOK_SECRET=opcional_deixe_vazio_se_nao_usar
```

#### Como Obter o GitHub Token:

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token (classic)"**
3. Nome: `Sentry Webhook Integration`
4. Selecione o escopo: **`repo`** (controle total)
5. Clique em **"Generate token"**
6. **COPIE O TOKEN IMEDIATAMENTE** - você não conseguirá vê-lo novamente!

### 4. Fazer Deploy

1. Clique em **"Deploy"**
2. Aguarde o processo de build (leva ~1-2 minutos)
3. Quando finalizar, você verá a mensagem de sucesso ✅

### 5. Obter a URL do Webhook

Após o deploy:

1. A Vercel gerará uma URL como: `https://seu-projeto.vercel.app`
2. Sua URL do webhook será: `https://seu-projeto.vercel.app/webhook/sentry`
3. URL do health check: `https://seu-projeto.vercel.app/health`

**Copie a URL do webhook** - você usará ela no Sentry!

### 6. Configurar no Sentry

1. Acesse: https://roque-e3.sentry.io/settings/projects/node-express/hooks/
2. Clique em **"Create New Hook"**
3. Cole a URL: `https://seu-projeto.vercel.app/webhook/sentry`
4. Selecione os eventos:
   - ☑️ `event.created` (novo erro detectado)
   - ☑️ `event.alert` (alerta disparado)
5. Mantenha **Active** marcado
6. Clique em **"Create Hook"**

### 7. Testar a Integração

#### Teste 1: Health Check

Abra no navegador:
```
https://seu-projeto.vercel.app/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "service": "sentry-github-webhook",
  "platform": "vercel"
}
```

#### Teste 2: Gerar Erro Real

1. Provoque um erro na sua aplicação monitorada pelo Sentry
2. Aguarde alguns segundos
3. Verifique se uma issue foi criada no GitHub automaticamente

## Estrutura de Rotas

O arquivo `vercel.json` configura:

| URL Original | Serverless Function | Descrição |
|-------------|-------------------|------------|
| `/webhook/sentry` | `api/webhook.js` | Recebe eventos do Sentry |
| `/health` | `api/health.js` | Health check |

## Vantagens da Vercel

✅ **Serverless** - Paga apenas pelo uso  
✅ **Auto-scaling** - Escala automaticamente  
✅ **Deploy automático** - Cada push no GitHub faz redeploy  
✅ **SSL grátis** - HTTPS automático  
✅ **Logs em tempo real** - Acesse logs direto no painel  
✅ **Gratuito** - Plano hobby suficiente para uso pessoal

## Monitoramento

### Ver Logs na Vercel

1. Acesse seu projeto no [dashboard da Vercel](https://vercel.com/dashboard)
2. Clique em **"Functions"**
3. Selecione a function `api/webhook.js`
4. Veja os logs em tempo real

Procure por mensagens como:
- `Evento recebido do Sentry: created`
- `Issue criada no GitHub: https://github.com/...`

### Metrics & Analytics

1. No dashboard, acesse **"Analytics"**
2. Veja quantidade de requisições
3. Tempo de resposta
4. Taxa de erro

## Troubleshooting

### Erro: "Missing environment variables"

**Solução:**
1. Vá para Settings > Environment Variables no dashboard da Vercel
2. Adicione `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
3. Faça redeploy: Deployments > ... > Redeploy

### Issues não são criadas

**Verificações:**
1. Confirme que o `GITHUB_TOKEN` tem escopo `repo`
2. Verifique se `GITHUB_OWNER` e `GITHUB_REPO` estão corretos
3. Acesse os logs da function no painel da Vercel
4. Teste o health check: `https://seu-projeto.vercel.app/health`

### Webhook não recebe eventos

**Verificações:**
1. Confirme que a URL no Sentry está correta
2. Verifique se o webhook está **Active** no Sentry
3. Confirme que os eventos estão marcados: `event.created` e `event.alert`
4. Gere um erro real na aplicação para testar

### Erro 500 nas Requisições

1. Acesse os logs da function na Vercel
2. Procure pela mensagem de erro completa
3. Geralmente é problema com GitHub Token ou permissões

## Atualizações

Qualquer push para o branch `main` fará redeploy automático na Vercel!

```bash
git add .
git commit -m "fix: atualização no webhook"
git push origin main
```

A Vercel detectará e fará deploy automaticamente em ~1 minuto.

## Custos

Plano **Hobby (Gratuito)** inclui:
- 100GB de bandwidth/mês
- 100 horas de execução serverless/mês
- Projetos ilimitados
- Deploy automático

**Para uso de webhook, o plano gratuito é mais que suficiente!**

## Comparação: Vercel vs Railway

| Recurso | Vercel | Railway |
|---------|--------|--------|
| Tipo | Serverless | Container |
| Deploy | Instantâneo | ~1-2 min |
| Escala | Automático | Manual/Auto |
| Plano Free | 100h/mês | $5 crédito |
| Ideal para | Webhooks | Servidores 24/7 |

**Recomendação:** Use Vercel para este projeto! É perfeito para serverless functions.

## Próximos Passos

✅ Deploy na Vercel concluído  
✅ Variáveis de ambiente configuradas  
✅ Webhook configurado no Sentry  
✅ Teste com erro real  

---

✅ **Integração Sentry + GitHub + Vercel pronta!**
