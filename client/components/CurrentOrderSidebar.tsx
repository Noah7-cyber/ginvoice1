
import React, { useMemo, useState } from 'react';
import { ShoppingBag, Minus, Plus, Trash2, Tag, User, Banknote, CreditCard, ReceiptText, X, AlertCircle, Loader2, Ticket } from 'lucide-react';
import { SaleItem, PaymentMethod, Transaction, Product } from '../types';
import { CURRENCY } from '../constants';
import { formatCurrency } from '../utils/currency';
import SignaturePad from './SignaturePad';
import { uploadFile, validateDiscountCode } from '../services/api';

const normalizeCustomerName = (value: string) => {
  const clean = (value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Walk-in Customer';
  return clean
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

interface CurrentOrderSidebarProps {
  cart: SaleItem[];
  setCart: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (val: PaymentMethod) => void;
  amountPaid: number;
  setAmountPaid: (val: number) => void;
  globalDiscount: number;
  setGlobalDiscount: (val: number) => void;
  isGlobalDiscountPercent: boolean;
  setIsGlobalDiscountPercent: (val: boolean) => void;
  signature: string;
  setSignature: (val: string) => void;
  isLocked: boolean;
  setIsLocked: (val: boolean) => void;
  onCompleteSale: (transaction: Transaction) => void;
  onClose: () => void;
  products: Product[];
  permissions: any;
  isOwner?: boolean; // Added isOwner prop
  pastCustomers?: string[];
}

const CurrentOrderSidebar: React.FC<CurrentOrderSidebarProps> = ({
  cart, setCart, customerName, setCustomerName, paymentMethod, setPaymentMethod,
  customerPhone, setCustomerPhone, amountPaid, setAmountPaid, globalDiscount, setGlobalDiscount, isGlobalDiscountPercent,
  setIsGlobalDiscountPercent, signature, setSignature, isLocked, setIsLocked,
  onCompleteSale, onClose, products, permissions, isOwner = false, pastCustomers
}) => {
  const [activeDiscountEdit, setActiveDiscountEdit] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const canGiveDiscount = isOwner || permissions?.canGiveDiscount;

  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  
  const finalDiscountValue = useMemo(() => {
    if (isGlobalDiscountPercent) return (cartSubtotal * globalDiscount) / 100;
    return globalDiscount;
  }, [cartSubtotal, globalDiscount, isGlobalDiscountPercent]);

  const cartTotal = Math.max(0, cartSubtotal - finalDiscountValue);
  const balance = Math.max(0, cartTotal - amountPaid);

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQty = Math.max(1, item.quantity + delta);
        const product = products.find(p => p.id === item.productId);
        if (product && newQty > product.currentStock) return item;
        return { ...item, quantity: newQty, total: (newQty * item.unitPrice) - item.discount };
      }
      return item;
    }));
  };

  const updateItemDiscount = (cartId: string, discount: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const d = Math.max(0, discount);
        return { ...item, discount: d, total: (item.quantity * item.unitPrice) - d };
      }
      return item;
    }));
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    let finalSignature = signature;

    // Hybrid Mode: Try upload, fallback to base64
    if (navigator.onLine && signature.startsWith('data:image')) {
      try {
        const blob = await (await fetch(signature)).blob();
        const url = await uploadFile(new File([blob], 'sig.png'));
        finalSignature = url;
      } catch (e) {
        console.warn("Upload failed, saving Base64 as fallback to prevent data loss.");
      }
    }

    const transaction: Transaction = {
      id: `TX-${Date.now()}`,
      transactionDate: new Date().toISOString(),
      customerName: normalizeCustomerName(customerName),
      customerPhone: customerPhone || undefined,
      items: cart,
      subtotal: cartSubtotal,
      globalDiscount: finalDiscountValue,
      totalAmount: cartTotal,
      paymentMethod,
      amountPaid: amountPaid,
      balance: balance,
      signature: finalSignature,
      isSignatureLocked: isLocked,
      staffId: isOwner ? 'owner' : 'staff',
      createdByRole: isOwner ? 'owner' : 'staff',
      discountCode: discountCode || undefined
    };

    // Save Phone Number for future suggestions
    if (customerPhone) {
       try {
         const stored = localStorage.getItem('ginvoice_recent_phones');
         const phones = stored ? JSON.parse(stored) : [];
         if (!phones.includes(customerPhone)) {
            phones.push(customerPhone);
            // Limit to last 20
            if (phones.length > 20) phones.shift();
            localStorage.setItem('ginvoice_recent_phones', JSON.stringify(phones));
         }
       } catch (err) { console.error(err); }
    }

    onCompleteSale(transaction);
  };

  // Sync amount paid for full payments
  React.useEffect(() => {
    if (paymentMethod === 'credit') {
      setAmountPaid(0);
    } else if (paymentMethod !== 'credit') {
      setAmountPaid(cartTotal);
    }
  }, [cartTotal, paymentMethod]);

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <div className="p-4 border-b bg-white shrink-0 flex justify-between items-center">
        <h2 className="text-lg font-black flex items-center gap-2 text-gray-900">
          <ShoppingBag className="text-primary" size={20} /> Current Bill
        </h2>
        <button onClick={onClose} className="md:hidden p-2 text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Customer Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Customer</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              list="customer-history"
              placeholder="Guest Customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none font-bold shadow-sm"
            />
            <datalist id="customer-history">
              {pastCustomers?.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Customer Phone</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              list="phone-suggestions"
              placeholder="+234..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none font-bold shadow-sm"
            />
            <datalist id="phone-suggestions">
               {(() => {
                 try {
                   const stored = localStorage.getItem('ginvoice_recent_phones');
                   const phones = stored ? JSON.parse(stored) : [];
                   return phones.map((p: string) => <option key={p} value={p} />);
                 } catch { return null; }
               })()}
            </datalist>
          </div>
        </div>

        {/* Cart Items */}
        <div className="space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <ShoppingBag size={48} className="opacity-10 mb-2" />
              <p className="text-sm font-bold">No items in bill</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.cartId} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative group">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{item.productName}</p>
                    <p className="text-[10px] text-gray-400">{formatCurrency(item.unitPrice)} / unit</p>
                  </div>
                  <button onClick={() => removeFromCart(item.cartId)} className="text-gray-300 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.cartId, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 border text-gray-600 hover:text-primary"><Minus size={14} /></button>
                    <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartId, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 border text-gray-600 hover:text-primary"><Plus size={14} /></button>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900">{formatCurrency(item.total)}</p>
                    {canGiveDiscount && (
                      <button
                        onClick={() => setActiveDiscountEdit(activeDiscountEdit === item.cartId ? null : item.cartId)}
                        className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${item.discount > 0 ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-primary'}`}
                      >
                        {item.discount > 0 ? `Saved ${formatCurrency(item.discount)}` : 'Add Discount'}
                      </button>
                    )}
                  </div>
                </div>

                {activeDiscountEdit === item.cartId && (
                  <input 
                    type="number"
                    autoFocus
                    placeholder="Naira Discount"
                    className="mt-2 w-full px-2 py-1 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                    value={item.discount}
                    onChange={(e) => updateItemDiscount(item.cartId, Number(e.target.value))}
                    onBlur={() => setActiveDiscountEdit(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2">
            {/* Global Discount & Codes */}
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Global Cut</span>
                <div className="flex bg-white rounded-lg p-0.5 border text-[9px] font-black">
                  <button onClick={() => setIsGlobalDiscountPercent(false)} className={`px-2 py-1 rounded ${!isGlobalDiscountPercent ? 'bg-primary text-white' : 'text-gray-400'}`}>AMT</button>
                  <button onClick={() => setIsGlobalDiscountPercent(true)} className={`px-2 py-1 rounded ${isGlobalDiscountPercent ? 'bg-primary text-white' : 'text-gray-400'}`}>%</button>
                </div>
              </div>

              {canGiveDiscount ? (
                <input
                  type="number"
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                  placeholder="0"
                />
              ) : (
                <div className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Enter Code"
                     className="w-full px-3 py-2 bg-white border rounded-xl text-sm font-bold uppercase"
                     value={discountCode}
                     onChange={e => setDiscountCode(e.target.value)}
                   />
                   <button
                     disabled={isValidatingCode}
                     onClick={async () => {
                        setIsValidatingCode(true);
                        try {
                           const res = await validateDiscountCode(discountCode, cart);
                           if (res.valid && res.discount) {
                              if (res.discount.type === 'percent') {
                                 setIsGlobalDiscountPercent(true);
                                 setGlobalDiscount(res.discount.value);
                              } else {
                                 setIsGlobalDiscountPercent(false);
                                 setGlobalDiscount(res.discount.value);
                              }
                              // alert('Discount Applied');
                           }
                        } catch(err) {
                           alert('Invalid Code');
                        } finally {
                           setIsValidatingCode(false);
                        }
                     }}
                     className="px-3 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center min-w-[60px]"
                   >
                     {isValidatingCode ? <Loader2 className="animate-spin" size={16} /> : 'Apply'}
                   </button>
                </div>
              )}
            </div>

            {/* Payment Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Payment Method</label>
              <div className="grid grid-cols-4 gap-2">
                <PaymentBtn active={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')} icon={<Banknote size={14}/>} label="Cash" />
                <PaymentBtn active={paymentMethod === 'transfer'} onClick={() => setPaymentMethod('transfer')} icon={<CreditCard size={14}/>} label="Transfer" />
                <PaymentBtn active={paymentMethod === 'pos'} onClick={() => setPaymentMethod('pos')} icon={<CreditCard size={14}/>} label="POS" />
                <PaymentBtn active={paymentMethod === 'credit'} onClick={() => setPaymentMethod('credit')} icon={<User size={14}/>} label="Debt" />
              </div>

              {paymentMethod !== 'cash' && paymentMethod !== 'transfer' && paymentMethod !== 'pos' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold">
                  <AlertCircle size={14} /> This will be added to the Debtors Ledger.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Collected</span>
                  <input 
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Balance</span>
                  <div className={`w-full px-3 py-2 rounded-xl text-sm font-black flex items-center justify-end ${balance > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {formatCurrency(balance)}
                  </div>
                </div>
              </div>
            </div>

            <SignaturePad 
              onSave={(data, locked) => { setSignature(data); setIsLocked(locked); }}
              onClear={() => { setSignature(''); setIsLocked(false); }}
              initialData={signature}
              initialLocked={isLocked}
            />
          </div>
        )}
      </div>

      {/* Checkout Footer */}
      <div className="p-4 bg-white border-t shrink-0 space-y-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Subtotal</span>
            <span className="text-xs font-bold text-gray-500 line-through decoration-red-400">{formatCurrency(cartSubtotal)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Net Total</span>
            <span className="text-2xl font-black text-gray-900">{formatCurrency(cartTotal)}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className={`
            w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-lg shadow-xl transition-all active:scale-95
            ${cart.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none' : 'bg-primary text-white hover:opacity-90'}
          `}
        >
          <ReceiptText size={22} /> Confirm Bill
        </button>
      </div>
    </div>
  );
};

const PaymentBtn: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border transition-all ${
      active ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'
    }`}
  >
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default CurrentOrderSidebar;
