# Sentry API Setup & Event Verification Guide

## Objetivo
Verificar se os erros da telemedicina (Permission denied) foram capturados pelo Sentry e consultá-los via API.

## Status Atual
- ✅ Sentry ingest funcionando (synthetic event HTTP 200: event_id 0d8bd372adb045ab849897e4ba39c14f)
- ❌ Webhook → GitHub issue não está criando issues
- ⏳ Aguardando: API token para consultar eventos reais de produção

## Passo 1: Gerar SENTRY_AUTH_TOKEN

### No Sentry Dashboard (https://roque-e3.sentry.io):

1. Vá para **Settings** (canto inferior esquerdo)
2. Na sidebar, clique em **Integrations → API Credentials** (ou procure por "Auth Tokens")
3. Clique em **Create New Token**
4. Configure:
   - **Name**: "GitHub Webhook API"
   - **Scopes** (marque obrigatoriamente):
     - ✅ event:read
     - ✅ project:read
     - ✅ org:read
   - **Expiration**: 1 year ou Custom (recomendado)
5. Clique **Create Token**
6. **COPIE O TOKEN** (ele não será exibido novamente)

### Token gerado:
```
SENTRY_AUTH_TOKEN=seu_token_super_secreto_aqui
```

## Passo 2: Configurar Token Localmente

### Adicionar ao `.env`:
```bash
# .env (local)
SENTRY_AUTH_TOKEN=seu_token_aqui
SENTRY_ORG_SLUG=roque-e3
SENTRY_PROJECT_SLUG=sentry-github-webhook  # ou o projeto real de produção
```

### Validar token com curl:
```bash
curl -H "Authorization: Bearer seu_token_aqui" \
  https://sentry.io/api/0/organizations/roque-e3/
```

Resposta esperada: `200 OK` + JSON da organização

## Passo 3: Script para Consultar Eventos

### Criar `test-sentry-api.js`:
```javascript
const https = require('https');

const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = 'roque-e3';
const PROJECT = 'sentry-github-webhook';  // Mude para o projeto real se necessário

if (!SENTRY_TOKEN) {
  console.error('❌ SENTRY_AUTH_TOKEN não definido!');
  process.exit(1);
}

function queryEvents(query = 'error:Permission') {
  return new Promise((resolve, reject) => {
    const url = `https://sentry.io/api/0/projects/${ORG}/${PROJECT}/events/?query=${encodeURIComponent(query)}&limit=10`;

    https.get(url, {
      headers: {
        'Authorization': `Bearer ${SENTRY_TOKEN}`,
        'User-Agent': 'Sentry-Webhook-Tester/1.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          resolve(events);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log(`🔍 Consultando eventos no Sentry (${ORG}/${PROJECT})...`);
    
    const events = await queryEvents('error:Permission');
    
    if (!Array.isArray(events) || events.length === 0) {
      console.log('❌ Nenhum evento "Permission" encontrado');
    } else {
      console.log(`✅ ${events.length} evento(s) encontrado(s):\n`);
      events.forEach((e, i) => {
        console.log(`${i + 1}. ID: ${e.eventID || e.id}`);
        console.log(`   Title: ${e.title}`);
        console.log(`   Level: ${e.level}`);
        console.log(`   Timestamp: ${e.dateCreated}`);
        console.log(`   URL: https://sentry.io/organizations/${ORG}/issues/${e.groupID || 'unknown'}/`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Erro ao consultar Sentry:', error.message);
  }
}

main();
```

### Executar:
```bash
SENTRY_AUTH_TOKEN="seu_token_aqui" node test-sentry-api.js
```

## Passo 4: Consultas Úteis via API

### Listar todos os eventos recentes:
```bash
curl -H "Authorization: Bearer TOKEN" \
  'https://sentry.io/api/0/projects/roque-e3/sentry-github-webhook/events/?limit=10'
```

### Buscar eventos com "Permission denied":
```bash
curl -H "Authorization: Bearer TOKEN" \
  'https://sentry.io/api/0/projects/roque-e3/sentry-github-webhook/events/?query=error%3APermission&limit=10'
```

### Buscar por timestamp (últimas 24h):
```bash
curl -H "Authorization: Bearer TOKEN" \
  'https://sentry.io/api/0/projects/roque-e3/sentry-github-webhook/events/?query=is%3Aunresolved&limit=10'
```

## Passo 5: Interpretar Respostas

### Estrutura do evento:
```json
{
  "eventID": "0d8bd372adb045ab849897e4ba39c14f",
  "title": "Permission denied: access_denied",
  "level": "error",
  "platform": "javascript",
  "dateCreated": "2024-01-15T10:30:00.000Z",
  "groupID": "12345",
  "message": "Permission denied...",
  "exception": {...},
  "request": {...}
}
```

## Checklist de Verificação

- [ ] ✅ Token gerado com scopes: event:read, project:read, org:read
- [ ] ✅ Token adicionado ao `.env` (local, não commitado)
- [ ] ✅ Curl test retorna 200 OK
- [ ] ✅ Script `test-sentry-api.js` criado
- [ ] ✅ Executar script: `SENTRY_AUTH_TOKEN="..." node test-sentry-api.js`
- [ ] ✅ Eventos de "Permission denied" encontrados?
  - SIM → evento está sendo capturado, debugar webhook-to-GitHub
  - NÃO → erro não foi enviado ao Sentry, verificar DSN e integração

## Próximas Ações

1. **Se eventos encontrados:**
   - Debug do webhook: Por que não está criando GitHub issues?
   - Verificar logs do servidor webhook
   - Validar GitHub token e permissões

2. **Se nenhum evento encontrado:**
   - Erro não chegou ao Sentry
   - Verificar: DSN correto, network, CORS, integração Sentry na app
   - Testar synthetic error novamente: `curl -X POST https://o[orgid].ingest.sentry.io/api/[projectid]/store/ -H "Content-Type: application/json" -d '{...}'`

---

**Status:** Aguardando token set → Consultarei eventos de produção
