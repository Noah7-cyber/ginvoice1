import React, { useState } from 'react';
import { Transaction, BusinessProfile } from '../types';
import { CURRENCY } from '../constants';
import { ShoppingBag, Printer, Share2, X, Download, Tag, Loader2 } from 'lucide-react';
import { useToast } from './ToastProvider';
import { sharePdfBlob, generateInvoicePDF } from '../services/pdf';

interface InvoicePreviewProps {
  transaction: Transaction;
  business: BusinessProfile;
  onClose: () => void;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ transaction, business, onClose }) => {
  const { addToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      // Use Drawing Method (robust for mobile)
      const blob = await generateInvoicePDF(transaction, business);
      const filename = `invoice-${transaction.id}.pdf`;
      await sharePdfBlob(blob, filename);
    } catch (error) {
      console.error('PDF Share Error:', error);
      addToast('Failed to generate/share PDF. Trying clipboard...', 'error');

      // Fallback
      const shareText = `Invoice from ${business.name}\nCustomer: ${transaction.customerName}\nTotal: ${CURRENCY}${transaction.totalAmount.toLocaleString()}\nID: ${transaction.id}`;
      navigator.clipboard.writeText(shareText);
      addToast('Invoice details copied to clipboard!', 'success');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalItemSavings = transaction.items.reduce((sum, item) => sum + item.discount, 0);
  const totalSavings = totalItemSavings + (transaction.globalDiscount || 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto printable-area">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
        {/* Header - Hidden on print */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 print:hidden shrink-0">
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <Printer size={16} /> Print / PDF
            </button>
            <button 
              onClick={handleShare}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              {isGenerating ? 'Generating...' : 'Share'}
            </button>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-white print:overflow-visible" id="invoice-content">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-primary">
                {business.logo ? (
                  <img src={business.logo} alt="Business Logo" className="w-16 h-16 rounded-xl object-cover bg-white border p-1" />
                ) : (
                  <ShoppingBag size={48} />
                )}
                <h1 className="text-3xl font-black tracking-tight">{business.name}</h1>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p className="flex items-center gap-2">{business.address}</p>
                <p className="flex items-center gap-2">Phone: {business.phone}</p>
                {business.email && <p className="flex items-center gap-2">Email: {business.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-5xl font-black text-gray-200 uppercase tracking-tighter mb-4">Invoice</h2>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">Invoice ID: {transaction.id}</p>
                <p className="text-sm text-gray-500">Date: {new Date(transaction.transactionDate).toLocaleDateString('en-NG', { dateStyle: 'long' })}</p>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Bill To</p>
            <h3 className="text-xl font-bold text-gray-900">{transaction.customerName}</h3>
          </div>

          <table className="w-full mb-10">
            <thead className="border-b-2 border-gray-100">
              <tr>
                <th className="text-left py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Item Description</th>
                <th className="text-center py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Qty</th>
                <th className="text-right py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Unit Price</th>
                <th className="text-right py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transaction.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-4">
                    <div className="font-bold text-gray-800">{item.productName}</div>
                    {item.discount > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                        <Tag size={8} /> Item Discount Applied (-{CURRENCY}{item.discount.toLocaleString()})
                      </div>
                    )}
                  </td>
                  <td className="py-4 text-center font-medium text-gray-600">{item.quantity}</td>
                  <td className="py-4 text-right font-medium text-gray-600">{CURRENCY}{item.unitPrice.toLocaleString()}</td>
                  <td className="py-4 text-right font-bold text-gray-900">{CURRENCY}{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col items-end space-y-3 mb-12">
            <div className="w-full max-w-[240px] flex justify-between items-center py-2 text-gray-500">
              <span className="font-medium text-sm">Subtotal:</span>
              <span className="font-bold">{CURRENCY}{transaction.subtotal.toLocaleString()}</span>
            </div>
            {transaction.globalDiscount > 0 && (
              <div className="w-full max-w-[240px] flex justify-between items-center py-2 text-emerald-600">
                <span className="font-medium text-sm">Order Discount:</span>
                <span className="font-bold">-{CURRENCY}{transaction.globalDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="w-full max-w-[240px] flex justify-between items-center py-4 bg-gray-900 text-white rounded-xl px-4 mt-2">
              <span className="font-black text-xs uppercase tracking-widest opacity-70">Total Amount:</span>
              <span className="text-xl font-black">{CURRENCY}{transaction.totalAmount.toLocaleString()}</span>
            </div>
            
            <div className="w-full max-w-[240px] space-y-1">
              <div className="flex justify-between items-center py-2 text-xs border-t border-gray-100">
                <span className="text-gray-500">Amount Paid:</span>
                <span className="font-bold text-gray-900">{CURRENCY}{transaction.amountPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-xs">
                <span className="text-gray-500">Balance Due:</span>
                <span className={`font-black ${transaction.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {CURRENCY}{transaction.balance.toLocaleString()}
                </span>
              </div>
            </div>

            {totalSavings > 0 && (
              <div className="w-full max-w-[240px] text-center p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 mt-4">
                <p className="text-[10px] font-black uppercase tracking-widest">Total Savings on this Bill</p>
                <p className="text-lg font-black">{CURRENCY}{totalSavings.toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-gray-100">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Signature / Verification</p>
              {transaction.signature ? (
                <div className="relative inline-block border-b-2 border-gray-200 pb-2 pr-12">
                  <img src={transaction.signature} alt="Signature" className="h-16 opacity-90" />
                  {transaction.isSignatureLocked && (
                    <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-1 rounded-full shadow-lg">
                      <Download size={10} className="rotate-180" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-16 flex items-end border-b-2 border-gray-100 w-48">
                  <span className="text-[10px] text-gray-300 italic">No signature provided</span>
                </div>
              )}
            </div>
            <div className="text-right flex flex-col justify-end">
              <p className="text-sm font-black text-gray-900 mb-1">Thank You for Your Patronage!</p>
              <p className="text-xs text-gray-400">Generated by Ginvoice Market OS</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoicePreview;
