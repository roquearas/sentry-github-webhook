# Webhook Debugging Guide - Sentry → GitHub Integration

## Status Atual (Teste Realizado)

### ✅ Funcionando:
- Sentry recebe eventos (synthetic test: HTTP 200, event_id 0d8bd372adb045ab849897e4ba39c14f)
- Sentry ingest pipeline operacional
- DSN está correto e comunicando

### ❌ Não funcionando:
- GitHub issues NÃO são criados quando Sentry recebe eventos
- Webhook pode estar filtrado, bloqueado ou mal configurado
- Ou endpoint webhook não está respondendo corretamente

---

## Diagnóstico Passo a Passo

### Fase 1: Verificar Webhook Endpoint

#### 1.1 Confirmar que o webhook está rodando:
```bash
# Se deployado localmente (ngrok)
curl -X GET http://localhost:3000/health

# Se deployado na Heroku/Railway
curl -X GET https://seu-webhook-url.herokuapp.com/health

# Resposta esperada:
# {"status": "ok"} ou similar
```

#### 1.2 Verificar logs do servidor:
```bash
# Se em desenvolvimento
node server.js  # Você verá logs em tempo real

# Se em produção (Heroku)
heroku logs --tail

# Se em produção (Railway)
railway logs
```

### Fase 2: Verificar Configuração Sentry

#### 2.1 Navegar para Settings do Sentry:
1. Dashboard → **Settings** (canto inferior esquerdo)
2. **Integrations** → **GitHub Integration** (ou "Custom Integrations")
3. Verificar webhook URL:
   - URL está correta?
   - URL é acessível publicamente?
   - URL tem HTTPS válido? (se requerido)

#### 2.2 Testar webhook manualmente:
```bash
# Copiar um payload de exemplo do Sentry Webhook Documentation
# ou usar um evento real recente

curl -X POST https://seu-webhook-url.herokuapp.com/webhook/sentry \
  -H "Content-Type: application/json" \
  -H "X-Sentry-Hook-Resource: event" \
  -d '{
    "action": "created",
    "installation": {...},
    "data": {
      "event": {...}
    }
  }'

# Você deveria ver nos logs do servidor: "Webhook recebido"
```

### Fase 3: Verificar GitHub Token

#### 3.1 Validar token:
```bash
GITHUB_TOKEN="seu_token" node -e "
const https = require('https');
https.get('https://api.github.com/user', {
  headers: { 'Authorization': 'token seu_token', 'User-Agent': 'test' }
}, res => console.log('Status:', res.statusCode)).on('error', e => console.error(e));
"

# Status 200 = token válido
# Status 401 = token inválido
```

#### 3.2 Verificar permissões do token:
```bash
# GitHub Personal Access Tokens devem ter scopes:
# - repo (full control of private repositories)
# - issues (create/read/update issues)
```

### Fase 4: Debugar Webhook Processing

#### 4.1 Adicionar logs detalhados em `server.js`:
```javascript
app.post('/webhook/sentry', (req, res) => {
  console.log('\n=== WEBHOOK RECEBIDO ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  // ... resto do código ...
  
  // Antes de criar issue:
  console.log('Tentando criar issue no GitHub...');
  console.log('Repo:', `${GITHUB_OWNER}/${GITHUB_REPO}`);
  console.log('Título:', title);
  console.log('Descrição:', body.substring(0, 100));
  
  // Após criar issue:
  console.log('GitHub Response Status:', response.statusCode);
  console.log('GitHub Response:', data);
});
```

#### 4.2 Re-enviar um erro de teste:
1. Ir para alguma página da app que cause erro
2. Monitorar logs do webhook
3. Procurar por:
   - "Webhook recebido" (chegou?)
   - "Tentando criar issue" (processou?)
   - "GitHub Response 201" (criou com sucesso?)

### Fase 5: Verificar Filtros Sentry

O Sentry pode estar filtrando eventos. Verificar:

#### 5.1 Sentry Filters:
```
Settings → Integrations → GitHub Integration → Event Conditions
```

Verificar se há filtros que excluem eventos:
- Erro com "permission", "access_denied", etc.?
- Certos níveis de severidade filtrados?
- Certos tipos de eventos ignorados?

#### 5.2 Sentry Sampling:
Se houver 100% de eventos, sampling não é o problema.

### Fase 6: Verificar Payload Structure

#### 6.1 Sentry envia evento mas pode estar com estructura diferente:

Exemplo payload que Sentry envia:
```json
{
  "action": "created",
  "installation": {
    "uuid": "..."
  },
  "data": {
    "event": {
      "eventID": "0d8bd372adb045ab849897e4ba39c14f",
      "message": "Permission denied",
      "title": "Permission denied: access_denied",
      "url": "https://sentry.io/...",
      "level": "error"
    },
    "issue": {
      "id": "12345",
      "shortID": "SENTRY-1"
    }
  }
}
```

#### 6.2 Adicionar validação:
```javascript
if (!req.body.data || !req.body.data.event) {
  console.error('\u274c Payload inválido. Esperado data.event');
  return res.status(400).json({ error: 'Invalid payload' });
}
```

---

## Checklist de Debug

### Endpoint
- [ ] Webhook está rodando (health check passa)?
- [ ] URL é acessível publicamente?
- [ ] HTTPS válido (se requerido)?
- [ ] Firewall/proxy não está bloqueando?

### Sentry Configuration
- [ ] URL está salva corretamente em Integrations?
- [ ] Webhook está "enabled"?
- [ ] Eventos corretos selecionados (issue, error, comment)?
- [ ] Nenhum filtro exclusivo ativo?

### GitHub
- [ ] Token válido?
- [ ] Token tem permissões de issues?
- [ ] Repository correto?
- [ ] Não é repositório archived?

### Logs
- [ ] "Webhook recebido" aparece nos logs?
- [ ] Payload tem estrutura correta?
- [ ] Erro ao chamar GitHub API?
- [ ] Response status é 201 (created) ou erro?

---

## Comandos Úteis

### Ver últimos eventos no Sentry:
```bash
SENTRY_AUTH_TOKEN="seu_token" node test-sentry-api.js
```

### Testar webhook localmente com ngrok:
```bash
# Terminal 1:
ngrok http 3000
# Copia a URL fornecida (ex: https://abc123.ngrok.io)

# Terminal 2:
node server.js

# Terminal 3:
curl -X POST https://abc123.ngrok.io/webhook/sentry \
  -H "Content-Type: application/json" \
  -d '{"action":"created","data":{"event":{"message":"Test"}}'
```

### Ver erros GitHub:
```bash
# Se receber erro 422 (Unprocessable Entity):
# - Issue title muito longo
# - Body muito longo
# - Caracteres inválidos

# Se receber erro 401 (Unauthorized):
# - Token inválido ou expirado

# Se receber erro 404 (Not Found):
# - Repository não existe
# - GITHUB_OWNER ou GITHUB_REPO incorreto
```

---

## Próximas Etapas

1. **Executar Fase 1-2:** Confirmar que webhook está recebendo requisições
2. **Se não recebe:** Verificar Sentry Integrations → GitHub → Webhook URL
3. **Se recebe:** Adicionar logs (Fase 4) e re-testar
4. **Comparar payloads:** Com a estrutura esperada (Fase 6)
5. **Verificar GitHub:** Token, permissões, repositório (Fase 3)

---

## Status Final

Ao rodar `test-sentry-api.js` e confirmar eventos capturados:
- ✅ Eventos estão sendo capturados pelo Sentry
- ⏳ Próximo: Debugar por que webhook não cria GitHub issues
- 🔄 Usar guia acima para identificar ponto de falha exato
