import React from 'react';
import { Inbox, RotateCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';

const typeLabel = {
  status_update: 'تحديث حالة طلب',
  order_menu: 'قائمة تأكيد الطلب',
  custom_message: 'رسالة مخصصة',
  broadcast_product: 'إعلان منتج'
};

const statusStyle = {
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  processing: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  sent: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  failed: 'text-rose-300 bg-rose-500/10 border-rose-500/20'
};

export default function OutboxQueue({ jobs = [], onRetry }) {
  return (
    <div className="luxury-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-sm flex items-center gap-2 text-amber-300">
            <Inbox size={16} />
            صف رسائل الموقع
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            أي تغيير حالة أوردر من لوحة المتجر يظهر هنا ويتبعت واتساب تلقائيًا بعد مسح الـ QR.
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-slate-700 text-slate-400">
          {jobs.length} عملية
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
          مفيش رسائل في الانتظار. غيّر حالة أوردر من الموقع وهيظهر هنا.
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle[job.status] || statusStyle.pending}`}>
                    {job.status}
                  </span>
                  <span className="text-xs font-bold text-slate-200">
                    {typeLabel[job.job_type] || job.job_type}
                  </span>
                  {job.order_id ? (
                    <span className="text-[11px] text-slate-500">طلب #{job.order_id}</span>
                  ) : null}
                </div>
                {job.last_error ? (
                  <p className="text-[11px] text-rose-400 mt-1 truncate">{job.last_error}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {job.created_at} · محاولات {job.attempts}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {job.status === 'sent' && <CheckCircle2 size={16} className="text-emerald-400" />}
                {job.status === 'failed' && <XCircle size={16} className="text-rose-400" />}
                {(job.status === 'pending' || job.status === 'processing') && <Clock size={16} className="text-amber-400" />}
                {job.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onRetry(job.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="إعادة المحاولة"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
