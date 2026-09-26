/**
 * Database connection module for WhatsApp Bot service
 */
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

let pool = null;

function getDbConfig() {
    let host = process.env.DB_HOST || '127.0.0.1';
    let user = process.env.DB_USER || 'zein';
    let password = process.env.DB_PASS || process.env.DB_PASSWORD || 'P@ssw0rd123!';
    let database = process.env.DB_NAME || 'medal_db';
    let port = parseInt(process.env.DB_PORT || '3306', 10);

    // If explicit env variables are set, use them directly
    if (process.env.DB_HOST && process.env.DB_NAME) {
        return {
            host,
            user,
            password,
            database,
            port,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            charset: 'utf8mb4'
        };
    }

    const filesToTry = [
        path.join(__dirname, '..', 'includes', 'db.local.php'),
        path.join(__dirname, '..', 'includes', 'db.hostinger.php'),
        path.join(__dirname, '..', 'includes', 'db.php')
    ];

    for (const filePath of filesToTry) {
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const dsnMatch = content.match(/host=([^;]+);dbname=([^;]+)/i);
                const userMatch = content.match(/define\(\s*['"]MEDAL_DB_USER['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
                const passMatch = content.match(/define\(\s*['"]MEDAL_DB_PASS['"]\s*,\s*['"]([^'"]*)['"]\s*\)/i);

                if (dsnMatch) {
                    const parsedHost = dsnMatch[1].trim();
                    host = (parsedHost === 'localhost') ? '127.0.0.1' : parsedHost;
                    database = dsnMatch[2].trim();
                }
                if (userMatch) user = userMatch[1].trim();
                if (passMatch) password = passMatch[1];
                if (dsnMatch || userMatch || passMatch) break;
            } catch (err) {
                console.error(`[DB] Error parsing ${filePath}:`, err.message);
            }
        }
    }

    return {
        host,
        user,
        password,
        database,
        port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'
    };
}

function getPool() {
    if (!pool) {
        const config = getDbConfig();
        console.log(`[DB] Connecting to MySQL at ${config.host}/${config.database} (user: ${config.user})...`);
        pool = mysql.createPool(config);
    }
    return pool;
}

/**
 * Execute query safely
 */
async function query(sql, params = []) {
    try {
        const p = getPool();
        const [rows] = await p.execute(sql, params);
        return rows;
    } catch (err) {
        console.error('[DB Query Error]', err.message, 'SQL:', sql);
        throw err;
    }
}

/**
 * Get store settings
 */
async function getSettings() {
    try {
        const rows = await query('SELECT setting_key, setting_value_ar, setting_value_en FROM settings');
        const settings = {};
        for (const r of rows) {
            settings[r.setting_key] = r.setting_value_ar || r.setting_value_en || '';
        }
        return settings;
    } catch (e) {
        console.warn('[DB] Fallback to default payment settings:', e.message);
        return {
            instapay_username: 'ahmedfayoumy1@instapay',
            instapay_url: 'https://ipn.eg/S/ahmedfayoumy1/instapay/7H0dWv',
            vodafone_cash_number: '01005250838',
            bank_account_info: 'البنك الأهلي المصري - حساب رقم 123456789'
        };
    }
}

/**
 * Normalize phone number digits for universal comparison
 */
function normalizeDigits(phone) {
    if (!phone) return '';
    let d = String(phone).replace(/\D/g, '');
    // Remove international prefix 00
    if (d.startsWith('00')) d = d.substring(2);
    return d;
}

/**
 * Find order by phone with smart international matching (latest pending/active preferred)
 */
async function findLatestOrderByPhone(phone) {
    if (!phone) return null;
    try {
        const digits = normalizeDigits(phone);
        if (digits.length < 5) return null;

        const last7 = digits.slice(-7);
        const last8 = digits.slice(-8);
        const last9 = digits.slice(-9);
        const last10 = digits.slice(-10);

        // 1. Try SQL query matching suffixes
        let rows = await query(
            `SELECT * FROM orders 
             WHERE (
                 customer_phone LIKE ? 
                 OR customer_phone LIKE ? 
                 OR customer_phone LIKE ? 
                 OR customer_phone LIKE ?
                 OR REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '+', ''), '-', '') LIKE ?
             )
             ORDER BY id DESC LIMIT 20`,
            [`%${last7}%`, `%${last8}%`, `%${last9}%`, `%${last10}%`, `%${last8}%`]
        );

        if (rows.length > 0) {
            // Prioritize pending/unconfirmed order among matches
            const pending = rows.find(r => r.status !== 'cancelled' && r.status !== 'delivered');
            if (pending) return pending;
            return rows[0];
        }

        // 2. Fallback in-memory comparison for complex country codes / local formats
        const recentOrders = await query(
            `SELECT * FROM orders WHERE customer_phone IS NOT NULL AND customer_phone != '' ORDER BY id DESC LIMIT 100`
        );
        for (const o of recentOrders) {
            const oDigits = normalizeDigits(o.customer_phone);
            if (!oDigits || oDigits.length < 5) continue;
            if (digits === oDigits || digits.endsWith(oDigits) || oDigits.endsWith(digits)) {
                return o;
            }
            if (digits.length >= 7 && oDigits.length >= 7) {
                if (digits.slice(-7) === oDigits.slice(-7)) return o;
            }
        }

        return null;
    } catch (e) {
        console.error('[DB] findLatestOrderByPhone error:', e.message);
        return null;
    }
}

/**
 * Find all active pending orders for a phone number (universal international support)
 */
async function findPendingOrdersByPhone(phone) {
    if (!phone) return [];
    try {
        const digits = normalizeDigits(phone);
        if (digits.length < 5) return [];

        const last8 = digits.slice(-8);
        const last9 = digits.slice(-9);

        const rows = await query(
            `SELECT * FROM orders 
             WHERE (
                 customer_phone LIKE ? 
                 OR customer_phone LIKE ? 
                 OR REPLACE(REPLACE(REPLACE(customer_phone, ' ', ''), '+', ''), '-', '') LIKE ?
             )
             AND status NOT IN ('cancelled', 'delivered')
             ORDER BY id DESC LIMIT 5`,
            [`%${last8}%`, `%${last9}%`, `%${last8}%`]
        );
        return rows || [];
    } catch (e) {
        console.error('[DB] findPendingOrdersByPhone error:', e.message);
        return [];
    }
}

/**
 * Find latest pending order in system
 */
async function findLatestPendingOrder() {
    try {
        const rows = await query(
            `SELECT * FROM orders 
             WHERE status NOT IN ('cancelled', 'delivered') 
             ORDER BY id DESC LIMIT 1`
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (e) {
        console.error('[DB] findLatestPendingOrder error:', e.message);
        return null;
    }
}

/**
 * Find order by order number or ID
 */
async function findOrderByNumber(orderNumber) {
    if (!orderNumber) return null;
    try {
        const rows = await query(
            `SELECT * FROM orders WHERE order_number = ? OR id = ? LIMIT 1`,
            [String(orderNumber), parseInt(orderNumber, 10) || 0]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (e) {
        console.error('[DB] findOrderByNumber error:', e.message);
        return null;
    }
}

/**
 * Alias for findOrderByNumber
 */
async function getOrderById(orderId) {
    return await findOrderByNumber(orderId);
}

/**
 * Update order confirmation status and payment scope
 */
async function updateOrderConfirmation(orderId, isConfirmed = 0, paymentScope = 'full', botStep = 'awaiting_receipt', advanceAmount = 0, remainingAmount = 0) {
    try {
        const sql = `UPDATE orders SET 
            is_confirmed = ?, 
            bot_step = ?, 
            payment_scope = ?, 
            payment_method = 'instapay_wallet',
            advance_amount = ?, 
            remaining_amount = ?
            WHERE id = ?`;
        return await query(sql, [isConfirmed ? 1 : 0, botStep, paymentScope, advanceAmount, remainingAmount, orderId]);
    } catch (e) {
        console.error('[DB] updateOrderConfirmation error:', e.message);
    }
}

/**
 * Save uploaded receipt image to order in pending_verification status
 */
async function saveOrderReceipt(orderId, filename) {
    try {
        if (orderId) {
            await query(
                `UPDATE orders SET 
                    payment_receipt = ?, 
                    payment_status = 'pending_verification', 
                    bot_step = 'receipt_received'
                 WHERE id = ?`,
                [filename, orderId]
            );
        }

        // Add admin notification
        try {
            await query(
                `INSERT INTO admin_notifications (type, title_ar, title_en, message_ar, message_en, link, is_read, created_at)
                 VALUES ('payment_receipt', 'إيصال تحويل جديد في انتظار مراجعة الموظف', 'New Payment Receipt Awaiting Review', ?, ?, ?, 0, NOW())`,
                [
                    orderId ? `تم استلام صورة تحويل للطلب رقم #${orderId} وهي في انتظار مراجعة الموظف` : `تم استلام صورة تحويل جديدة عبر الواتساب`,
                    orderId ? `New payment receipt for order #${orderId} awaiting staff verification` : `New receipt image via WhatsApp`,
                    orderId ? `order_view.php?id=${orderId}` : `orders.php`
                ]
            );
        } catch (err) {}

        return true;
    } catch (e) {
        console.error('[DB] saveOrderReceipt error:', e.message);
        return false;
    }
}

/**
 * Save customer payment transaction reference number
 */
async function saveOrderPaymentReference(orderId, refNumber, rawMessage = '') {
    try {
        await query(
            `UPDATE orders SET 
                payment_reference = ?, 
                payment_status = 'pending_verification', 
                bot_step = 'receipt_received',
                admin_notes = CONCAT(COALESCE(admin_notes, ''), '\n[واتساب] رقم العملية المرسل: ', ?)
             WHERE id = ?`,
            [refNumber, `${refNumber} (رسالة: ${rawMessage})`, orderId]
        );

        // Add admin notification
        try {
            await query(
                `INSERT INTO admin_notifications (type, title_ar, title_en, message_ar, message_en, link, is_read, created_at)
                 VALUES ('payment_ref', 'رقم عملية جديد للطلب', 'New Payment Reference for Order', ?, ?, ?, 0, NOW())`,
                [
                    `أرسل العميل رقم العملية (${refNumber}) للطلب #${orderId} عبر الواتساب في انتظار المراجعة`,
                    `Customer provided payment reference (${refNumber}) for order #${orderId} via WhatsApp`,
                    `order_view.php?id=${orderId}`
                ]
            );
        } catch (err) {}

        return true;
    } catch (e) {
        console.error('[DB] saveOrderPaymentReference error:', e.message);
        return false;
    }
}

/**
 * Cancel an order
 */
async function cancelOrder(orderId) {
    try {
        return await query(
            `UPDATE orders SET status = 'cancelled', bot_step = 'cancelled' WHERE id = ?`,
            [orderId]
        );
    } catch (e) {
        console.error('[DB] cancelOrder error:', e.message);
    }
}

/**
 * Get recent receipts
 */
async function getRecentReceipts(limit = 50) {
    try {
        return await query(
            `SELECT id, order_number, customer_name, customer_phone, total, shipping_cost, payment_scope, advance_amount, remaining_amount, payment_method, payment_receipt, payment_reference, payment_status, is_confirmed, confirmed_at, created_at
             FROM orders 
             WHERE (payment_receipt IS NOT NULL AND payment_receipt != '') OR (payment_reference IS NOT NULL AND payment_reference != '')
             ORDER BY id DESC LIMIT ?`,
            [limit]
        );
    } catch (e) {
        return [];
    }
}

/**
 * Confirm order directly by staff chat message
 */
async function confirmOrderByStaff(orderId, payStatus = 'verified', paidAmount = 0) {
    try {
        await query(
            `UPDATE orders SET 
                is_confirmed = 1, 
                payment_status = ?, 
                paid_amount = GREATEST(COALESCE(paid_amount, 0), ?), 
                status = 'processing', 
                bot_step = 'confirmed_by_staff',
                confirmed_at = COALESCE(confirmed_at, NOW()) 
             WHERE id = ?`,
            [payStatus, paidAmount, orderId]
        );

        // Add admin notification
        try {
            await query(
                `INSERT INTO admin_notifications (type, title_ar, title_en, message_ar, message_en, link, is_read, created_at)
                 VALUES ('order_confirmed', 'تأكيد طلب من محادثة الواتساب', 'Order Confirmed via WhatsApp Chat', ?, ?, ?, 0, NOW())`,
                [
                    `تم تأكيد الطلب #${orderId} تلقائياً بعد كتابة الموظف 'تم التأكيد' في محادثة الواتساب`,
                    `Order #${orderId} confirmed automatically by staff WhatsApp reply`,
                    `order_view.php?id=${orderId}`
                ]
            );
        } catch (nErr) {}

        return true;
    } catch (e) {
        console.error('[DB] confirmOrderByStaff error:', e.message);
        return false;
    }
}

/**
 * Get order by ID
 */
async function getOrderById(orderId) {
    try {
        const rows = await query(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [orderId]);
        return rows[0] || null;
    } catch (e) {
        return null;
    }
}

/**
 * Update store settings
 */
async function updateSettings(settingsObj) {
    try {
        for (const [k, v] of Object.entries(settingsObj)) {
            await query(
                `INSERT INTO settings (setting_key, setting_value_ar, setting_value_en) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE setting_value_ar = ?, setting_value_en = ?`,
                [k, v, v, v, v]
            );
        }
        return true;
    } catch (e) {
        console.error('[DB] updateSettings error:', e.message);
        throw e;
    }
}

const createOutboxApi = require('./outbox');

module.exports = {
    getPool,
    query,
    getSettings,
    getOrderById,
    findLatestOrderByPhone,
    findLatestPendingOrder,
    findOrderByNumber,
    updateOrderConfirmation,
    saveOrderReceipt,
    saveOrderPaymentReference,
    confirmOrderByStaff,
    cancelOrder,
    getRecentReceipts,
    updateSettings,
    ...createOutboxApi(query)
};

