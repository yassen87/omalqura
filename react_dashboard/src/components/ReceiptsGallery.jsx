import React, { useState } from 'react';
import { Image as ImageIcon, ExternalLink, User, Phone, DollarSign, Calendar, X, ZoomIn } from 'lucide-react';

export default function ReceiptsGallery({ receipts = [] }) {
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  return (
    <div className="luxury-card p-6">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <ImageIcon size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">معرض إيصالات التحويل المستلمة</h2>
            <p className="text-xs text-slate-400">الصور التي أرسلها العملاء عبر الواتساب لإثبات الدفع عبر انستاباي والمحافظ</p>
          </div>
        </div>

        <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">
          إجمالي الإيصالات: {receipts.length}
        </span>
      </div>

      {receipts.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
          <ImageIcon className="mx-auto text-slate-600 mb-2" size={36} />
          <p className="text-sm text-slate-400">لا توجد إيصالات تحويل مستلمة حتى الآن</p>
          <p className="text-xs text-slate-500 mt-1">ستظهر هنا فور إرسال العميل لصورة التحويل في محادثة الواتساب</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receipts.map((r) => {
            const rawFile = (r.payment_receipt || '').trim();
            const cleanFile = rawFile.replace(/^assets\/uploads\/receipts\//, '').replace(/^\/assets\/uploads\/receipts\//, '');
            const receiptImgUrl = cleanFile ? `/assets/uploads/receipts/${cleanFile}` : '';

            return (
              <div
                key={r.id}
                className="bg-slate-900/80 border border-slate-700/70 rounded-xl overflow-hidden hover:border-amber-500/40 transition group shadow-lg"
              >
                {/* Image Preview */}
                <div
                  className="relative h-48 bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer border-b border-slate-800"
                  onClick={() => setSelectedReceipt(r)}
                >
                  {receiptImgUrl ? (
                    <img
                      src={receiptImgUrl}
                      alt={`Receipt ${r.order_number}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) {
                          e.target.nextElementSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}

                  {/* Fallback container when image fails or is pending */}
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900"
                    style={{ display: receiptImgUrl ? 'none' : 'flex' }}
                  >
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 mb-2">
                      <ImageIcon size={28} />
                    </div>
                    <span className="text-xs font-bold text-slate-200">إيصال تحويل مسجل</span>
                    <span className="text-[11px] text-slate-400 mt-1">طلب #{r.order_number}</span>
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-xs font-bold pointer-events-none">
                    <ZoomIn size={18} />
                    <span>تكبير الإيصال</span>
                  </div>
                  <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-md">
                    طلب: {r.order_number}
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <User size={13} className="text-slate-500" /> {r.customer_name}
                    </span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1">
                      <DollarSign size={13} /> {parseFloat(r.total || 0).toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1" dir="ltr">
                      <Phone size={13} className="text-slate-500" /> {r.customer_phone}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar size={12} className="text-slate-500" /> {r.created_at ? new Date(r.created_at).toLocaleDateString('ar-EG') : 'اليوم'}
                    </span>
                  </div>

                  {r.payment_reference ? (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                      <span className="text-[11px] text-amber-300 font-bold">🔢 رقم العملية:</span>
                      <code className="text-xs font-mono font-bold text-amber-400 bg-black/40 px-1.5 py-0.5 rounded select-all" dir="ltr">
                        {r.payment_reference}
                      </code>
                    </div>
                  ) : null}

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.payment_reference 
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' 
                        : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    }`}>
                      {r.payment_reference ? 'رقم عملية مرسل ✓' : 'تم استلام الإيصال ✓'}
                    </span>
                    <a
                      href={`/admin/order_view.php?id=${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <span>عرض بالمتجر</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Preview */}
      {selectedReceipt && (() => {
        const modalRawFile = (selectedReceipt.payment_receipt || '').trim();
        const modalCleanFile = modalRawFile.replace(/^assets\/uploads\/receipts\//, '').replace(/^\/assets\/uploads\/receipts\//, '');
        const modalImgUrl = modalCleanFile ? `/assets/uploads/receipts/${modalCleanFile}` : '';

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedReceipt(null)}
          >
            <div
              className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-100">
                    إيصال تحويل الطلب: <span className="text-amber-400">{selectedReceipt.order_number}</span>
                  </h3>
                  <p className="text-xs text-slate-400">العميل: {selectedReceipt.customer_name} ({selectedReceipt.customer_phone})</p>
                </div>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 bg-slate-950 flex items-center justify-center min-h-[260px]">
                {modalImgUrl ? (
                  <img
                    src={modalImgUrl}
                    alt="Full receipt"
                    className="max-h-[65vh] object-contain rounded-lg border border-slate-800"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextElementSibling) {
                        e.target.nextElementSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className="flex-col items-center justify-center p-8 text-center text-slate-400"
                  style={{ display: modalImgUrl ? 'none' : 'flex' }}
                >
                  <ImageIcon size={48} className="text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-300">لم يتم العثور على ملف الصورة على السيرفر</p>
                  <p className="text-xs text-slate-500 mt-1">اسم الملف: {selectedReceipt.payment_receipt}</p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900">
                <span className="text-xs text-slate-400">
                  المبلغ المطلوب: <strong className="text-emerald-400">{parseFloat(selectedReceipt.total || 0).toFixed(2)} ج.م</strong>
                </span>

                <div className="flex items-center gap-2">
                  {modalImgUrl && (
                    <a
                      href={modalImgUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="secondary-btn text-xs"
                    >
                      تحميل الصورة
                    </a>
                  )}
                  <a
                    href={`/admin/order_view.php?id=${selectedReceipt.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="gold-btn text-xs"
                  >
                    فتح الطلب في لوحة الإدارة
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
