import React, { useState, useEffect } from 'react';
import { CreditCard, Save, Check, Copy } from 'lucide-react';

export default function SettingsCard({ initialSettings, onSave }) {
  const [instapay, setInstapay] = useState(initialSettings?.instapay_username || 'zain@instapay');
  const [vodafone, setVodafone] = useState(initialSettings?.vodafone_cash_number || '01111026600');
  const [bankInfo, setBankInfo] = useState(initialSettings?.bank_account_info || 'البنك الأهلي المصري - حساب رقم 123456789');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    if (initialSettings) {
      if (initialSettings.instapay_username) setInstapay(initialSettings.instapay_username);
      if (initialSettings.vodafone_cash_number) setVodafone(initialSettings.vodafone_cash_number);
      if (initialSettings.bank_account_info) setBankInfo(initialSettings.bank_account_info);
    }
  }, [initialSettings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        instapay_username: instapay,
        vodafone_cash_number: vodafone,
        bank_account_info: bankInfo
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('فشل حفظ الإعدادات: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="luxury-card p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4 mb-5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">إعدادات الدفع وانستاباي</h2>
            <p className="text-xs text-slate-400">البيانات التي يرسلها البوت تلقائياً للعميل عند اختيار الدفع الإلكتروني</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* InstaPay Username / IPA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                عنوان انستاباي (InstaPay IPA / Link):
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(instapay, 'ipa')}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {copiedKey === 'ipa' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'ipa' ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
            <input
              type="text"
              value={instapay}
              onChange={(e) => setInstapay(e.target.value)}
              placeholder="مثال: zain@instapay أو zainperfumes"
              className="input-field font-mono text-left text-sm"
              dir="ltr"
              required
            />
            <span className="text-[11px] text-slate-500 block mt-1">يظهر للعميل كعنوان تحويل مباشر في تطبيق انستاباي</span>
          </div>

          {/* Vodafone Cash / Wallets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                رقم المحفظة الإلكترونية (فودافون كاش / اتصالات / أورنج):
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(vodafone, 'wallet')}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {copiedKey === 'wallet' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'wallet' ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
            <input
              type="text"
              value={vodafone}
              onChange={(e) => setVodafone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="input-field font-mono text-left text-sm"
              dir="ltr"
              required
            />
          </div>

          {/* Bank Account Info */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              بيانات الحساب البنكي والآيبان (اختياري):
            </label>
            <textarea
              rows={2}
              value={bankInfo}
              onChange={(e) => setBankInfo(e.target.value)}
              placeholder="اسم البنك، رقم الحساب، رقم الـ IBAN..."
              className="input-field text-xs resize-none"
            />
          </div>
        </form>
      </div>

      <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between mt-4">
        <span className="text-xs text-slate-400">
          تُحفظ البيانات فوراً في قاعدة بيانات المتجر
        </span>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="gold-btn text-xs"
        >
          {saved ? <Check size={16} className="text-emerald-950" /> : <Save size={16} />}
          <span>{saved ? 'تم الحفظ بنجاح!' : saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
        </button>
      </div>
    </div>
  );
}
