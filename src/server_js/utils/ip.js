/**
 * Returns the real client IP, preferring Cloudflare's CF-Connecting-IP header.
 *
 * CF-Connecting-IP is set (and cannot be spoofed) by Cloudflare on every proxied
 * request, making it more reliable than X-Forwarded-For when behind Cloudflare.
 * Falls back to req.ip (populated by Express trust proxy) for non-Cloudflare traffic.
 */
function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp) return cfIp.trim();
    return (req.ip || '').replace(/^::ffff:/, '');
}

module.exports = { getClientIp };
