module.exports = async function healthHandler(_req, res) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'sentry-github-webhook',
    platform: 'vercel',
  });
};
