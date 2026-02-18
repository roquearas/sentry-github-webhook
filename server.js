// Sentry SDK Initialization
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 1.0,
});

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATHS = ['/webhook/sentry', '/sentry-webhook'];
const PRIMARY_WEBHOOK_PATH = WEBHOOK_PATHS[0];
const ALLOWED_LEVEL_LABELS = new Set(['fatal', 'error', 'warning', 'info', 'debug']);

const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...meta,
    }));
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      ...meta,
    }));
  },
  error(message, meta = {}) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...meta,
    }));
  },
};

// Middleware
app.use(express.json({
  limit: '1mb',
  verify(req, _res, buf) {
    req.rawBody = buf.toString('utf8');
  },
}));

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const SENTRY_WEBHOOK_SECRET = process.env.SENTRY_WEBHOOK_SECRET;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  logger.error('Missing required environment variables', {
    hasGithubToken: Boolean(GITHUB_TOKEN),
    hasGithubOwner: Boolean(GITHUB_OWNER),
    hasGithubRepo: Boolean(GITHUB_REPO),
  });
  process.exit(1);
}

if (!SENTRY_WEBHOOK_SECRET) {
  logger.warn('SENTRY_WEBHOOK_SECRET is not configured. Signature validation is disabled.');
}

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

function asNonEmptyString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getProjectName(data) {
  return asNonEmptyString(
    data.project_name || data.project?.name,
    'Projeto Desconhecido',
  );
}

function getIssueEventCountLast24h(issue) {
  const stats = issue?.stats?.['24h'];
  if (!Array.isArray(stats) || stats.length === 0) return 0;
  const firstPoint = stats[0];
  if (!Array.isArray(firstPoint) || typeof firstPoint[1] !== 'number') return 0;
  return firstPoint[1];
}

function getIssueLevelLabel(level) {
  const normalized = asNonEmptyString(level, 'error').toLowerCase();
  return ALLOWED_LEVEL_LABELS.has(normalized) ? normalized : 'error';
}

function resolveWebhookPayloadEntities(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const data = root.data && typeof root.data === 'object' ? root.data : {};

  const issue = data.issue && typeof data.issue === 'object'
    ? data.issue
    : (root.issue && typeof root.issue === 'object' ? root.issue : null);

  const event = data.event && typeof data.event === 'object'
    ? data.event
    : (root.event && typeof root.event === 'object' ? root.event : null);

  const projectSlug = asNonEmptyString(
    data.project_slug || root.project_slug || root.projectSlug,
    '',
  );

  const projectName = getProjectName({
    project_name: asNonEmptyString(data.project_name || root.project_name, '') || projectSlug,
    project: data.project || root.project || (projectSlug ? { name: projectSlug } : undefined),
  });

  const action = asNonEmptyString(root.action, 'unknown');
  return { issue, event, projectName, action };
}

function resolveIssueTitle(issue, event) {
  return asNonEmptyString(issue?.title, '')
    || asNonEmptyString(event?.title, '')
    || asNonEmptyString(event?.message, '').slice(0, 160)
    || 'Sentry event sem titulo';
}

function resolveIssueUrl(issue, event) {
  return asNonEmptyString(issue?.url, '')
    || asNonEmptyString(event?.web_url, '')
    || asNonEmptyString(event?.url, '')
    || '#';
}

function resolveIssueCulprit(issue, event) {
  return asNonEmptyString(issue?.culprit, '')
    || asNonEmptyString(event?.culprit, '')
    || asNonEmptyString(event?.message, '')
    || 'Sem stacktrace/cause';
}

function resolveFirstSeen(issue, event) {
  return asNonEmptyString(issue?.firstSeen || issue?.first_seen, '')
    || asNonEmptyString(event?.dateCreated || event?.received, '')
    || 'N/A';
}

function resolveLastSeen(issue, event) {
  return asNonEmptyString(issue?.lastSeen || issue?.last_seen, '')
    || asNonEmptyString(event?.dateCreated || event?.received, '')
    || 'N/A';
}

function resolveEventCount(issue, event) {
  const issueCount = getIssueEventCountLast24h(issue);
  if (issueCount > 0) return issueCount;

  const eventCount = event?.count;
  if (typeof eventCount === 'number' && eventCount > 0) return eventCount;
  if (typeof eventCount === 'string') {
    const parsed = Number(eventCount);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function getSignatureFromHeaders(req) {
  const header = req.get('sentry-hook-signature') || req.get('x-sentry-hook-signature');
  if (!header) return '';
  return header.replace(/^sha256=/i, '').trim();
}

function isValidSentrySignature(req) {
  if (!SENTRY_WEBHOOK_SECRET) return true;
  if (typeof req.rawBody !== 'string') return false;

  const provided = getSignatureFromHeaders(req);
  if (!provided) return false;

  const expected = crypto
    .createHmac('sha256', SENTRY_WEBHOOK_SECRET)
    .update(req.rawBody, 'utf8')
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

function mapGithubError(error) {
  if (!axios.isAxiosError(error)) {
    return { status: 500, message: 'Unexpected error while creating GitHub issue' };
  }

  const status = error.response?.status || 500;

  if (status === 401) {
    return { status: 500, message: 'GitHub authentication failed (401). Check GITHUB_TOKEN.' };
  }
  if (status === 403) {
    return { status: 502, message: 'GitHub access forbidden or rate-limited (403).' };
  }
  if (status === 404) {
    return { status: 500, message: 'GitHub repository not found (404). Check owner/repo.' };
  }
  if (status === 422) {
    return { status: 400, message: 'GitHub rejected payload (422). Verify issue fields/labels.' };
  }
  if (status === 429) {
    return { status: 503, message: 'GitHub API rate limit exceeded (429).' };
  }

  return { status: 502, message: `GitHub API request failed (${status}).` };
}

// Webhook endpoint(s) to receive Sentry events
app.post(WEBHOOK_PATHS, webhookLimiter, async (req, res) => {
  try {
    if (!isValidSentrySignature(req)) {
      logger.warn('Rejected webhook due to invalid signature', {
        path: req.path,
            });
          return res.status(401).json({ error: 'Invalid signature' });
        }

    logger.info('Received Sentry webhook payload', {
      path: req.path,
      action,
      resource: hookResource,
      hasIssue: Boolean(issue),
      hasEvent: Boolean(event),
    });

    if (!issue && !event) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const issueLevel = getIssueLevelLabel(issue?.level || event?.level);
    const issueTitle = resolveIssueTitle(issue, event);
    const issueUrl = resolveIssueUrl(issue, event);
    const issueCulprit = resolveIssueCulprit(issue, event);
    const issueEventsLast24h = resolveEventCount(issue, event);
    const firstSeen = resolveFirstSeen(issue, event);
    const lastSeen = resolveLastSeen(issue, event);
    const sentryIssueId = asNonEmptyString(issue?.shortId || issue?.shortID || issue?.id, 'N/A');
    const sentryEventId = asNonEmptyString(event?.eventID || event?.id, 'N/A');

    const title = `[Sentry] ${issueTitle}`;
const body = `    **Project**: ${projectName}
**Level**: ${issueLevel}
**URL**: [View in Sentry](${issueUrl})
**Events**: ${issueEventsLast24h} in last 24h
**Sentry Issue**: ${sentryIssueId}
**Sentry Event ID**: ${sentryEventId}
**First Seen**: ${firstSeen}
**Last Seen**: ${lastSeen}

\`\`\`
${issueCulprit}
\`\`\`
`.trim();
    


    // Create GitHub issue
    const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
    const response = await axios.post(
      githubUrl,
      {
        title,
        body,
        labels: ['sentry', issueLevel],
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    logger.info('Created GitHub issue from Sentry event', {
      issueNumber: response.data.number,
      projectName,
      issueLevel,
      action,
      sourcePath: req.path,
    });
    res.json({ success: true, issueNumber: response.data.number });
  } catch (error) {
    const mappedError = mapGithubError(error);
    logger.error('Failed to create GitHub issue from Sentry event', {
      statusCode: mappedError.status,
      reason: mappedError.message,
          Sentry.captureException(error);
    logger.error('Webhook processing failed', { error: error.message });
      isAxiosError: axios.isAxiosError(error),
      githubStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
      githubRequestId: axios.isAxiosError(error)
        ? error.response?.headers?.['x-github-request-id']
        : undefined,
    });
    res.status(mappedError.status).json({ error: mappedError.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  logger.error('Unhandled server error', {
      Sentry.captureException(err);
    reason: err?.message || 'unknown',
  });
  return res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info('Sentry GitHub Webhook server started', { port: PORT });
  logger.info('Webhook endpoints ready', {
    urls: WEBHOOK_PATHS.map((path) => `http://localhost:${PORT}${path}`),
    primary: `http://localhost:${PORT}${PRIMARY_WEBHOOK_PATH}`,
  });
});
