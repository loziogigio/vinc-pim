function authHeader(writeKey) {
    return 'Basic ' + Buffer.from(`${writeKey}:`).toString('base64');
}
async function post(cfg, path, payload) {
    try {
        const res = await fetch(cfg.dataPlaneUrl.replace(/\/$/, '') + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader(cfg.writeKey) },
            body: JSON.stringify({ ...payload, sentAt: new Date().toISOString() }),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
export async function serverTrack(cfg, input) {
    return post(cfg, '/v1/track', {
        event: input.event,
        userId: input.userId,
        anonymousId: input.anonymousId,
        properties: input.properties ?? {},
        context: input.context,
    });
}
export async function serverIdentify(cfg, input) {
    return post(cfg, '/v1/identify', {
        userId: input.userId,
        anonymousId: input.anonymousId,
        traits: input.traits ?? {},
        context: input.context,
    });
}
//# sourceMappingURL=server.js.map