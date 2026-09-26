/**
 * WhatsApp outbox — jobs queued by the PHP website when order status changes.
 */
function createOutboxApi(query) {
    async function ensureOutboxTable() {
        await query(
            `CREATE TABLE IF NOT EXISTS whatsapp_outbox (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                job_type VARCHAR(32) NOT NULL,
                order_id INT NULL,
                payload_json LONGTEXT NOT NULL,
                status ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                last_error TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME NULL,
                INDEX idx_status_created (status, created_at),
                INDEX idx_order_id (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );
    }

    async function fetchPendingOutbox(limit = 8) {
        await ensureOutboxTable();
        const rows = await query(
            `SELECT * FROM whatsapp_outbox
             WHERE status IN ('pending', 'failed') AND attempts < 8
             ORDER BY id ASC
             LIMIT ${Number(limit) || 8}`
        );
        return rows || [];
    }

    async function claimOutboxJob(id) {
        const result = await query(
            `UPDATE whatsapp_outbox
             SET status = 'processing', attempts = attempts + 1
             WHERE id = ? AND status IN ('pending', 'failed')`,
            [id]
        );
        return result && result.affectedRows > 0;
    }

    async function markOutboxSent(id) {
        await query(
            `UPDATE whatsapp_outbox SET status = 'sent', last_error = NULL, processed_at = NOW() WHERE id = ?`,
            [id]
        );
    }

    async function markOutboxFailed(id, errorMessage) {
        await query(
            `UPDATE whatsapp_outbox SET status = 'failed', last_error = ?, processed_at = NOW() WHERE id = ?`,
            [String(errorMessage || '').slice(0, 1000), id]
        );
    }

    async function listOutbox(limit = 40) {
        await ensureOutboxTable();
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40));
        return query(
            `SELECT id, job_type, order_id, status, attempts, last_error, created_at, processed_at
             FROM whatsapp_outbox
             ORDER BY id DESC
             LIMIT ${safeLimit}`
        );
    }

    async function retryOutboxJob(id) {
        await query(
            `UPDATE whatsapp_outbox SET status = 'pending', last_error = NULL WHERE id = ?`,
            [id]
        );
    }

    return {
        ensureOutboxTable,
        fetchPendingOutbox,
        claimOutboxJob,
        markOutboxSent,
        markOutboxFailed,
        listOutbox,
        retryOutboxJob
    };
}

module.exports = createOutboxApi;
