/**
 * Express & Socket.io Server for WhatsApp Bot & React Dashboard
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const WhatsAppBot = require('./bot');
const db = require('./db');
const { startOutboxPoller } = require('./outboxPoller');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets and receipts statically
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/assets/uploads/receipts', express.static(path.join(__dirname, '..', 'assets', 'uploads', 'receipts')));

// Receipts Upload configuration
const receiptsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '..', 'assets', 'uploads', 'receipts');
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const orderId = req.body.order_id || 'manual';
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `receipt_${orderId}_${Date.now()}${ext}`);
    }
});
const uploadReceipt = multer({
    storage: receiptsStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Initialize WhatsApp Bot instance
const bot = new WhatsAppBot(io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);

    // Send immediate status upon connection
    socket.emit('status_change', {
        status: bot.status,
        qr: bot.qrCodeDataUrl,
        info: bot.clientInfo
    });

    socket.emit('initial_logs', bot.logs);

    socket.on('request_qr', () => {
        if (bot.status !== 'ready') {
            bot.initialize();
        }
    });

    socket.on('disconnect', () => {
        console.log('[Socket.io] Client disconnected:', socket.id);
    });
});

// REST API Endpoints

/**
 * GET /api/status - Get current bot status & QR
 */
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: bot.status,
        qr: bot.qrCodeDataUrl,
        info: bot.clientInfo,
        uptime: process.uptime()
    });
});

/**
 * POST /api/init - Initialize or restart bot
 */
app.post('/api/init', (req, res) => {
    bot.initialize();
    res.json({ success: true, message: 'WhatsApp Bot initialization started.' });
});

/**
 * POST /api/logout - Logout & disconnect bot session
 */
app.post('/api/logout', async (req, res) => {
    try {
        await bot.logout();
        res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/reset - Hard reset session, wipe corrupted auth & restart client
 */
app.post('/api/reset', async (req, res) => {
    try {
        await bot.resetSession();
        setTimeout(() => {
            bot.initialize();
        }, 1200);
        res.json({ success: true, message: 'Session reset and restarted successfully. Scan the fresh QR code.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/send-order - Send 1-2-3 Order Menu to customer
 */
app.post('/api/send-order', async (req, res) => {
    try {
        const { order_id, order_number, customer_name, customer_phone, total, shipping_cost, lines } = req.body;

        if (!customer_phone) {
            return res.status(400).json({ success: false, error: 'customer_phone is required.' });
        }

        const orderData = {
            id: order_id,
            order_number: order_number,
            customer_name: customer_name,
            customer_phone: customer_phone,
            total: total,
            shipping_cost: shipping_cost || 0
        };

        if (bot.status !== 'ready') {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bot is not connected. Connect via QR code in the dashboard.',
                status: bot.status
            });
        }

        await bot.sendOrderConfirmationMenu(orderData);
        res.json({ success: true, message: 'Order confirmation menu sent to customer.' });
    } catch (err) {
        console.error('[API send-order error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/send-status-update - Send order status update notification to customer on WhatsApp
 */
app.post('/api/send-status-update', async (req, res) => {
    try {
        const { order_id, status, customer_phone, customer_name, order_number, total, paid_amount, waived_amount } = req.body;
        if (!order_id || !status) {
            return res.status(400).json({ success: false, error: 'order_id and status are required.' });
        }

        if (bot.status !== 'ready') {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bot is not connected.',
                status: bot.status
            });
        }

        let orderData = null;
        if (customer_phone) {
            orderData = {
                id: order_id,
                order_number: order_number || `MED-${order_id}`,
                customer_name: customer_name || 'عميلنا العزيز',
                customer_phone: customer_phone,
                total: total || 0,
                paid_amount: paid_amount || 0,
                waived_amount: waived_amount || 0
            };
        }

        const result = await bot.sendOrderStatusNotification(order_id, status, orderData);
        res.json({ success: true, message: `Status update for order #${order_id} sent successfully.`, result });
    } catch (err) {
        console.error('[API send-status-update error]', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/test-message - Test send a message to any phone number
 */
app.post('/api/test-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Phone and message are required.' });
        }
        await bot.sendMessage(phone, message);
        res.json({ success: true, message: 'Test message sent successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/logs - Retrieve bot activity logs
 */
app.get('/api/logs', (req, res) => {
    res.json({ success: true, logs: bot.logs });
});

/**
 * GET /api/outbox - Jobs queued by the website for WhatsApp delivery
 */
app.get('/api/outbox', async (req, res) => {
    try {
        const rows = await db.listOutbox(50);
        res.json({ success: true, jobs: rows, botStatus: bot.status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/outbox/:id/retry - Re-queue a failed job
 */
app.post('/api/outbox/:id/retry', async (req, res) => {
    try {
        await db.retryOutboxJob(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/settings - Get store payment & bot settings
 */
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await db.getSettings();
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/settings - Update payment & bot settings
 */
app.post('/api/settings', async (req, res) => {
    try {
        const { instapay_username, vodafone_cash_number, bank_account_info } = req.body;
        if (instapay_username !== undefined) {
            await db.query(`UPDATE settings SET setting_value_ar = ?, setting_value_en = ? WHERE setting_key = 'instapay_username'`, [instapay_username, instapay_username]);
        }
        if (vodafone_cash_number !== undefined) {
            await db.query(`UPDATE settings SET setting_value_ar = ?, setting_value_en = ? WHERE setting_key = 'vodafone_cash_number'`, [vodafone_cash_number, vodafone_cash_number]);
        }
        if (bank_account_info !== undefined) {
            await db.query(`UPDATE settings SET setting_value_ar = ?, setting_value_en = ? WHERE setting_key = 'bank_account_info'`, [bank_account_info, bank_account_info]);
        }
        res.json({ success: true, message: 'Settings updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/receipts - Get recent receipts with order info
 */
app.get('/api/receipts', async (req, res) => {
    try {
        const rows = await db.query(
            `SELECT id, order_number, customer_name, customer_phone, total, payment_method, payment_receipt, payment_status, is_confirmed, confirmed_at, created_at
             FROM orders 
             WHERE payment_receipt IS NOT NULL AND payment_receipt != '' 
             ORDER BY id DESC LIMIT 50`
        );
        res.json({ success: true, receipts: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/broadcast-product - Broadcast new product announcement to all customers
 */
app.post('/api/broadcast-product', async (req, res) => {
    try {
        const product = req.body;
        if (!product || (!product.nameAr && !product.nameEn)) {
            return res.status(400).json({ success: false, error: 'Product data (name) is required.' });
        }
        const result = await bot.broadcastNewProduct(product);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[API] /api/broadcast-product error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/fintech-event - Receive live payment sync event from API
 */
app.post('/api/fintech-event', (req, res) => {
    try {
        const eventData = req.body;
        if (io) {
            io.emit('fintech_transaction_received', eventData);
        }
        res.json({ success: true, message: 'Event broadcasted to connected clients.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Serve React Dashboard build if exists
const reactBuildPath = path.join(__dirname, 'react_dashboard', 'dist');
if (fs.existsSync(reactBuildPath)) {
    app.use(express.static(reactBuildPath));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(reactBuildPath, 'index.html'));
    });
} else {
    // Serve fallback static landing page for dashboard
    app.use(express.static(path.join(__dirname, 'public')));
}

function startServer() {
    return new Promise((resolve) => {
        if (server.listening) {
            resolve(PORT);
            return;
        }
        bot.initialize();
        startOutboxPoller(bot, db, io, 4000);
        server.listen(PORT, () => {
            console.log(`=================================================`);
            console.log(`Zei Perfumes WhatsApp desktop API on http://127.0.0.1:${PORT}`);
            console.log(`=================================================`);
            resolve(PORT);
        });
    });
}

if (require.main === module) {
    startServer();
}

module.exports = { app, server, io, bot, startServer, PORT };
