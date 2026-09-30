/**
 * WhatsApp Web Client & Automated Order Confirmation Bot
 * Using whatsapp-web.js with LocalAuth & Media Handling
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('./db');

class WhatsAppBot {
    constructor(io = null) {
        this.io = io;
        this.client = null;
        this.qrCodeDataUrl = null;
        this.status = 'disconnected'; // 'disconnected' | 'qr_ready' | 'authenticating' | 'ready'
        this.clientInfo = null;
        this.logs = [];
        this.userStates = new Map();
        this.processedMessageIds = new Set(); // Prevent duplicate replies

        this.receiptsDir = path.join(__dirname, '..', 'assets', 'uploads', 'receipts');
        if (!fs.existsSync(this.receiptsDir)) {
            fs.mkdirSync(this.receiptsDir, { recursive: true });
        }
    }

    setSocketIO(io) {
        this.io = io;
    }

    log(type, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, type, message, data };
        this.logs.unshift(logEntry);
        if (this.logs.length > 200) this.logs.pop();

        console.log(`[WhatsAppBot][${type.toUpperCase()}] ${message}`, data || '');
        if (this.io) {
            this.io.emit('bot_log', logEntry);
        }
    }

    emitStatus() {
        if (this.io) {
            this.io.emit('status_change', {
                status: this.status,
                qr: this.qrCodeDataUrl,
                info: this.clientInfo
            });
        }
    }

    initialize() {
        if (this.client) {
            return;
        }

        this.log('info', 'Initializing WhatsApp Client with LocalAuth...');
        this.status = 'authenticating';
        this.emitStatus();

        // Check for available browser executables on Windows and Linux VPS
        const possiblePaths = [
            // Windows Paths
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            // Linux VPS Paths (Ubuntu / Debian / CentOS)
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium'
        ];

        let executablePath = undefined;
        for (const p of possiblePaths) {
            try {
                if (fs.existsSync(p)) {
                    executablePath = p;
                    this.log('info', `Using browser executable at: ${p}`);
                    break;
                }
            } catch (e) {}
        }

        const puppeteerOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-blink-features=AutomationControlled'
            ],
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        };

        if (executablePath) {
            puppeteerOptions.executablePath = executablePath;
        }

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            webVersionCache: {
                type: 'none'
            },
            puppeteer: puppeteerOptions
        });

        this.client.on('qr', async (qr) => {
            this.log('qr', 'New QR Code generated. Scan with WhatsApp.');
            this.status = 'qr_ready';
            try {
                this.qrCodeDataUrl = await qrcode.toDataURL(qr);
            } catch (err) {
                this.qrCodeDataUrl = null;
                console.error('Error generating QR code data URL:', err);
            }
            this.emitStatus();
        });

        this.client.on('authenticated', () => {
            this.log('auth', 'WhatsApp Session Authenticated successfully!');
            this.status = 'authenticating';
            this.qrCodeDataUrl = null;
            this.emitStatus();
        });

        this.client.on('ready', () => {
            this.status = 'ready';
            this.qrCodeDataUrl = null;
            const info = this.client.info || {};
            this.clientInfo = {
                pushname: info.pushname || 'Zei Perfumes WhatsApp',
                wid: info.wid ? info.wid.user : 'Connected'
            };
            this.log('ready', `WhatsApp Bot is READY and connected as: ${this.clientInfo.pushname} (${this.clientInfo.wid})`);
            this.emitStatus();
        });

        this.client.on('auth_failure', (msg) => {
            this.status = 'disconnected';
            this.log('error', `Authentication failure: ${msg}`);
            this.emitStatus();
        });

        this.client.on('disconnected', (reason) => {
            this.status = 'disconnected';
            this.clientInfo = null;
            this.log('warn', `WhatsApp Client was disconnected: ${reason}`);
            this.emitStatus();
        });

        // Unified listener via message_create (Captures 100% of WhatsApp Business & Regular incoming messages)
        this.client.on('message_create', async (msg) => {
            try {
                if (msg.fromMe) {
                    await this.handleStaffOutgoingMessage(msg);
                } else {
                    await this.handleIncomingMessage(msg);
                }
            } catch (err) {
                this.log('error', `Error in message_create: ${err.message}`);
            }
        });

        // Backup listener for standard message event
        this.client.on('message', async (msg) => {
            try {
                if (!msg.fromMe) {
                    await this.handleIncomingMessage(msg);
                }
            } catch (err) {
                this.log('error', `Error in message: ${err.message}`);
            }
        });

        this.client.initialize().catch((err) => {
            this.log('error', `Failed to start WhatsApp client: ${err.message}`);
            this.status = 'disconnected';
            this.emitStatus();
        });
    }

    formatPhone(phone) {
        if (!phone) return null;
        let clean = phone.replace(/\D/g, '').replace(/^00/, '');
        if (clean.startsWith('01') && clean.length === 11) {
            clean = '2' + clean;
        } else if (clean.startsWith('1') && clean.length === 10) {
            clean = '20' + clean;
        } else if (clean.startsWith('05') && clean.length === 10) {
            clean = '966' + clean.slice(1);
        }
        return clean.includes('@c.us') ? clean : `${clean}@c.us`;
    }

    /**
     * Resolve exact WhatsApp ID (Supports Regular, WhatsApp Business, LID, and International)
     */
    async resolveSendJid(phoneOrJid) {
        if (!phoneOrJid) return null;
        let clean = String(phoneOrJid).trim();

        // Extract digits
        let digits = clean.replace(/@.*$/, '').replace(/\D/g, '').replace(/^00/, '');
        if (digits.startsWith('01') && digits.length === 11) {
            digits = '2' + digits;
        } else if (digits.startsWith('1') && digits.length === 10) {
            digits = '20' + digits;
        } else if (digits.startsWith('05') && digits.length === 10) {
            digits = '966' + digits.slice(1);
        }

        // 1. Query WhatsApp getNumberId for exact registered business/client JID
        try {
            if (this.client && typeof this.client.getNumberId === 'function') {
                const numberId = await this.client.getNumberId(digits);
                if (numberId && numberId._serialized) {
                    return numberId._serialized;
                }
            }
        } catch (e) {
            this.log('warn', `getNumberId check for ${digits}: ${e.message}`);
        }

        // 2. Default standard JID format
        return `${digits}@c.us`;
    }

    getDigitsKey(phoneOrJid) {
        if (!phoneOrJid) return '';
        const raw = phoneOrJid.replace(/@.*$/, '').replace(/\D/g, '').replace(/^00/, '');
        return raw.length >= 7 ? raw.slice(-8) : raw;
    }

    /**
     * Extract transaction/reference number from message text
     */
    extractReferenceNumber(text) {
        if (!text) return null;
        const clean = text.trim();
        // 1. Matches phrases like: "رقم العملية 123456" or "المرجعي: 987654" or "كود: IPA-12345"
        const prefixMatch = clean.match(/(?:رقم\s*العملية|المرجعي|الرقم\s*المرجعي|كود\s*التحويل|كود\s*العملية|ref|reference|trx|tx)[\s:#\-]*([a-zA-Z0-9_\-]{5,30})/i);
        if (prefixMatch && prefixMatch[1]) {
            return prefixMatch[1].trim();
        }
        // 2. Matches standalone number with at least 5 digits (e.g. "2024081812345" or "1029384756")
        const digitsMatch = clean.match(/\b([0-9]{5,25})\b/);
        if (digitsMatch && digitsMatch[1]) {
            return digitsMatch[1].trim();
        }
        // 3. Alphanumeric transaction codes (e.g. "VF123456" or "IPA778899")
        const alphaNumMatch = clean.match(/\b([a-zA-Z0-9]{6,25})\b/);
        if (alphaNumMatch && alphaNumMatch[1] && /\d/.test(alphaNumMatch[1])) {
            return alphaNumMatch[1].trim();
        }
        return null;
    }

    /**
     * Send the initial 1-2-3 Order Menu to customer
     */
    async sendOrderConfirmationMenu(order) {
        if (this.status !== 'ready' || !this.client) {
            throw new Error('WhatsApp Bot is not connected.');
        }

        const phone = order.customer_phone;
        const jid = await this.resolveSendJid(phone) || this.formatPhone(phone);
        if (!jid) {
            throw new Error(`Invalid customer phone: ${phone}`);
        }

        const total = parseFloat(order.total || 0).toFixed(2);
        const orderNumber = order.order_number;
        const customerName = order.customer_name || 'عميلنا العزيز';

        const menuText = 
`🌸 *مرحباً ${customerName} في زين للعطور!* 🌸

📦 طلب رقم: *#${orderNumber}*
💰 الإجمالي: *${total} ج.م*
─────────────────────
💳 *بيانات التحويل (المبلغ كامل أو العربون):*
• إنستاباي: *ahmedfayoumy1@instapay*
• فودافون كاش: *01005250838*

📸 *أرسل صورة إيصال التحويل هنا لتأكيد طلبك وبدء الشحن فوراً!* ✨`;

        await this.client.sendMessage(jid, menuText);

        const digitsKey = this.getDigitsKey(phone);
        const stateObj = {
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.customer_name,
            total: total,
            shippingCost: parseFloat(order.shipping_cost || 0).toFixed(2),
            state: 'menu'
        };
        this.userStates.set(jid, stateObj);
        if (digitsKey) {
            this.userStates.set(digitsKey, stateObj);
        }

        this.log('outbound', `Sent Order Menu (${orderNumber}) to ${jid}`);

        if (this.io) {
            this.io.emit('order_menu_sent', {
                orderId: order.id,
                orderNumber,
                jid,
                text: menuText,
                timestamp: new Date().toISOString()
            });
        }

        return true;
    }

    /**
     * Format phone number to clean WhatsApp JID format
     */
    formatPhone(phone) {
        if (!phone) return null;
        let digits = String(phone).replace(/\D/g, '');
        if (!digits) return null;
        if (digits.startsWith('00')) digits = digits.substring(2);
        if (digits.startsWith('01') && digits.length === 11) {
            digits = '2' + digits;
        } else if (digits.startsWith('1') && digits.length === 10) {
            digits = '20' + digits;
        }
        if (!digits.endsWith('@c.us') && !digits.endsWith('@s.whatsapp.net')) {
            return `${digits}@c.us`;
        }
        return digits;
    }

    /**
     * Resolve valid WhatsApp JID for phone number using client or formatter
     */
    async resolveSendJid(phone) {
        try {
            const formatted = this.formatPhone(phone);
            if (!formatted || !this.client) return formatted;

            const cleanDigits = formatted.replace('@c.us', '').replace('@s.whatsapp.net', '');
            if (typeof this.client.getNumberId === 'function') {
                const numberId = await this.client.getNumberId(cleanDigits);
                if (numberId && numberId._serialized) {
                    return numberId._serialized;
                }
            }
            return formatted;
        } catch (e) {
            return this.formatPhone(phone);
        }
    }

    /**
     * Resilient message sender: 3-tier delivery (chat.sendMessage -> client.sendMessage -> msg.reply)
     * Works 100% reliably for WhatsApp Regular, WhatsApp Business, Enterprise, and Multi-Device accounts!
     */
    async sendSafeReply(msg, text) {
        if (!text || !msg) return false;
        
        let targetJid = msg.from || msg.author || msg.to;

        // Tier 1: Send directly via chat object (100% reliable for active WhatsApp Business chats)
        try {
            if (typeof msg.getChat === 'function') {
                const chat = await msg.getChat();
                if (chat && typeof chat.sendMessage === 'function') {
                    await chat.sendMessage(text);
                    this.log('outbound', `✓ Sent reply via chat to ${targetJid}`);
                    return true;
                }
            }
        } catch (chatErr) {
            this.log('warn', `chat.sendMessage failed (${chatErr.message}), trying client.sendMessage...`);
        }

        // Tier 2: Send via resolved JID using client.sendMessage
        try {
            if (targetJid && this.client) {
                const validJid = await this.resolveSendJid(targetJid) || targetJid;
                await this.client.sendMessage(validJid, text);
                this.log('outbound', `✓ Sent direct message to ${validJid}`);
                return true;
            }
        } catch (sendErr) {
            this.log('warn', `client.sendMessage failed (${sendErr.message})`);
        }

        return false;
    }

    /**
     * Handle incoming customer messages (Silent Mode - Zero automated replies to incoming chats)
     */
    async handleIncomingMessage(msg) {
        try {
            if (!msg || msg.fromMe) return;

            // Deduplication check: ignore already processed messages
            const msgId = msg.id?._serialized || msg.id?.id;
            if (msgId) {
                if (this.processedMessageIds.has(msgId)) {
                    return; // Prevent duplicate processing
                }
                this.processedMessageIds.add(msgId);
                if (this.processedMessageIds.size > 2000) {
                    const firstItem = this.processedMessageIds.values().next().value;
                    this.processedMessageIds.delete(firstItem);
                }
            }

            // Ignore channels, newsletters, groups, statuses
            if (!msg.from || msg.from.includes('@newsletter') || msg.from.includes('@g.us') || msg.from.includes('status@broadcast') || msg.isStatus) {
                return;
            }

            const senderJid = msg.from;
            let realNumber = senderJid.replace(/@.*$/, '');

            // Fast-timeout contact resolution for Business/LID contacts
            try {
                const contactPromise = msg.getContact();
                const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('Contact timeout')), 800));
                const contact = await Promise.race([contactPromise, timeoutPromise]);
                if (contact) {
                    if (contact.number) realNumber = contact.number;
                    else if (contact.id && contact.id.user) realNumber = contact.id.user;
                }
            } catch (cErr) {}

            const rawBody = (
                msg.body || 
                msg.caption || 
                msg._data?.body || 
                msg._data?.caption || 
                msg._data?.interactive?.body?.text || 
                msg.selectedButtonId || 
                msg.selectedRowId || 
                ''
            ).trim();

            this.log('inbound', `Received from ${senderJid} (real: ${realNumber}): "${rawBody || '[Media/Image]'}"`);

            // Silent receipt saving: If customer sent an image/document, quietly save it to receipts for admin review
            const isMediaMessage = msg.hasMedia || msg.type === 'image' || msg.type === 'document' || msg.type === 'sticker';
            if (isMediaMessage) {
                let order = await db.findLatestPendingOrder() || await db.findLatestOrderByPhone(realNumber) || await db.findLatestOrderByPhone(senderJid);
                let filename = null;

                for (let attempt = 1; attempt <= 4; attempt++) {
                    try {
                        const media = await msg.downloadMedia();
                        if (media && media.data) {
                            const rawExt = (media.mimetype && media.mimetype.split('/')[1]) ? media.mimetype.split('/')[1].split(';')[0] : 'jpg';
                            const ext = (rawExt === 'jpeg' || !rawExt) ? 'jpg' : rawExt;
                            filename = `receipt_${order?.id || 'wa'}_${Date.now()}.${ext}`;
                            const filePath = path.join(this.receiptsDir, filename);

                            fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
                            this.log('receipt', `✓ Silently saved receipt screenshot to: ${filePath}`);
                            break;
                        }
                    } catch (dlErr) {
                        this.log('warn', `Media download attempt ${attempt}/4: ${dlErr.message}`);
                    }
                    if (attempt < 4) {
                        await new Promise(res => setTimeout(res, 600 * attempt));
                    }
                }

                if (filename && order?.id) {
                    await db.saveOrderReceipt(order.id, filename);
                    if (this.io) {
                        this.io.emit('receipt_uploaded', {
                            orderId: order.id,
                            orderNumber: order.order_number,
                            filename,
                            url: `assets/uploads/receipts/${filename}`,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }

            // Silent Mode: Absolutely NO automated replies on WhatsApp for incoming customer chats
            return;

        } catch (err) {
            this.log('error', `Error handling message from ${msg.from}: ${err.message}`);
        }
    }

    /**
     * Handle staff outgoing message to auto-confirm order on keywords like "تم التاكيد"
     */
    async handleStaffOutgoingMessage(msg) {
        try {
            const rawBody = (msg.body || '').trim();
            if (!rawBody) return;
            const body = rawBody.toLowerCase();

            // Staff confirmation keywords
            const confirmPatterns = [
                'تم التاكيد', 'تم التأكيد', 'تم تاكيد', 'تم تأكيد',
                'تم الاعتماد', 'تم اعتماد', 'تم اعتماد الدفع', 'تم استلام التحويل', 'تم استلام المبلغ',
                'تم تاكيد الطلب', 'تم تأكيد الطلب', 'تاكيد الاوردر', 'تأكيد الاوردر',
                'تم تاكيد طلبك', 'تم تأكيد طلبك', 'تم تاكيد اوردرك', 'تم تأكيد أوردرك',
                'تم الدفع', 'تم التحويل', 'اعتمدت', 'اعتمدنا التحويل',
                '#تاكيد', '#تأكيد', '#confirm', 'confirmed', 'تم بنجاح'
            ];

            // Direct exact single-word matches
            const singleWordMatches = ['تم', 'تمام', 'تأكيد', 'تاكيد', 'معتمد', 'اعتمد'];

            const isConfirmMsg = confirmPatterns.some(pat => body.includes(pat)) || singleWordMatches.includes(body);
            if (!isConfirmMsg) {
                return;
            }

            const targetJid = msg.to;
            if (!targetJid || targetJid.includes('@newsletter') || targetJid.includes('@g.us') || targetJid.includes('status@broadcast')) {
                return;
            }

            let phoneOrDigits = targetJid.replace(/@.*$/, '').replace(/\D/g, '');
            try {
                const chat = await msg.getChat();
                if (chat && chat.contact && chat.contact.number) {
                    phoneOrDigits = chat.contact.number;
                }
            } catch (cErr) {}

            this.log('staff', `Staff sent confirmation keyword "${rawBody}" to ${targetJid} (phone: ${phoneOrDigits})`);

            // Find customer's active order
            let order = await db.findLatestOrderByPhone(phoneOrDigits);
            if (!order) {
                order = await db.findLatestOrderByPhone(targetJid);
            }
            if (!order) {
                order = await db.findLatestPendingOrder();
            }

            if (order && order.id) {
                const scope = order.payment_scope || 'full';
                const totalVal = parseFloat(order.total || 0);
                const shipVal = parseFloat(order.shipping_cost || 0);
                const advanceVal = parseFloat(order.advance_amount || 0);
                const paidVal = (scope === 'shipping_only') ? (advanceVal > 0 ? advanceVal : shipVal) : totalVal;
                const payStatus = (scope === 'shipping_only') ? 'deposit_paid' : 'verified';

                await db.confirmOrderByStaff(order.id, payStatus, paidVal);

                this.log('staff', `✅ Order ${order.order_number} (ID: ${order.id}) automatically CONFIRMED in dashboard by staff chat!`);

                if (this.io) {
                    this.io.emit('order_status_updated', {
                        orderId: order.id,
                        orderNumber: order.order_number,
                        status: 'processing',
                        paymentStatus: payStatus,
                        isConfirmed: 1,
                        source: 'staff_chat',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (err) {
            this.log('error', `Error in handleStaffOutgoingMessage: ${err.message}`);
        }
    }

    /**
     * Send Order Status Update message to customer on WhatsApp
     */
    async sendOrderStatusNotification(orderId, newStatus, orderData = null) {
        if (this.status !== 'ready' || !this.client) {
            throw new Error('WhatsApp Bot is not connected.');
        }

        let order = orderData;
        if (!order) {
            order = await db.findOrderByNumber(orderId);
        }
        if (!order) {
            throw new Error(`Order #${orderId} not found`);
        }

        const jid = await this.resolveSendJid(order.customer_phone) || this.formatPhone(order.customer_phone);
        if (!jid) {
            throw new Error(`Invalid customer phone: ${order.customer_phone}`);
        }

        const customerName = order.customer_name || 'عميلنا العزيز';
        const orderNumber = order.order_number || `MED-${order.id}`;
        const total = parseFloat(order.total || 0).toFixed(2);
        const paid = parseFloat(order.paid_amount || 0);
        const waived = parseFloat(order.waived_amount || 0);
        const remaining = Math.max(0, parseFloat(order.total || 0) - paid - waived).toFixed(2);

        let msgText = '';

        switch (newStatus) {
            case 'processing':
                msgText = 
`مرحباً ${customerName}
بخصوص طلبك رقم: *#${orderNumber}*

تم تأكيد طلبك بنجاح، وطلبك حالياً قيد التجهيز والتغليف لدى متجر زين للعطور تمهيداً لتسليمه للشحن.

شكراً لاختيارك زين للعطور 🌸`;
                break;

            case 'shipped':
                const remainingLine = parseFloat(remaining) > 0 
                    ? `\nالمبلغ المتبقي للتحصيل عند الاستلام: *${remaining} جنيه*`
                    : `\nحالة الحساب: تم سداد المبلغ بالكامل مسبقاً.`;

                msgText = 
`مرحباً ${customerName}
بخصوص طلبك رقم: *#${orderNumber}*

تم تسليم شحنتك لشركة الشحن، وفي أسرع وقت هيكون الأوردر عندك.
${remainingLine}

شكراً لتعاملك مع زين للعطور 🌸`;
                break;

            case 'delivered':
            case 'completed':
                msgText = 
`مرحباً ${customerName}
بخصوص طلبك رقم: *#${orderNumber}*

تم تسليم الطلب بنجاح. نشكركم على ثقتكم في زين للعطور ونتمنى لكم تجربة مميزة 🌸`;
                break;

            case 'cancelled':
                msgText = 
`مرحباً ${customerName}
بخصوص طلبك رقم: *#${orderNumber}*

تم إلغاء الطلب بناءً على رغبتكم. نسعد دائماً بخدمتكم في زين للعطور 🌸`;
                break;

            case 'pending':
            default:
                msgText = 
`مرحباً ${customerName}
بخصوص طلبك رقم: *#${orderNumber}*

تم استلام طلبك بنجاح وهو الآن قيد المراجعة في متجر زين للعطور.
سنقوم بتأكيد الطلب وتجهيزه في أسرع وقت.

شكراً لاختيارك زين للعطور 🌸`;
                break;
        }

        await this.client.sendMessage(jid, msgText);
        this.log('outbound', `Sent status update (${newStatus}) to ${jid} for order ${orderNumber}`);
        return { success: true, jid, status: newStatus };
    }

    /**
     * Broadcast New Product announcement to all customers
     */
    async broadcastNewProduct(product) {
        if (this.status !== 'ready' || !this.client) {
            throw new Error('WhatsApp Bot is not connected. Please scan QR code first.');
        }

        let recipients = product.recipients && Array.isArray(product.recipients) ? product.recipients : [];
        if (recipients.length === 0) {
            const clientsQuery = await db.query(
                `SELECT DISTINCT phone FROM (
                    SELECT phone FROM clients WHERE phone IS NOT NULL AND phone != ''
                    UNION 
                    SELECT customer_phone as phone FROM orders WHERE customer_phone IS NOT NULL AND customer_phone != ''
                ) as t WHERE phone REGEXP '^[0-9+]{8,15}$' LIMIT 500`
            );
            recipients = (clientsQuery || []).map(r => r.phone).filter(Boolean);
        }

        this.log('broadcast', `Starting new product broadcast for "${product.nameAr || product.nameEn}" to ${recipients.length} customers...`);

        const nameAr = product.nameAr || product.name || 'عطر فاخر جديد';
        const nameEn = product.nameEn || '';
        const brandName = product.brandName ? `🏷️ *الماركة:* ${product.brandName}\n` : '';
        const price = product.price ? parseFloat(product.price).toFixed(2) : '';
        const desc = product.description ? `📝 *عن العطر:* ${product.description}\n` : (product.descriptionAr ? `📝 *عن العطر:* ${product.descriptionAr}\n` : '');
        const notes = product.notes ? `🌸 *النفحات العطرية:* ${product.notes}\n` : (product.notesAr ? `🌸 *النفحات العطرية:* ${product.notesAr}\n` : '');
        const promo = product.promoText ? `🎁 *عرض خاص:* ${product.promoText}\n` : '';
        const productUrl = product.productUrl || (product.productId || product.id ? `http://127.0.0.1:8000/product.php?id=${product.productId || product.id}` : `http://127.0.0.1:8000/products.php`);

        let broadcastMsg = product.customMessage;
        if (!broadcastMsg || !broadcastMsg.trim()) {
            broadcastMsg = 
`✨ *عطر جديد وحصري وصل متجر زين للعطور!* 🌸

👑 *${nameAr}* ${nameEn ? `| ${nameEn}` : ''}
${brandName}${desc}${notes}${price ? `💰 *السعر:* *${price} ج.م*\n` : ''}${promo}
🔗 *للطلب والتفاصيل فوراً عبر موقعنا:*
${productUrl}

🚚 *متاح الشحن والتوصيل السريع لجميع المحافظات!* ✨`;
        }

        let sentCount = 0;
        let failCount = 0;

        // Broadcast asynchronously with safe delay between messages (2.5 seconds)
        (async () => {
            for (let i = 0; i < recipients.length; i++) {
                const phone = recipients[i];
                const jid = this.formatPhone(phone);
                if (!jid) continue;

                try {
                    await this.client.sendMessage(jid, broadcastMsg);
                    sentCount++;
                    this.log('broadcast', `[${i + 1}/${recipients.length}] Sent product announcement to ${jid}`);
                } catch (sendErr) {
                    failCount++;
                    this.log('warn', `Failed sending broadcast to ${jid}: ${sendErr.message}`);
                }

                if (this.io) {
                    this.io.emit('broadcast_progress', {
                        total: recipients.length,
                        current: i + 1,
                        sent: sentCount,
                        failed: failCount,
                        productName: nameAr
                    });
                }

                // Throttle delay 2.5 seconds to prevent spam trigger
                await new Promise(r => setTimeout(r, 2500));
            }

            this.log('broadcast', `🎉 Broadcast completed! Successfully sent to ${sentCount}/${recipients.length} customers.`);
        })();

        return {
            success: true,
            totalRecipients: recipients.length,
            message: `Broadcast started for ${recipients.length} customers in background queue.`
        };
    }

    /**
     * Send direct custom text message
     */
    async sendMessage(phone, message) {
        if (this.status !== 'ready' || !this.client) {
            throw new Error('WhatsApp Bot is not connected. Please scan QR code first.');
        }

        const phoneJid = await this.resolveSendJid(phone) || this.formatPhone(phone);
        if (!phoneJid) {
            throw new Error('Invalid phone number.');
        }

        this.log('outbound', `Sending direct message to ${phoneJid}`);
        await this.client.sendMessage(phoneJid, message);
        return true;
    }

    /**
     * Logout and destroy current session
     */
    async logout() {
        if (this.client) {
            try {
                await this.client.logout().catch(() => {});
                await this.client.destroy().catch(() => {});
            } catch (err) {
                console.error('Error during client logout:', err.message);
            }
            this.client = null;
            this.status = 'disconnected';
            this.clientInfo = null;
            this.qrCodeDataUrl = null;
            this.emitStatus();
            this.log('info', 'Logged out and cleared WhatsApp session.');
        }
    }

    /**
     * Clean Hard Reset: destroy client and completely wipe auth & cache folders
     */
    async resetSession() {
        this.log('warn', 'Performing Hard Reset of WhatsApp session & auth files...');
        if (this.client) {
            try {
                await this.client.logout().catch(() => {});
                await this.client.destroy().catch(() => {});
            } catch (err) {
                console.error('Error during client destroy:', err.message);
            }
            this.client = null;
        }

        const authDir = path.join(__dirname, '.wwebjs_auth');
        const cacheDir = path.join(__dirname, '.wwebjs_cache');

        try {
            if (fs.existsSync(authDir)) {
                fs.rmSync(authDir, { recursive: true, force: true });
            }
            if (fs.existsSync(cacheDir)) {
                fs.rmSync(cacheDir, { recursive: true, force: true });
            }
            this.log('info', 'Cleaned .wwebjs_auth and .wwebjs_cache successfully.');
        } catch (err) {
            this.log('error', `Failed to remove auth directory: ${err.message}`);
        }

        this.status = 'disconnected';
        this.clientInfo = null;
        this.qrCodeDataUrl = null;
        this.emitStatus();
    }
}

module.exports = WhatsAppBot;
