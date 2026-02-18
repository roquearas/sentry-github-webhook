const express = require('express');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parse de JSON
app.use(express.json());

// Configuração do Octokit (GitHub API)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Função para verificar assinatura do Sentry
function verifySignature(req) {
  const signature = req.headers['sentry-hook-signature'];
  if (!signature || !process.env.SENTRY_WEBHOOK_SECRET) return true;
  
  const hmac = crypto.createHmac('sha256', process.env.SENTRY_WEBHOOK_SECRET);
  const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
  return signature === digest;
}

// Endpoint principal do webhook
app.post('/webhook/sentry', async (req, res) => {
  try {
    // Verificar assinatura
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('Evento recebido do Sentry:', event.action);

    // Processar apenas eventos de erro
    if (event.action === 'created' && event.data?.issue) {
      const issue = event.data.issue;
      const project = event.data.project;
      
      // Criar issue no GitHub
      const githubIssue = await octokit.issues.create({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        title: `[Sentry] ${issue.title}`,
        body: `## Erro detectado pelo Sentry\n\n` +
              `**Project:** ${project.name}\n` +
              `**Level:** ${issue.level}\n` +
              `**Count:** ${issue.count}\n` +
              `**First Seen:** ${issue.firstSeen}\n` +
              `**Last Seen:** ${issue.lastSeen}\n\n` +
              `**Link:** ${issue.permalink}\n\n` +
              `### Stack Trace\n\`\`\`\n${issue.metadata?.value || 'N/A'}\n\`\`\``,
        labels: ['sentry', 'bug', issue.level]
      });

      console.log('Issue criada no GitHub:', githubIssue.data.html_url);
      return res.status(200).json({ 
        success: true, 
        github_issue: githubIssue.data.html_url 
      });
    }

    res.status(200).json({ success: true, message: 'Event processed' });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Webhook server rodando na porta ${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}/webhook/sentry`);
});
