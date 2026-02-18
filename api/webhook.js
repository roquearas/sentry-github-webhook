const axios = require('axios');
const crypto = require('crypto');

const ALLOWED_LEVEL_LABELS = new Set(['fatal', 'error', 'warning', 'info', 'debug']);
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 100;

const rateState = globalThis.__sentryWebhookRateState || new Map();
globalThis.__sentryWebhookRateState = rateState;

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

function asNonEmptyString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return asNonEmptyString(value, '');
}

function getConfig() {
  return {
    githubToken: process.env.GITHUB_TOKEN,
    githubOwner: process.env.GITHUB_OWNER,
    githubRepo: process.env.GITHUB_REPO,
    sentryWebhookSecret: process.env.SENTRY_WEBHOOK_SECRET,
  };
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
  const header = getHeader(req, 'sentry-hook-signature') || getHeader(req, 'x-sentry-hook-signature');
  return header.replace(/^sha256=/i, '').trim();
}

function isValidSentrySignature(rawBody, req, sentryWebhookSecret) {
  if (!sentryWebhookSecret) return true;
  if (typeof rawBody !== 'string' || rawBody.length === 0) return false;

  const provided = getSignatureFromHeaders(req);
  if (!provided) return false;

  const expected = crypto
    .createHmac('sha256', sentryWebhookSecret)
    .update(rawBody, 'utf8')
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

function checkRateLimit(ip) {
  const now = Date.now();
  const key = asNonEmptyString(ip, 'unknown');
  const current = rateState.get(key);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + RATE_WINDOW_MS };
    rateState.set(key, next);
    return { allowed: true, remaining: RATE_MAX_REQUESTS - 1, resetAt: next.resetAt };
  }

  current.count += 1;
  if (current.count > RATE_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, RATE_MAX_REQUESTS - current.count),
    resetAt: current.resetAt,
  };
}

function cleanupExpiredRateLimitKeys() {
  const now = Date.now();
  if (rateState.size < 1000) return;
  for (const [key, value] of rateState.entries()) {
    if (value.resetAt <= now) {
      rateState.delete(key);
    }
  }
}

function getClientIp(req) {
  const forwardedFor = getHeader(req, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return asNonEmptyString(req.socket?.remoteAddress, 'unknown');
}

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

module.exports = async function sentryWebhookHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { githubToken, githubOwner, githubRepo, sentryWebhookSecret } = getConfig();
  if (!githubToken || !githubOwner || !githubRepo) {
    logger.error('Missing required environment variables', {
      hasGithubToken: Boolean(githubToken),
      hasGithubOwner: Boolean(githubOwner),
      hasGithubRepo: Boolean(githubRepo),
    });
    return res.status(500).json({ error: 'Missing required environment variables' });
  }

  let rawBody = '';
  let payload = {};
  try {
    rawBody = await readRawBody(req);
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    logger.warn('Invalid JSON payload', {
      reason: error?.message || 'unknown',
    });
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const ip = getClientIp(req);
  cleanupExpiredRateLimitKeys();
  const limiter = checkRateLimit(ip);
  if (!limiter.allowed) {
    logger.warn('Rate limit exceeded for webhook endpoint', {
      ip,
      resetAt: new Date(limiter.resetAt).toISOString(),
    });
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  if (!isValidSentrySignature(rawBody, req, sentryWebhookSecret)) {
    logger.warn('Rejected webhook due to invalid signature', {
      ip,
      path: req.url,
    });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    const { issue, event, projectName, action } = resolveWebhookPayloadEntities(payload);
    const hookResource = getHeader(req, 'sentry-hook-resource') || getHeader(req, 'x-sentry-hook-resource') || 'unknown';

    logger.info('Received Sentry webhook payload', {
      path: req.url,
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
    const body = `
**Project**: ${projectName}
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

    const githubUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/issues`;
    const response = await axios.post(
      githubUrl,
      {
        title,
        body,
        labels: ['sentry', issueLevel],
      },
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    logger.info('Created GitHub issue from Sentry event', {
      issueNumber: response.data.number,
      projectName,
      issueLevel,
      action,
      sourcePath: req.url,
    });

    return res.status(200).json({ success: true, issueNumber: response.data.number });
  } catch (error) {
    const mappedError = mapGithubError(error);
    logger.error('Failed to create GitHub issue from Sentry event', {
      statusCode: mappedError.status,
      reason: mappedError.message,
      isAxiosError: axios.isAxiosError(error),
      githubStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
      githubRequestId: axios.isAxiosError(error)
        ? error.response?.headers?.['x-github-request-id']
        : undefined,
    });
    return res.status(mappedError.status).json({ error: mappedError.message });
  }
};
