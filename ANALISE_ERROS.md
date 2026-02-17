# Análise de Erros - Webhook Sentry-GitHub

**Data da Análise**: 17 de Fevereiro de 2026
**Analisador**: Sentry Code Analysis

---

## Resumo Executivo

O código do arquivo `server.js` foi analisado e identificados **5 erros críticos** e **3 aviso de segurança** que precisam de correção imediata.

**Severidade Geral**: 🔴 CRÍTICA

---

## Erros Identificados

### 1. ❌ ERRO CRÍTICO: Acesso a Propriedades Aninhadas Sem Validação (Linha 37-40)

**Localização**: Método `POST /webhook/sentry` - Extração de dados

**Problema**:
```javascript
const body = `
**Project**: ${data.project_name}
**Level**: ${issue.level}
**URL**: [View in Sentry](${issue.url})
**Events**: ${issue.stats['24h']?.[0]?.[1] || 0} in last 24h
**First Seen**: ${issue.firstSeen}
**Last Seen**: ${issue.lastSeen}
`
```

**Por quê é um erro?**
- A propriedade `issue.stats['24h']` pode retornar `undefined` ou `null`
- O acesso encadeado `?.[0]?.[1]` tenta acessar índices que podem não existir
- Se `issue.firstSeen` ou `issue.lastSeen` for `undefined`, será exibido "undefined" na issue
- Pode causar strings formatadas incorretamente no GitHub

**Risco**: 🔴 Alto - Issues mal formatadas, difíceis de entender

**Solução**:
```javascript
const eventCount = issue.stats?.['24h']?.[0]?.[1] ?? 0;
const firstSeen = issue.firstSeen ?? 'Data não disponível';
const lastSeen = issue.lastSeen ?? 'Data não disponível';
const issueUrl = issue.url ?? '#';

const body = `
**Project**: ${data.project_name}
**Level**: ${issue.level}
**URL**: [Ver no Sentry](${issueUrl})
**Eventos**: ${eventCount} em 24h
**Primeiro visto**: ${firstSeen}
**Último visto**: ${lastSeen}
\`\`\`
${issue.culprit ?? 'Stacktrace não disponível'}
\`\`\`
`.trim();
```

---

### 2. ❌ ERRO CRÍTICO: Propriedade `data.project_name` Não Garantida (Linha 36)

**Localização**: Extração de `project_name`

**Problema**:
- A propriedade `project_name` não é validada antes do uso
- O payload do Sentry pode vir com `project` (objeto) em vez de `project_name` (string)
- Pode resultar em: `"**Project**: undefined"`

**Risco**: 🔴 Alto - Dados faltando nas issues criadas

**Solução**:
```javascript
const projectName = data.project_name || data.project?.name || 'Projeto Desconhecido';

const body = `
**Projeto**: ${projectName}
...`
```

---

### 3. ❌ ERRO CRÍTICO: Falta de Tratamento de Erro para Requisição HTTP (Linha 47-64)

**Localização**: Chamada `axios.post()` para criar issue no GitHub

**Problema**:
- Se o GitHub retornar erro 401 (token inválido), 404 (repo não existe), ou qualquer outro erro
- O catch genérico pega `error.message`, mas para erros de rede:
  - `error.response` pode não existir
  - `error.response.data` pode conter mensagem estruturada
  - Informações sensíveis (token) podem vazar nos logs

**Risco**: 🔴 Alto - Erros não informativos, possível vazamento de dados

**Solução**:
```javascript
try {
  const response = await axios.post(githubUrl, {
    title,
    body,
    labels: ['sentry', issue.level],
  }, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    timeout: 10000, // Adicionar timeout
  });

  console.log(`Created GitHub issue #${response.data.number}`);
  res.json({ success: true, issueNumber: response.data.number });
} catch (error) {
  if (error.response) {
    // GitHub retornou um erro
    const status = error.response.status;
    const message = error.response.data?.message || 'Erro desconhecido';
    console.error(`GitHub API Error [${status}]: ${message}`);
    
    if (status === 401) {
      return res.status(401).json({ error: 'Token GitHub inválido' });
    } else if (status === 404) {
      return res.status(404).json({ error: 'Repositório não encontrado' });
    } else if (status === 422) {
      return res.status(422).json({ error: 'Dados de issue inválidos' });
    }
  } else if (error.request) {
    // Requisição foi feita mas sem resposta
    console.error('Sem resposta do GitHub:', error.message);
    return res.status(503).json({ error: 'GitHub indisponível' });
  } else {
    // Erro ao configurar requisição
    console.error('Erro ao processar:', error.message);
  }
  
  res.status(500).json({ error: 'Falha ao criar issue' });
}
```

---

### 4. ❌ ERRO CRÍTICO: Falta de Validação de Labels (Linha 52)

**Localização**: Criação de labels `['sentry', issue.level]`

**Problema**:
- `issue.level` pode ser qualquer valor retornado pelo Sentry
- GitHub limita labels a 50 caracteres cada
- Se `issue.level` for muito longo ou contiver caracteres especiais, causará erro 422
- Labels precisam ser em minúsculas no GitHub

**Risco**: 🔴 Alto - Falha ao criar issue

**Solução**:
```javascript
// Sanitizar e normalizar labels
const validLevels = ['fatal', 'error', 'warning', 'info', 'debug'];
const level = validLevels.includes(issue.level) ? issue.level : 'error';
const labels = ['sentry', `severity-${level}`];

const response = await axios.post(githubUrl, {
  title,
  body,
  labels,
}, {
  headers: {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  },
});
```

---

### 5. ❌ ERRO CRÍTICO: Não há Limite de Rate (Linha 25-26)

**Localização**: Endpoint sem proteção

**Problema**:
- Nenhum rate limiting implementado
- Um atacante pode enviar milhões de requisições HTTP
- Pode exceder quota do GitHub rapidamente (5000 requisições/hora)
- Pode derrubar o servidor

**Risco**: 🔴 Alto - DoS vulnerável

**Solução**: Instalar `express-rate-limit`:
```javascript
npm install express-rate-limit

// No início do arquivo:
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições
  message: 'Muitas requisições, tente novamente mais tarde'
});

// Aplicar ao webhook:
app.post('/webhook/sentry', limiter, async (req, res) => {
  // ... resto do código
});
```

---

## Avisos de Segurança

### ⚠️ AVISO: Token GitHub Exposto em Logs (Linhas 11-15)

**Problema**: Se ocorrer um erro durante `axios.post`, o stack trace pode conter headers com o token

**Solução**: Sanitizar antes de logar:
```javascript
console.error('GitHub Error:', error.message);
// NÃO FAZER: console.error(error); // Pode expor token
```

### ⚠️ AVISO: Falta de Validação de Assinatura (Linha 25)

**Problema**: Qualquer um pode fazer POST para `/webhook/sentry`
**Solução**: Validar assinatura HMAC do Sentry

### ⚠️ AVISO: Falta de Logging Estruturado

**Problema**: `console.log/error` não é suficiente para produção
**Solução**: Use biblioteca como `winston` ou `pino`

---

## Prioridade de Correção

| Prioridade | Erro | Impacto |
|-----------|------|--------|
| 🔴 CRÍTICA | #1 - Acesso a propriedades aninhadas | Issues mal formatadas |
| 🔴 CRÍTICA | #2 - project_name não validada | Dados faltando |
| 🔴 CRÍTICA | #3 - Tratamento de erro HTTP | Erros não informativos |
| 🔴 CRÍTICA | #4 - Validação de labels | Falha ao criar issue |
| 🔴 CRÍTICA | #5 - Sem rate limiting | Vulnerável a DoS |
| 🟠 ALTA | Segurança - Token exposto | Vazamento de dados |
| 🟠 ALTA | Validação de assinatura | Qualquer um pode chamar |
| 🟡 MÉDIA | Logging estruturado | Dificuldade em debugging |

---

## Próximos Passos

1. ✅ Implementar validação de dados
2. ✅ Melhorar tratamento de erros HTTP
3. ✅ Adicionar rate limiting
4. ✅ Implementar validação HMAC
5. ✅ Adicionar logging estruturado
6. ✅ Fazer testes unitários
7. ✅ Deploy em staging antes de produção

---

**Status**: 🔴 NÃO RECOMENDADO PARA PRODUÇÃO
**Ação Requerida**: Correção imediata de todos os erros críticos
