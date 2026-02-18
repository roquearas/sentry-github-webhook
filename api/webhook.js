const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');

// Configura Octokit (GitHub API)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Função para verificar assinatura do Sentry
function verifySignature(body, signature) {
  if (!signature || !process.env.SENTRY_WEBHOOK_SECRET) return true;
  
  const hmac = crypto.createHmac('sha256', process.env.SENTRY_WEBHOOK_SECRET);
  const digest = hmac.update(JSON.stringify(body)).digest('hex');
  return signature === digest;
}

// Serverless function handler para Vercel
module.exports = async (req, res) => {
  // Apenas aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar assinatura
    const signature = req.headers['sentry-hook-signature'];
    if (!verifySignature(req.body, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('Evento recebido do Sentry:', event.action);

    // Processar apenas eventos de erro criados
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

    return res.status(200).json({ 
      success: true, 
      message: 'Event processed' 
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ 
      error: error.message 
    });
  }
};
