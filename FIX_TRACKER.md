# 🔧 Fix Tracker - Rastreamento de Correções

**Status Geral**: Em Progresso
**Data de Início**: 17 de Fevereiro de 2026
**Data de Conclusão Estimada**: 17 de Fevereiro de 2026 (4 horas)

---

## 📊 Dashboard de Progresso

```
[████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 42% (5 de 8 done)

P1 (Crítica):  [████████████░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 de 4)
P2 (Alta):      [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 de 2)
P3 (Média):    [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 de 1)
P4 (Baixa):     [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 de 1)
```

---

## 🔄 PRIORIDADE 1: CRÍTICA

### [ ] P1-001: Acesso a Propriedades Aninhadas Sem Validação
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js` (Linhas 37-40)
- **Descrição**: Validar `issue.firstSeen`, `issue.lastSeen`, `issue.url`, `issue.culprit`
- **Tempo Estimado**: 15 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

**Checklist**:
- [ ] Ler o código em server.js
- [ ] Aplicar solução com operador `??`
- [ ] Testar com dados undefined
- [ ] Fazer commit: `fix(server): validate nested issue properties`

---

### [ ] P1-002: Propriedade `project_name` Não Garantida
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js` (Linha 36)
- **Descrição**: Adicionar fallbacks para `project_name`
- **Tempo Estimado**: 10 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

**Checklist**:
- [ ] Validar `data.project_name || data.project?.name || 'Projeto Desconhecido'`
- [ ] Testar com diferentes payloads
- [ ] Fazer commit: `fix(server): add project_name fallbacks`

---

### [ ] P1-003: Tratamento de Erro HTTP Genérico
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js` (Linhas 47-68)
- **Descrição**: Implementar tratamento diferenciado para status 401, 404, 422
- **Tempo Estimado**: 20 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

**Checklist**:
- [ ] Adicionar verificação de `error.response`
- [ ] Implementar switch com casos específicos
- [ ] Testar cada cenário
- [ ] Fazer commit: `fix(server): improve HTTP error handling`

---

### [ ] P1-004: Falta de Rate Limiting
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js` e `package.json`
- **Descrição**: Instalar e configurar `express-rate-limit`
- **Tempo Estimado**: 5 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

**Checklist**:
- [ ] `npm install express-rate-limit`
- [ ] Adicionar require do módulo
- [ ] Configurar limiter (100/15min)
- [ ] Aplicar ao endpoint
- [ ] Fazer commit: `fix(server): add rate limiting`

---

## 🜔 PRIORIDADE 2: ALTA

### [ ] P2-001: Token GitHub Exposto em Logs
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js`
- **Descrição**: Sanitizar logs, não registrar objetos de erro inteiros
- **Tempo Estimado**: 10 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

---

### [ ] P2-002: Validação de Labels Ausente
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js` (Linha 52)
- **Descrição**: Validar e normalizar labels
- **Tempo Estimado**: 15 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

---

## 🌟 PRIORIDADE 3: MÉDIA

### [ ] P3-001: Validação de Assinatura HMAC
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js`
- **Descrição**: Validar header `X-Sentry-Hook-Signature`
- **Tempo Estimado**: 25 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

---

## 🜝 PRIORIDADE 4: BAIXA

### [ ] P4-001: Logging Não é Estruturado
- **Status**: PENDÊNCIA
- **Atribuído**: Claude / Codex
- **Arquivo**: `server.js` e `package.json`
- **Descrição**: Usar `winston` ou `pino`
- **Tempo Estimado**: 30 min
- **Início**: -
- **Conclusão**: -
- **Commit**: -

---

## 👑 Ótimo de Priorização

Siga esta ordem para conseguir máximo valor:

```
1. P1-004 (Rate Limiting)    - 5 min   - Bloqueia DeVops
2. P1-001 (Nested Props)    - 15 min  - Issues ilegíveis
3. P1-002 (project_name)    - 10 min  - Dados faltando
4. P1-003 (HTTP Errors)     - 20 min  - Diff. erros
5. P2-001 (Token Logs)      - 10 min  - Segurança
6. P2-002 (Labels)          - 15 min  - Falhas 422
7. P3-001 (HMAC)           - 25 min  - Validação
8. P4-001 (Logging)        - 30 min  - Nice-to-have
---
TEMPO TOTAL: 130 minutos (~2.2 horas)
```

---

## 💻 Instruções para Claude + Codex

### Como usar este arquivo:

1. **Escolha um P1 acima**
2. **Verifique os detalhes em SENTRY_ISSUES_PRIORITY.md**
3. **Aplique a solução** fornecida
4. **Teste localmente**
5. **Faça commit com mensagem clara**
6. **Marque [ ] como [x]** neste arquivo
7. **Repita** para o próximo

### Estrutura de Commit:
```
fix(server): [nome do erro]

Fix #P1-001: Acesso a Propriedades Aninhadas Sem Validação

Mudanças:
- Adicionar validação de issue.firstSeen com `??`
- Adicionar validação de issue.lastSeen com `??`
- Adicionar validação de issue.url com `??`

Tempo: 15 min
```

---

## 💳 Nota Importante

**NÃO avançar para P2 ou P3** sem finalizar todos os P1.

Os P1 Issues são bloqueadores para produção.

---

## 📉 Log de Progresso

| Data | Hora | Issue | Status | Observações |
|------|------|-------|--------|----------------|
| 2026-02-17 | 21:00 | P1-001 | Pendente | - |
| | | P1-002 | Pendente | - |
| | | P1-003 | Pendente | - |
| | | P1-004 | Pendente | - |

---

**Ótimo trabalho! Vamos corrigir isso! 🙋**
