import React, { useState } from 'react';
import { QrCode, RefreshCw, Power, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';

export default function QRCodeCard({ status, qr, info, onInit, onReset, onLogout }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionFn) => {
    setLoading(true);
    try {
      await actionFn();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  };

  const isConnected = status === 'ready';
  const isQrReady = status === 'qr_ready' && qr;
  const isAuthenticating = status === 'authenticating';

  return (
    <div className="luxury-card p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <QrCode size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">ربط واتساب المتجر</h2>
              <p className="text-xs text-slate-400">امسح الكود لربط رقم خدمة العملاء والتأكيد الآلي</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="badge-connected px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                متصل وجاهز
              </span>
            ) : isQrReady ? (
              <span className="badge-connecting px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                بانتظار المسح
              </span>
            ) : isAuthenticating ? (
              <span className="badge-connecting px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                جاري التحقق...
              </span>
            ) : (
              <span className="badge-disconnected px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                غير متصل
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-col items-center justify-center my-4 min-h-[280px]">
          {isConnected ? (
            <div className="text-center py-6 px-4 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl w-full">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                <CheckCircle size={36} />
              </div>
              <h3 className="text-xl font-bold text-emerald-300 mb-1">
                البوت متصل بنجاح!
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                الحساب المرتبط: <strong className="text-amber-400">{info?.pushname || 'متجر زين للعطور'}</strong> ({info?.wid || 'Online'})
              </p>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-xs text-slate-400 max-w-sm mx-auto">
                ⚡ البوت يستمع الآن تلقائياً لتأكيدات الطلبات (1- تأكيد، 2- إلغاء، 3- تعديل) ويستقبل صور إيصالات التحويل.
              </div>
            </div>
          ) : isQrReady ? (
            <div className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-amber-500/30 mb-3 relative">
                <img src={qr} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium mb-2">
                <Smartphone size={16} />
                <span>افتح واتساب &gt; الأجهزة المرتبطة &gt; ربط جهاز &gt; امسح الكود مباشرة</span>
              </div>
              <p className="text-[11px] text-slate-400 text-center max-w-xs">
                ⚠️ إذا ظهر لك Try Again على الهاتف: اضغط زر "إعادة تهيئة الجلسة (Hard Reset)" بالأسفل لمسح الكاش وتوليد كود نظيف.
              </p>
            </div>
          ) : isAuthenticating ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-amber-400 mx-auto mb-4" size={40} />
              <p className="text-sm font-semibold text-slate-200">جاري بدء جلسة الواتساب وتجهيز الـ QR Code...</p>
              <p className="text-xs text-slate-500 mt-1">يستغرق الأمر بضع ثوانٍ</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20">
                <AlertTriangle size={28} />
              </div>
              <h4 className="text-slate-200 font-bold mb-1">البوت غير متصل حالياً</h4>
              <p className="text-xs text-slate-400 mb-5 max-w-xs mx-auto">
                اضغط على زر تشغيل البوت لتوليد رمز الاستجابة السريعة (QR Code) وربط رقم واتساب المتجر.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => handleAction(onInit)}
                  disabled={loading}
                  className="gold-btn"
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                  تشغيل وتوليد الـ QR Code
                </button>
                {onReset && (
                  <button
                    onClick={() => {
                      if (window.confirm('هل تريد تنظيف أي جلسة سابقة وبدء جلسة جديدة نظيفة؟')) {
                        handleAction(onReset);
                      }
                    }}
                    disabled={loading}
                    className="secondary-btn text-xs"
                  >
                    🔄 مسح الكاش وبدء جلسة جديدة
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction(onInit)}
            disabled={loading}
            className="secondary-btn text-xs"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تحديث / تشغيل
          </button>

          {onReset && !isConnected && (
            <button
              onClick={() => {
                if (window.confirm('سيتم حذف ملفات الجلسة المؤقتة .wwebjs_auth وتوليد QR جديد نظيف. متابعة؟')) {
                  handleAction(onReset);
                }
              }}
              disabled={loading}
              className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              🔄 إعادة تهيئة الجلسة (Hard Reset)
            </button>
          )}
        </div>

        {isConnected && (
          <button
            onClick={() => {
              if (window.confirm('هل أنت متأكد من تسجيل الخروج وفصل جلسة الواتساب؟')) {
                handleAction(onLogout);
              }
            }}
            disabled={loading}
            className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Power size={15} />
            فصل الجلسة
          </button>
        )}
      </div>
    </div>
  );
}
