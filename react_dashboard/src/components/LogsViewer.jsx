import React from 'react';
import { Terminal, ArrowDownLeft, ArrowUpRight, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';

export default function LogsViewer({ logs = [] }) {
  const getBadge = (type) => {
    switch (type) {
      case 'inbound':
        return <span className="px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded text-[10px] flex items-center gap-1 font-bold"><ArrowDownLeft size={11} /> وارد</span>;
      case 'outbound':
        return <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded text-[10px] flex items-center gap-1 font-bold"><ArrowUpRight size={11} /> صادر</span>;
      case 'receipt':
        return <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded text-[10px] flex items-center gap-1 font-bold">📸 إيصال</span>;
      case 'ready':
      case 'auth':
        return <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded text-[10px] flex items-center gap-1 font-bold"><CheckCircle size={11} /> اتصال</span>;
      case 'error':
        return <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded text-[10px] flex items-center gap-1 font-bold"><AlertCircle size={11} /> خطأ</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">نظام</span>;
    }
  };

  return (
    <div className="luxury-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Terminal size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">سجل أحداث البوت المباشر</h2>
            <p className="text-xs text-slate-400">الرسائل الواردة والردود التلقائية لحظة بلحظة</p>
          </div>
        </div>

        <span className="text-xs text-slate-400">
          عدد الأحداث: <strong className="text-amber-400">{logs.length}</strong>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1" dir="ltr">
        {logs.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500" dir="rtl">
            لا توجد أحداث مسجلة بعد. عند تشغيل البوت واستقبال رسائل ستظهر هنا مباشرة.
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs font-mono flex items-start gap-2.5 hover:border-slate-700 transition"
            >
              <span className="text-[10px] text-slate-500 shrink-0 pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <div className="shrink-0">{getBadge(log.type)}</div>
              <div className="text-slate-300 break-all flex-1 text-left">
                {log.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
