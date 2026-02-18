# 🎯 Sistema de Prioridades - Issues do Sentry

**Status**: Pronto para correção via Claude + Codex
**Data**: 17 de Fevereiro de 2026
**Projeto**: sentry-github-webhook

---

## 📊 Quadro Executivo

| 🔴 P1 | 🟠 P2 | 🟡 P3 | 🟢 P4 |
|-------|-------|-------|-------|
| **4 Issues** | **2 Issues** | **1 Issue** | **1 Issue** |
| Críticas | Altas | Médias | Baixas |
| Bloqueia produção | Afeta estabilidade | Afeta UX | Nice-to-have |
| **ETA**: 2h | **ETA**: 1h | **ETA**: 30m | **ETA**: 15m |

---

# 🔴 PRIORIDADE 1: CRÍTICA (4 Issues)

## P1-001: Acesso a Propriedades Aninhadas Sem Validação

**Status**: 🟥 BLOQUEADOR
**Severidade**: CRÍTICA
**Impacto**: Issues criadas no GitHub com dados formatados incorretamente

### Onde Está o Erro?
- **Arquivo**: `server.js`
- **Linhas**: 37-40
- **Função**: Extração de dados do webhook

### O Problema
```javascript
// ❌ CÓDIGO ATUAL (Errado)
const body = `
**Project**: ${data.project_name}
**Level**: ${issue.level}
**URL**: [View in Sentry](${issue.url})
**Events**: ${issue.stats['24h']?.[0]?.[1] || 0} in last 24h
**First Seen**: ${issue.firstSeen}
**Last Seen**: ${issue.lastSeen}
`
// Resultado: "**First Seen**: undefined"
```

### Por Quê?
- `issue.firstSeen` pode ser `undefined`
- `issue.lastSeen` pode ser `undefined`
- String template exibe "undefined" literalmente
- Cria issues ilegíveis no GitHub

### Solução (Use Claude para gerar)
```javascript
// ✅ CÓDIGO CORRIGIDO
const eventCount = issue.stats?.['24h']?.[0]?.[1] ?? 0;
const firstSeen = issue.firstSeen ?? 'Não disponível';
const lastSeen = issue.lastSeen ?? 'Não disponível';

const body = `
**Projeto**: ${projectName}
**Nível**: ${issue.level}
**URL**: [Ver no Sentry](${issue.url})
**Eventos**: ${eventCount} em 24h
**Primeiro visto**: ${firstSeen}
**Último visto**: ${lastSeen}
\`\`\`
${issue.culprit ?? 'Stacktrace indisponível'}
\`\`\`
`.trim();
```

### Checklist de Correção
- [ ] Validar `issue.firstSeen` com `??`
- [ ] Validar `issue.lastSeen` com `??`
- [ ] Validar `issue.url` com `??`
- [ ] Validar `issue.culprit` com `??`
- [ ] Testar com dados undefined
- [ ] Commit & Push

**Tempo Estimado**: 15 min

---

## P1-002: Propriedade `project_name` Não Garantida

**Status**: 🟥 BLOQUEADOR
**Severidade**: CRÍTICA
**Impacto**: Dados faltando nas issues criadas

### Onde Está o Erro?
- **Arquivo**: `server.js`
- **Linha**: 36
- **Função**: Extração de dados

### O Problema
```javascript
// ❌ CÓDIGO ATUAL
const projectName = data.project_name;
// Resultado: undefined → "**Project**: undefined"
```

### Por Quê?
- Sentry pode enviar `project` (objeto) em vez de `project_name`
- Payload não é validado
- Causa dados faltando nas issues

### Solução
```javascript
// ✅ CÓDIGO CORRIGIDO
const projectName = data.project_name || 
                   data.project?.name || 
                   'Projeto Desconhecido';
```

### Checklist
- [ ] Adicionar fallback para `data.project?.name`
- [ ] Adicionar fallback final: 'Projeto Desconhecido'
- [ ] Testar com diferentes payloads
- [ ] Commit & Push

**Tempo Estimado**: 10 min

---

## P1-003: Tratamento de Erro HTTP Genérico

**Status**: 🟥 BLOQUEADOR  
**Severidade**: CRÍTICA
**Impacto**: Impossível debugar, risco de vazamento de token

### Onde Está o Erro?
- **Arquivo**: `server.js`
- **Linhas**: 47-68
- **Função**: Requisição POST ao GitHub

### O Problema
```javascript
// ❌ CÓDIGO ATUAL (Ruim)
catch (error) {
  console.error('Error creating issue:', error.message);
  res.status(500).json({ error: error.message });
}
// Problema: Não diferencia 401, 404, 422, etc
// Pode vazar token em error.response.headers
```

### Por Quê?
- Erros 401 (token inválido) não são diferenciados
- Erros 404 (repo não existe) não são diferenciados
- Stack trace pode conter headers com token
- User vê mensagens genéricas e não sabe o que fazer

### Solução
```javascript
// ✅ CÓDIGO CORRIGIDO
catch (error) {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || 'Erro desconhecido';
    console.error(`GitHub API Error [${status}]: ${message}`);
    
    switch(status) {
      case 401:
        return res.status(401).json({ error: 'Token GitHub inválido' });
      case 404:
        return res.status(404).json({ error: 'Repositório não encontrado' });
      case 422:
        return res.status(422).json({ error: 'Dados de issue inválidos' });
      default:
        return res.status(status).json({ error: message });
    }
  } else if (error.request) {
    console.error('GitHub sem resposta:', error.message);
    return res.status(503).json({ error: 'GitHub indisponível' });
  } else {
    console.error('Erro ao processar:', error.message);
  }
  res.status(500).json({ error: 'Falha ao criar issue' });
}
```

### Checklist
- [ ] Verificar se `error.response` existe
- [ ] Diferenciar status 401, 404, 422
- [ ] Não logar dados sensíveis
- [ ] Adicionar timeout na requisição
- [ ] Testar cada cenário de erro
- [ ] Commit & Push

**Tempo Estimado**: 20 min

---

## P1-004: Falta de Rate Limiting

**Status**: 🟥 BLOQUEADOR (Segurança)  
**Severidade**: CRÍTICA
**Impacto**: Vulnerável a DoS, excede quota do GitHub

### Onde Está o Erro?
- **Arquivo**: `server.js`
- **Linha**: 25-26 (endpoint sem proteção)
- **Função**: POST /webhook/sentry

### O Problema
```javascript
// ❌ CÓDIGO ATUAL (Sem proteção)
app.post('/webhook/sentry', async (req, res) => {
  // Qualquer um pode fazer requisições ilimitadas!
});
```

### Por Quê?
- Sem rate limiting
- Atacante pode enviar 1M requisições
- Excede quota do GitHub (5000/hora)
- Pode derrubar o servidor

### Solução
```bash
npm install express-rate-limit
```

```javascript
// ✅ CÓDIGO CORRIGIDO
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requisições
  message: 'Muitas requisições, tente novamente mais tarde'
});

app.post('/webhook/sentry', limiter, async (req, res) => {
  // ... resto do código
});
```

### Checklist
- [ ] `npm install express-rate-limit`
- [ ] Adicionar import do módulo
- [ ] Configurar limiter (100/15min)
- [ ] Aplicar ao endpoint /webhook/sentry
- [ ] Testar com múltiplas requisições
- [ ] Commit & Push

**Tempo Estimado**: 5 min

---

# 🟠 PRIORIDADE 2: ALTA (2 Issues)

## P2-001: Token GitHub Exposto em Logs

**Status**: 🟧 IMPORTANTE  
**Severidade**: ALTA
**Impacto**: Possível vazamento de credenciais

### Problema
- Não sanitizar console.error(error)
- Stack trace pode conter headers com token

### Solução
```javascript
// ❌ NÃO FAZER
console.error(error); // Pode expor token

// ✅ FAZER
console.error('Erro ao criar issue:', error.message);
// Logar apenas a mensagem, nunca o objeto inteiro
```

**Tempo Estimado**: 10 min

---

## P2-002: Validação de Labels Ausente

**Status**: 🟧 IMPORTANTE
**Severidade**: ALTA  
**Impacto**: Falha ao criar issue com erro 422

### Problema
- `issue.level` pode conter caracteres especiais
- GitHub limita labels a 50 caracteres
- Labels precisam ser lowercase

### Solução
```javascript
// ❌ CÓDIGO ATUAL
labels: ['sentry', issue.level]

// ✅ CÓDIGO CORRIGIDO
const validLevels = ['fatal', 'error', 'warning', 'info', 'debug'];
const level = validLevels.includes(issue.level?.toLowerCase()) 
              ? issue.level.toLowerCase() 
              : 'error';
const labels = ['sentry', `severity-${level}`];
```

**Tempo Estimado**: 15 min

---

# 🟡 PRIORIDADE 3: MÉDIA (1 Issue)

## P3-001: Falta de Validação de Assinatura HMAC

**Status**: 🟨 IMPORTANTE
**Severidade**: MÉDIA
**Impacto**: Qualquer um pode fazer POST para /webhook/sentry

### Solução
- Validar header `X-Sentry-Hook-Signature`
- Comparar com hash HMAC do secret

**Tempo Estimado**: 25 min

---

# 🟢 PRIORIDADE 4: BAIXA (1 Issue)

## P4-001: Logging Não é Estruturado

**Status**: 🟩 NICE-TO-HAVE
**Severidade**: BAIXA
**Impacto**: Dificuldade em debugging em produção

### Solução
- Usar `winston` ou `pino` em vez de `console.log`

**Tempo Estimado**: 30 min

---

## 📋 Próximas Ações

### Passo 1: Comece por P1-001
1. Abra o `server.js`
2. Vá para linhas 37-40
3. Use as soluções acima
4. Teste localmente
5. Faça commit e push

### Passo 2: Passe para P1-002
1. Modifique a extração de `projectName`
2. Adicione fallbacks
3. Teste com diferentes payloads

### Passo 3: Corrija P1-003 e P1-004
4. Melhore o tratamento de erros
5. Adicione rate limiting

### Passo 4: Resolva P2 Issues
6. Sanitize logs
7. Valide labels

### Passo 5: Final
8. Implemente P3 e P4 conforme tempo permite

---

## 🔗 Referências

- ANALISE_ERROS.md - Análise detalhada completa
- server.js - Código atual
- package.json - Dependências

---

**Status Geral**: 🔴 **NÃO RECOMENDADO PARA PRODUÇÃO**
**Ação**: Corrigir P1-001 e P1-002 hoje!
