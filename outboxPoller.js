/**
 * Process queued WhatsApp jobs written by the PHP website.
 */
const http = require('http');
const https = require('https');

function parsePayload(row) {
    try {
        return JSON.parse(row.payload_json || '{}');
    } catch {
        return {};
    }
}

async function processJob(bot, row) {
    const payload = parsePayload(row);
    const type = row.job_type;

    if (type === 'status_update') {
        const orderData = payload.customer_phone ? {
            id: payload.order_id,
            order_number: payload.order_number,
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            total: payload.total || 0,
            paid_amount: payload.paid_amount || 0,
            waived_amount: payload.waived_amount || 0
        } : null;
        await bot.sendOrderStatusNotification(payload.order_id, payload.status, orderData);
        return;
    }

    if (type === 'order_menu') {
        await bot.sendOrderConfirmationMenu({
            id: payload.order_id,
            order_number: payload.order_number,
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            total: payload.total,
            shipping_cost: payload.shipping_cost || 0
        });
        return;
    }

    if (type === 'custom_message' || type === 'test_message') {
        await bot.sendMessage(payload.phone, payload.message);
        return;
    }

    if (type === 'broadcast_product') {
        await bot.broadcastNewProduct(payload);
        return;
    }

    throw new Error(`Unknown WhatsApp job type: ${type}`);
}

async function fetchRemoteOutbox(baseUrl) {
    return new Promise((resolve) => {
        const urlStr = `${baseUrl.replace(/\/$/, '')}/api/whatsapp_queue.php?action=fetch`;
        const client = urlStr.startsWith('https') ? https : http;
        client.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.jobs || []);
                } catch (e) {
                    console.error('[Remote API Parse Error]', e.message, 'Data:', data.substring(0, 100));
                    resolve([]);
                }
            });
        }).on('error', (err) => {
            console.error('[Remote API Network Error]', err.message);
            resolve([]);
        });
    });
}

async function markRemoteOutbox(baseUrl, id, status, errorMsg) {
    return new Promise((resolve) => {
        const urlStr = `${baseUrl.replace(/\/$/, '')}/api/whatsapp_queue.php?action=complete`;
        const client = urlStr.startsWith('https') ? https : http;
        const data = `id=${id}&status=${status}&error=${encodeURIComponent(errorMsg || '')}`;
        const req = client.request(urlStr, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded', 
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', resolve);
        });
        req.on('error', (err) => {
            console.error('[Remote API Mark Network Error]', err.message);
            resolve();
        });
        req.write(data);
        req.end();
    });
}

function startOutboxPoller(bot, db, io = null, intervalMs = 4000) {
    let busy = false;

    async function tick() {
        if (busy) return;
        if (!bot || bot.status !== 'ready') return;
        busy = true;
        try {
            const remoteUrl = process.env.REMOTE_SITE_URL;
            let jobs = [];
            let isRemote = false;

            if (remoteUrl && remoteUrl.trim() !== '') {
                jobs = await fetchRemoteOutbox(remoteUrl);
                isRemote = true;
            } else {
                jobs = await db.fetchPendingOutbox(5);
            }

            for (const row of jobs) {
                if (!isRemote) {
                    const claimed = await db.claimOutboxJob(row.id);
                    if (!claimed) continue;
                }
                
                try {
                    await processJob(bot, row);
                    
                    if (isRemote) {
                        await markRemoteOutbox(remoteUrl, row.id, 'sent', null);
                    } else {
                        await db.markOutboxSent(row.id);
                    }
                    
                    bot.log('outbox', `Sent queued job #${row.id} (${row.job_type})`);
                    if (io) {
                        io.emit('outbox_update', { id: row.id, status: 'sent' });
                    }
                } catch (err) {
                    if (isRemote) {
                        await markRemoteOutbox(remoteUrl, row.id, 'failed', err.message);
                    } else {
                        await db.markOutboxFailed(row.id, err.message);
                    }
                    
                    bot.log('error', `Outbox job #${row.id} failed: ${err.message}`);
                    if (io) {
                        io.emit('outbox_update', { id: row.id, status: 'failed', error: err.message });
                    }
                }
            }
        } catch (err) {
            console.error('[Outbox poller]', err.message);
        } finally {
            busy = false;
        }
    }

    const timer = setInterval(tick, intervalMs);
    tick();
    return () => clearInterval(timer);
}

module.exports = { startOutboxPoller, processJob };
