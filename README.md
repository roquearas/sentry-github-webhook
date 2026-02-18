# Sentry GitHub Webhook

Servidor Webhook Node.js/Express que sincroniza eventos do Sentry com GitHub automaticamente, criando issues quando ocorrem erros.

## Descrição

Este projeto estabelece uma integração entre Sentry e GitHub, permitindo que todos os eventos de erro reportados no Sentry sejam automaticamente sincronizados como issues no GitHub. Quando um novo erro é capturado pelo Sentry, um issue é criado no repositório GitHub com detalhes completos do erro.

## Funcionalidades

- 📌 Cria issues automaticamente no GitHub para cada erro do Sentry
- 🏷️ Adiciona labels por nível de severidade (error, warning, info, etc)
- 🔗 Vincula issues ao evento original do Sentry
- 📊 Incluir estatísticas de eventos nos últimos 24h
- ⚙️ Fácil deploy em Heroku ou Railway

## Requisitos

- Node.js 14+
- npm ou yarn
- GitHub Personal Access Token
- Sentry conta e projeto configurado

## Instalação Local

### 1. Clone o repositório

```bash
git clone https://github.com/roquearas/sentry-github-webhook.git
cd sentry-github-webhook
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha as variáveis:

```env
GITHUB_TOKEN=seu_token_github
GITHUB_OWNER=seu_usuario_github
GITHUB_REPO=seu_repositorio
SENTRY_WEBHOOK_SECRET=seu_sentry_secret
PORT=3000
```

### 4. Inicie o servidor

```bash
npm start
```

Ou em desenvolvimento com auto-reload:

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`.

## Configuração no Sentry

### 1. Crie um Personal Token no GitHub

- Vá para [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
- Clique em "Generate new token"
- Selecione escopos: `repo` (full control)
- Copie o token e guarde em local seguro

### 2. Configure o Webhook no Sentry

- Entre no seu projeto no Sentry
- Vá para **Settings > Integrations > Development**
- Crie uma nova integração interna ou use a plataforma de integração
- Configure a URL do webhook: `https://seu-dominio.com/webhook/sentry`
- Ative os eventos: `issue.created`, `issue.resolved`, `error`

## Deploy

### Heroku

```bash
heroku create seu-app-name
heroku config:set GITHUB_TOKEN=seu_token
heroku config:set GITHUB_OWNER=seu_usuario
heroku config:set GITHUB_REPO=seu_repo
heroku config:set SENTRY_WEBHOOK_SECRET=seu_secret
git push heroku main
```

### Railway

- Conecte seu repositório GitHub
- Adicione as variáveis de ambiente no painel do Railway
- Railway detectará automaticamente o `Procfile` e fará o deploy

## Estrutura do Projeto

```
.
├── .env.example          # Template de variáveis de ambiente
├── .gitignore            # Arquivos ignorados pelo Git
├── package.json          # Dependências e scripts
├── Procfile             # Configuração para Heroku/Railway
├── server.js            # Servidor Express principal
└── README.md            # Este arquivo
```

## Como Funciona

1. Sentry detecta um novo erro em seu aplicativo
2. Sentry envia um webhook POST para `/webhook/sentry`
3. O servidor recebe o payload com detalhes do erro
4. Extrai informações relevantes (título, severidade, link, etc)
5. Cria um novo issue no GitHub com essas informações
6. GitHub recebe o issue automaticamente

## Exemplo de Issue Criado

**Título**: `[Sentry] TypeError: Cannot read property 'foo' of undefined`

**Descrição**:
```
**Project**: my-app
**Level**: error
**URL**: [View in Sentry](https://sentry.io/...)
**Events**: 5 in last 24h

**First Seen**: 2024-01-15 10:30:00
**Last Seen**: 2024-01-15 14:45:00

`TypeError: Cannot read property 'foo' of undefined at Object.handler`
```

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | ✓ |
| `GITHUB_OWNER` | Proprietário do repositório GitHub | ✓ |
| `GITHUB_REPO` | Nome do repositório | ✓ |
| `SENTRY_WEBHOOK_SECRET` | Secret do webhook Sentry | ✗ |
| `PORT` | Porta do servidor (padrão: 3000) | ✗ |

## Endpoints

### POST `/webhook/sentry`

Recebe eventos do Sentry e cria issues no GitHub.
Compatibilidade: o endpoint legado `/sentry-webhook` também é aceito.

**Payload esperado**: Webhook payload do Sentry

**Response**:
```json
{
  "success": true,
  "issueNumber": 42
}
```

### GET `/health`

Verifica o status do servidor.

**Response**:
```json
{
  "status": "ok"
}
```

## Troubleshooting

### Erro: "Missing required environment variables"

Certifique-se de que `GITHUB_TOKEN`, `GITHUB_OWNER`, e `GITHUB_REPO` estão definidos.

### Erro: "Invalid payload"

Verifique se o payload do Sentry está bem formado e contém a estrutura esperada.

### Issues não estão sendo criados

1. Verifique se o webhook está apontando para a URL correta
2. Verifique os logs do servidor
3. Teste manualmente enviando um POST para `/webhook/sentry`

## Contribuindo

Sinta-se livre para abrir issues e pull requests!

## Licença

MIT - Veja LICENSE para detalhes

## Autor

[roquearas](https://github.com/roquearas)
