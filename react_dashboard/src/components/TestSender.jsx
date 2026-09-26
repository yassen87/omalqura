import React, { useState } from 'react';
import { Send, Phone, MessageSquare, Check, AlertCircle } from 'lucide-react';

export default function TestSender({ onSendTest, isConnected }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('مرحباً بك! هذه رسالة تجريبية من بوت متجر زين للعطور 🌸');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!phone) {
      alert('يرجى إدخال رقم الهاتف');
      return;
    }
    setSending(true);
    setResult(null);
    try {
      await onSendTest(phone, message);
      setResult({ success: true, text: 'تم إرسال الرسالة التجريبية بنجاح!' });
      setTimeout(() => setResult(null), 4000);
    } catch (err) {
      setResult({ success: false, text: err.message || 'فشل إرسال الرسالة' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="luxury-card p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 border-b border-slate-700/60 pb-4 mb-5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Send size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">تجربة إرسال رسالة</h2>
            <p className="text-xs text-slate-400">أرسل رسالة واتساب تجريبية لأي رقم هاتف للتحقق من الاتصال</p>
          </div>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
              <Phone size={13} />
              رقم الهاتف المستلم (مع كود الدولة أو محلي):
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX أو 201111026600"
              className="input-field font-mono text-left text-sm"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
              <MessageSquare size={13} />
              نص الرسالة التجريبية:
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب نص الرسالة هنا..."
              className="input-field text-xs resize-none"
              required
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                result.success
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/15 border border-red-500/30 text-red-300'
              }`}
            >
              {result.success ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{result.text}</span>
            </div>
          )}
        </form>
      </div>

      <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between mt-4">
        <span className="text-xs text-slate-500">
          {!isConnected && '⚠️ يتطلب أن يكون البوت متصلاً وجاهزاً'}
        </span>

        <button
          onClick={handleSend}
          disabled={sending || !isConnected}
          className="gold-btn text-xs"
        >
          <Send size={15} />
          <span>{sending ? 'جاري الإرسال...' : 'إرسال الرسالة الآن'}</span>
        </button>
      </div>
    </div>
  );
}
