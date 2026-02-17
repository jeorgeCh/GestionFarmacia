
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Usuario, Descuento } from '../types';

interface POSProps {
  user: Usuario;
}

interface ReceiptData {
  items: { product: Producto, cantidad: number, finalPrice: number }[];
  total: number;
  received: number;
  change: number;
  date: Date;
  invoiceNumber: string;
}

const POS: React.FC<POSProps> = ({ user }) => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [cart, setCart] = useState<{product: Producto, cantidad: number}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pendingQuantities, setPendingQuantities] = useState<Record<number, number>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('productos')
      .select('*, descuentos(*)')
      .gt('stock', 0)
      .order('nombre', { ascending: true });
    
    if (data) {
      setProducts(data);
      const initialQs: Record<number, number> = {};
      data.forEach(p => initialQs[p.id] = 1);
      setPendingQuantities(initialQs);
    }
  };

  const getActiveDiscount = (product: Producto): Descuento | null => {
    const d = product.descuentos;
    if (!d) return null;
    if (Array.isArray(d)) {
      return d.find(item => item.activo) || null;
    }
    const singleDiscount = d as unknown as Descuento;
    return singleDiscount.activo ? singleDiscount : null;
  };

  const getFinalPrice = (product: Producto) => {
    const activeDiscount = getActiveDiscount(product);
    if (activeDiscount) {
      return product.precio * (1 - activeDiscount.porcentaje / 100);
    }
    return product.precio;
  };

  const addToCart = (product: Producto, quantity?: number) => {
    const qtyToAdd = quantity || pendingQuantities[product.id] || 1;
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      const newQty = Math.min(product.stock, existing.cantidad + qtyToAdd);
      setCart(cart.map(item => item.product.id === product.id ? { ...item, cantidad: newQty } : item));
    } else {
      setCart([...cart, { product, cantidad: Math.min(product.stock, qtyToAdd) }]);
    }
    setSearchTerm('');
    setPendingQuantities(prev => ({ ...prev, [product.id]: 1 }));
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
      const exactMatch = products.find(p => p.codigo_barras === searchTerm.trim());
      if (exactMatch) {
        addToCart(exactMatch, 1);
        e.preventDefault();
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0], 1);
        e.preventDefault();
      }
    }
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.product.id === productId) {
        const nextQty = Math.max(1, Math.min(item.product.stock, item.cantidad + delta));
        return { ...item, cantidad: nextQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length > 0 && confirm("¿Deseas vaciar todos los productos del carrito?")) {
      setCart([]);
      setCashReceived('');
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (getFinalPrice(item.product) * item.cantidad), 0);
  const numericReceived = typeof cashReceived === 'number' ? cashReceived : parseFloat(cashReceived as string) || 0;
  const changeDue = numericReceived > 0 ? numericReceived - totalAmount : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (numericReceived < totalAmount) {
      alert("El monto recibido es menor al total de la venta.");
      return;
    }

    setProcessing(true);
    try {
      const saleData = cart.map(item => ({
        ...item,
        finalPrice: getFinalPrice(item.product)
      }));
      
      const invoiceID = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

      for (const item of saleData) {
        await supabase.from('ventas').insert({
          usuario_id: user.id,
          producto_id: item.product.id,
          cantidad: item.cantidad,
          total: item.finalPrice * item.cantidad
        });
      }

      setReceipt({
        items: saleData,
        total: totalAmount,
        received: numericReceived,
        change: changeDue,
        date: new Date(),
        invoiceNumber: invoiceID
      });

      setCart([]);
      setCashReceived('');
      setSuccess(true);
      setShowReceipt(true);
      await fetchProducts();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Error en venta");
    } finally {
      setProcessing(false);
    }
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setReceipt(null);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.ubicacion && p.ubicacion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
      {/* SECCIÓN PRODUCTOS */}
      <div className="lg:col-span-5 space-y-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            className="w-full pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm outline-none font-bold text-sm placeholder:text-slate-300 focus:border-emerald-500 transition-all"
            placeholder="Escanear código o buscar..."
            value={searchTerm}
            onKeyDown={handleKeyDown}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute inset-y-0 left-5 flex items-center">
             <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1 custom-scrollbar">
          {filteredProducts.map(product => {
            const currentPending = pendingQuantities[product.id] || 1;
            const finalPrice = getFinalPrice(product);
            const activeDiscount = getActiveDiscount(product);

            return (
              <div key={product.id} className="bg-white p-3 rounded-2xl border border-slate-50 shadow-sm flex flex-col justify-between min-h-[140px] hover:border-emerald-100 transition-all group relative">
                {activeDiscount && (
                  <div className="absolute top-2 right-2 bg-rose-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full z-10 animate-pulse">
                    -{Math.round(activeDiscount.porcentaje)}%
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col gap-1">
                      <span className="text-[7px] font-black uppercase bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md w-fit">{product.stock} STOCK</span>
                    </div>
                    <div className="text-right">
                      {activeDiscount && (
                        <p className="text-[8px] line-through text-slate-300 font-bold">${Number(product.precio).toLocaleString()}</p>
                      )}
                      <span className={`font-black text-xs ${activeDiscount ? 'text-rose-600' : 'text-slate-900'}`}>
                        ${Math.round(finalPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <h4 className="font-black text-slate-800 text-xs leading-tight mb-0.5 truncate uppercase">{product.nombre}</h4>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100 scale-90 origin-left">
                    <button onClick={() => setPendingQuantities({...pendingQuantities, [product.id]: Math.max(1, currentPending - 1)})} className="w-6 h-6 flex items-center justify-center rounded-md bg-white shadow-sm text-slate-400 hover:bg-emerald-600 hover:text-white transition-all"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M20 12H4"/></svg></button>
                    <span className="w-6 text-center font-black text-slate-800 text-[10px]">{currentPending}</span>
                    <button onClick={() => setPendingQuantities({...pendingQuantities, [product.id]: Math.min(product.stock, currentPending + 1)})} className="w-6 h-6 flex items-center justify-center rounded-md bg-white shadow-sm text-slate-400 hover:bg-emerald-600 hover:text-white transition-all"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4"/></svg></button>
                  </div>
                  <button onClick={() => addToCart(product)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-lg text-[9px] uppercase transition-all active:scale-95">Añadir</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETALLE DE VENTA */}
      <div className="lg:col-span-7 bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-[calc(100vh-180px)] sticky top-8 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">🛒 Resumen de Facturación</h3>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{cart.length} Ítems</span>
            {cart.length > 0 && (
              <button 
                onClick={clearCart}
                className="bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="text-center py-20 opacity-20 flex flex-col items-center">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <p className="text-[9px] font-black uppercase tracking-[0.3em]">Carrito Vacío</p>
            </div>
          ) : (
            cart.map(item => {
              const finalPrice = getFinalPrice(item.product);
              return (
                <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-lg transition-all group">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-black text-slate-900 text-[10px] uppercase truncate">{item.product.nombre}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">P.U: ${Math.round(finalPrice).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200">
                      <button onClick={() => updateCartQuantity(item.product.id, -1)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:bg-emerald-600 hover:text-white transition-all"><svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M20 12H4"/></svg></button>
                      <span className="w-6 text-center font-black text-slate-700 text-[9px]">{item.cantidad}</span>
                      <button onClick={() => updateCartQuantity(item.product.id, 1)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:bg-emerald-600 hover:text-white transition-all"><svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4"/></svg></button>
                    </div>
                    <p className="font-black text-indigo-600 text-[10px] min-w-[60px] text-right">${Math.round(item.cantidad * finalPrice).toLocaleString()}</p>
                    <button 
                      onClick={() => removeFromCart(item.product.id)} 
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      title="Eliminar del carrito"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-6 bg-slate-50/30 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Efectivo Recibido ($)</label>
              <input
                type="number"
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none font-black text-sm text-slate-700 focus:border-emerald-500 transition-all"
                placeholder="0.00"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cambio</label>
              <div className={`w-full px-4 py-3 rounded-xl font-black text-sm border flex items-center justify-end ${changeDue >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                ${Math.round(changeDue).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-slate-900 font-black text-xs uppercase tracking-tight">TOTAL A COBRAR</span>
            <span className="text-emerald-600 font-black text-xl tracking-tighter">${Math.round(totalAmount).toLocaleString()}</span>
          </div>
          
          <button 
            disabled={cart.length === 0 || processing || (numericReceived < totalAmount && totalAmount > 0)} 
            onClick={handleCheckout} 
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {processing ? 'Procesando...' : 'CERRAR VENTA'}
          </button>
        </div>
      </div>

      {showReceipt && receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase">Venta Exitosa</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">N° {receipt.invoiceNumber}</p>
            </div>
            <div className="space-y-2 mb-8 border-y border-slate-100 py-6">
              {receipt.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs font-bold">
                  <span>{item.cantidad}x {item.product.nombre}</span>
                  <span>${Math.round(item.cantidad * item.finalPrice).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mb-10">
              <span className="font-black text-slate-400 uppercase text-[10px]">Total Pagado</span>
              <span className="text-2xl font-black text-emerald-600">${Math.round(receipt.total).toLocaleString()}</span>
            </div>
            <button onClick={closeReceipt} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Nueva Venta</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
