require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const SENTRY_WEBHOOK_SECRET = process.env.SENTRY_WEBHOOK_SECRET;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Webhook endpoint to receive Sentry events
app.post('/webhook/sentry', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !data.issue) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const issue = data.issue;
    const title = `[Sentry] ${issue.title}`;
    const body = `
**Project**: ${data.project_name}
**Level**: ${issue.level}
**URL**: [View in Sentry](${issue.url})
**Events**: ${issue.stats['24h']?.[0]?.[1] || 0} in last 24h

**First Seen**: ${issue.firstSeen}
**Last Seen**: ${issue.lastSeen}

\`\`\`
${issue.culprit}
\`\`\`
    `.trim();

    // Create GitHub issue
    const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
    const response = await axios.post(
      githubUrl,
      {
        title,
        body,
        labels: ['sentry', issue.level],
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    console.log(`Created GitHub issue #${response.data.number}`);
    res.json({ success: true, issueNumber: response.data.number });
  } catch (error) {
    console.error('Error creating issue:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Sentry GitHub Webhook server listening on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/sentry`);
});
