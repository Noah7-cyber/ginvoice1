
import React, { useMemo, useState } from 'react';
import { ShoppingBag, Minus, Plus, Trash2, Tag, User, Banknote, CreditCard, ReceiptText, X, AlertCircle } from 'lucide-react';
import { SaleItem, PaymentMethod, Transaction, Product } from '../types';
import { CURRENCY } from '../constants';
import SignaturePad from './SignaturePad';

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
}

const CurrentOrderSidebar: React.FC<CurrentOrderSidebarProps> = ({
  cart, setCart, customerName, setCustomerName, paymentMethod, setPaymentMethod,
  customerPhone, setCustomerPhone, amountPaid, setAmountPaid, globalDiscount, setGlobalDiscount, isGlobalDiscountPercent,
  setIsGlobalDiscountPercent, signature, setSignature, isLocked, setIsLocked,
  onCompleteSale, onClose, products
}) => {
  const [activeDiscountEdit, setActiveDiscountEdit] = useState<string | null>(null);

  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  
  const finalDiscountValue = useMemo(() => {
    if (isGlobalDiscountPercent) return (cartSubtotal * globalDiscount) / 100;
    return globalDiscount;
  }, [cartSubtotal, globalDiscount, isGlobalDiscountPercent]);

  const cartTotal = Math.max(0, cartSubtotal - finalDiscountValue);
  const balance = Math.max(0, cartTotal - amountPaid);

  const updateQuantity = (productId: string, unitName: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId && item.unit === unitName) {
        const newQty = Math.max(1, item.quantity + delta);
        const product = products.find(p => p.id === productId);
        const unit = product?.units.find(u => u.name === unitName);
        if (product && unit) {
          const stockInSelectedUnit = Math.floor((product.stock || 0) / unit.multiplier);
          if (newQty > stockInSelectedUnit) return item;
        }
        return { ...item, quantity: newQty, total: (newQty * item.unitPrice) - item.discount };
      }
      return item;
    }));
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const d = Math.max(0, discount);
        return { ...item, discount: d, total: (item.quantity * item.unitPrice) - d };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string, unit: string) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && item.unit === unit)));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const transaction: Transaction = {
      id: `TX-${Date.now()}`,
      transactionDate: new Date().toISOString(),
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || undefined,
      items: cart,
      subtotal: cartSubtotal,
      globalDiscount: finalDiscountValue,
      totalAmount: cartTotal,
      paymentMethod,
      amountPaid: amountPaid,
      balance: balance,
      signature,
      isSignatureLocked: isLocked,
      staffId: 'STAFF-01'
    };
    onCompleteSale(transaction);
  };

  // Sync amount paid for full payments
  React.useEffect(() => {
    if (paymentMethod !== 'credit') {
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
              placeholder="Guest Customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none font-bold shadow-sm"
            />
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
              placeholder="+234..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none font-bold shadow-sm"
            />
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
              <div key={`${item.productId}-${item.unit}`} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm relative group">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{item.productName} <span className="text-gray-400 font-medium">({item.unit})</span></p>
                    <p className="text-[10px] text-gray-400">{CURRENCY}{item.unitPrice.toLocaleString()} / {item.unit}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.productId, item.unit)} className="text-gray-300 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.productId, item.unit, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 border text-gray-600 hover:text-primary"><Minus size={14} /></button>
                    <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.unit, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 border text-gray-600 hover:text-primary"><Plus size={14} /></button>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900">{CURRENCY}{item.total.toLocaleString()}</p>
                    <button 
                      onClick={() => setActiveDiscountEdit(activeDiscountEdit === `${item.productId}-${item.unit}` ? null : `${item.productId}-${item.unit}`)}
                      className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${item.discount > 0 ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-primary'}`}
                    >
                      {item.discount > 0 ? `Saved ${CURRENCY}${item.discount}` : 'Add Discount'}
                    </button>
                  </div>
                </div>

                {activeDiscountEdit === `${item.productId}-${item.unit}` && (
                  <input 
                    type="number"
                    autoFocus
                    placeholder="Naira Discount"
                    className="mt-2 w-full px-2 py-1 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                    value={item.discount}
                    onChange={(e) => updateItemDiscount(item.productId, Number(e.target.value))}
                    onBlur={() => setActiveDiscountEdit(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2">
            {/* Global Discount */}
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Global Cut</span>
                <div className="flex bg-white rounded-lg p-0.5 border text-[9px] font-black">
                  <button onClick={() => setIsGlobalDiscountPercent(false)} className={`px-2 py-1 rounded ${!isGlobalDiscountPercent ? 'bg-primary text-white' : 'text-gray-400'}`}>AMT</button>
                  <button onClick={() => setIsGlobalDiscountPercent(true)} className={`px-2 py-1 rounded ${isGlobalDiscountPercent ? 'bg-primary text-white' : 'text-gray-400'}`}>%</button>
                </div>
              </div>
              <input 
                type="number"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                placeholder="0"
              />
            </div>

            {/* Payment Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <PaymentBtn active={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')} icon={<Banknote size={14}/>} label="Cash" />
                <PaymentBtn active={paymentMethod === 'transfer'} onClick={() => setPaymentMethod('transfer')} icon={<CreditCard size={14}/>} label="Bank" />
                <PaymentBtn active={paymentMethod === 'credit'} onClick={() => setPaymentMethod('credit')} icon={<User size={14}/>} label="Debt" />
              </div>

              {paymentMethod !== 'cash' && paymentMethod !== 'transfer' && (
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
                    {CURRENCY}{balance.toLocaleString()}
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
            <span className="text-xs font-bold text-gray-500 line-through decoration-red-400">{CURRENCY}{cartSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Net Total</span>
            <span className="text-2xl font-black text-gray-900">{CURRENCY}{cartTotal.toLocaleString()}</span>
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
