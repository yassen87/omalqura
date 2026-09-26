import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Bot, CreditCard, Image as ImageIcon, Terminal, ExternalLink, RefreshCw, Inbox } from 'lucide-react';
import QRCodeCard from './components/QRCodeCard';
import SettingsCard from './components/SettingsCard';
import ReceiptsGallery from './components/ReceiptsGallery';
import LogsViewer from './components/LogsViewer';
import TestSender from './components/TestSender';
import OutboxQueue from './components/OutboxQueue';

const SOCKET_SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

export default function App() {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'receipts' | 'settings' | 'logs' | 'outbox'
  const [outboxJobs, setOutboxJobs] = useState([]);
  const [stats, setStats] = useState({
    confirmed: 0,
    cancelled: 0,
    awaiting: 0,
    receiptsCount: 0
  });

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [statusRes, settingsRes, receiptsRes, outboxRes] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/receipts').then(r => r.json()),
        fetch('/api/outbox').then(r => r.json()).catch(() => ({ success: false }))
      ]);

      if (statusRes.success) {
        setStatus(statusRes.status);
        setQr(statusRes.qr);
        setClientInfo(statusRes.info);
      }
      if (settingsRes.success) {
        setSettings(settingsRes.settings);
      }
      if (receiptsRes.success) {
        setReceipts(receiptsRes.receipts || []);
      }
      if (outboxRes.success) {
        setOutboxJobs(outboxRes.jobs || []);
      }
    } catch (err) {
      console.warn('API error (falling back to Socket):', err.message);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket.io real-time connection
    const newSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to WhatsApp WebSocket server');
    });

    newSocket.on('status_change', (data) => {
      setStatus(data.status);
      setQr(data.qr);
      setClientInfo(data.info);
    });

    newSocket.on('initial_logs', (initialLogs) => {
      setLogs(initialLogs || []);
    });

    newSocket.on('bot_log', (log) => {
      setLogs(prev => [log, ...prev.slice(0, 199)]);
    });

    newSocket.on('receipt_uploaded', (newReceipt) => {
      setReceipts(prev => [newReceipt, ...prev]);
    });

    newSocket.on('outbox_update', () => {
      fetch('/api/outbox').then(r => r.json()).then((res) => {
        if (res.success) setOutboxJobs(res.jobs || []);
      }).catch(() => {});
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleInit = async () => {
    await fetch('/api/init', { method: 'POST' });
  };

  const handleReset = async () => {
    await fetch('/api/reset', { method: 'POST' });
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
  };

  const handleSaveSettings = async (newSettings) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    }).then(r => r.json());
    if (!res.success) throw new Error(res.error || 'Failed to save');
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleRetryOutbox = async (id) => {
    await fetch(`/api/outbox/${id}/retry`, { method: 'POST' });
    const res = await fetch('/api/outbox').then(r => r.json());
    if (res.success) setOutboxJobs(res.jobs || []);
  };

  const handleSendTest = async (phone, message) => {
    const res = await fetch('/api/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    }).then(r => r.json());
    if (!res.success) throw new Error(res.error || 'Failed to send test message');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
                <Bot size={22} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight gold-gradient-text">
                  متجر زين للعطور
                </h1>
                <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {typeof window !== 'undefined' && window.zeiDesktop?.isElectron ? 'تطبيق سطح المكتب' : 'WhatsApp Dash'}
                </span>
              </div>
              <p className="text-xs text-slate-400">لوحة تحكم تأكيد الطلبات الآلي وإيصالات انستاباي</p>
            </div>
          </div>

          {/* Nav & External link */}
          <div className="flex items-center gap-3">
            <a
              href="/admin/orders.php"
              className="secondary-btn text-xs hidden sm:inline-flex"
              target="_blank"
              rel="noreferrer"
            >
              <span>لوحة إدارة المتجر</span>
              <ExternalLink size={13} />
            </a>

            <button
              onClick={fetchData}
              title="تحديث البيانات"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Bot size={16} />
            <span>نظرة عامة والربط</span>
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'receipts'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ImageIcon size={16} />
            <span>معرض الإيصالات ({receipts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CreditCard size={16} />
            <span>إعدادات انستاباي والدفع</span>
          </button>

          <button
            onClick={() => setActiveTab('outbox')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'outbox'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Inbox size={16} />
            <span>صف الموقع ({outboxJobs.filter(j => j.status !== 'sent').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Terminal size={16} />
            <span>سجل المحادثات المباشر ({logs.length})</span>
          </button>
        </div>

        {/* Tab 1: Overview & QR */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Flow Info Banner */}
            <div className="luxury-card p-5 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/20">
              <h3 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-2">
                <span>⚡ سيناريو التأكيد الآلي التفاعلي المفعّل على المتجر:</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="font-bold text-amber-400 block mb-1">1️⃣ - تأكيد الطلب:</span>
                  <p className="text-slate-400">يسأل العميل عن وسيلة الدفع (انستاباي / كاش) ويطلب إرفاق صورة إيصال التحويل.</p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="font-bold text-red-400 block mb-1">2️⃣ - إلغاء الطلب:</span>
                  <p className="text-slate-400">يقوم البوت بإلغاء الطلب فوراً في قاعدة بيانات المتجر وتحديث المخزون.</p>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <span className="font-bold text-blue-400 block mb-1">3️⃣ - تعديل الطلب:</span>
                  <p className="text-slate-400">يرسل للعميل رابط مباشر للموقع لتعديل المنتجات والعنوان.</p>
                </div>
              </div>
            </div>

            {/* Grid Row: QR Code + Test Sender */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7">
                <QRCodeCard
                  status={status}
                  qr={qr}
                  info={clientInfo}
                  onInit={handleInit}
                  onReset={handleReset}
                  onLogout={handleLogout}
                />
              </div>

              <div className="lg:col-span-5">
                <TestSender
                  onSendTest={handleSendTest}
                  isConnected={status === 'ready'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <OutboxQueue jobs={outboxJobs.slice(0, 8)} onRetry={handleRetryOutbox} />
              <LogsViewer logs={logs.slice(0, 15)} />
            </div>
          </div>
        )}

        {/* Tab 2: Receipts Gallery */}
        {activeTab === 'receipts' && (
          <ReceiptsGallery receipts={receipts} />
        )}

        {/* Tab 3: Payment Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto">
            <SettingsCard
              initialSettings={settings}
              onSave={handleSaveSettings}
            />
          </div>
        )}

        {activeTab === 'outbox' && (
          <OutboxQueue jobs={outboxJobs} onRetry={handleRetryOutbox} />
        )}

        {/* Tab 4: Logs */}
        {activeTab === 'logs' && (
          <LogsViewer logs={logs} />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        متجر زين للعطور © 2026 - نظام الربط الذكي مع واتساب ويب وتأكيد الدفع الإلكتروني
      </footer>
    </div>
  );
}
