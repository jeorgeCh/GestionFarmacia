
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Usuario, Descuento } from '../types';

interface POSProps {
  user: Usuario;
}

interface CartItem {
  product: Producto;
  cantidad: number;
  saleMode: 'caja' | 'unidad';
  originalPrice: number;
  finalPrice: number;
  discountApplied: number;
}

const POS: React.FC<POSProps> = ({ user }) => {
  const [products, setProducts] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cashReceived, setCashReceived] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [saleModes, setSaleModes] = useState<Record<number, 'caja' | 'unidad'>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    if (searchInputRef.current) searchInputRef.current.focus();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('productos')
      .select('*, descuentos(*)')
      .gt('stock', 0);
    
    if (data) {
      setProducts(data);
      const initialModes: Record<number, 'caja' | 'unidad'> = {};
      data.forEach(p => initialModes[p.id] = 'caja');
      setSaleModes(initialModes);
    }
  };

  const getPriceInfo = (product: Producto, mode: 'caja' | 'unidad') => {
    const basePrice = (product.tipo === 'pastillas' && mode === 'unidad') 
      ? product.precio_unidad 
      : product.precio;
    
    let activeDiscount: Descuento | undefined;
    const rawDescuentos = product.descuentos as any;
    
    if (Array.isArray(rawDescuentos)) {
      activeDiscount = rawDescuentos.find((d: any) => d.activo);
    } else if (rawDescuentos && rawDescuentos.activo) {
      activeDiscount = rawDescuentos;
    }

    const discountPercent = activeDiscount ? activeDiscount.porcentaje : 0;
    const finalPrice = basePrice * (1 - discountPercent / 100);

    return {
      basePrice,
      finalPrice,
      discountPercent,
      isOnSale: discountPercent > 0
    };
  };

  const addToCart = (product: Producto) => {
    const mode = product.tipo === 'pastillas' ? (saleModes[product.id] || 'caja') : 'caja';
    const priceInfo = getPriceInfo(product, mode);
    
    const unitsRequired = mode === 'caja' ? (product.unidades_por_caja || 1) : 1;
    const currentUnitsInCart = cart.reduce((sum, item) => {
      if (item.product.id === product.id) {
        return sum + (item.saleMode === 'caja' ? item.cantidad * (item.product.unidades_por_caja || 1) : item.cantidad);
      }
      return sum;
    }, 0);

    if (currentUnitsInCart + unitsRequired > product.stock) {
      alert("¡Stock insuficiente!");
      return;
    }

    const existing = cart.find(item => item.product.id === product.id && item.saleMode === mode);
    if (existing) {
      setCart(cart.map(item => 
        (item.product.id === product.id && item.saleMode === mode) 
          ? { ...item, cantidad: item.cantidad + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { 
        product, 
        cantidad: 1, 
        saleMode: mode,
        originalPrice: priceInfo.basePrice,
        finalPrice: priceInfo.finalPrice,
        discountApplied: priceInfo.discountPercent
      }]);
    }
    setSearchTerm('');
  };

  const removeFromCart = (productId: number, mode: string) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.saleMode === mode)));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.finalPrice * item.cantidad), 0);
  const changeDue = (Number(cashReceived) || 0) - totalAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'efectivo') {
      if (cashReceived === '' || Number(cashReceived) <= 0) {
        alert("¡Error! Debe ingresar la cantidad de dinero que entrega el cliente.");
        return;
      }
      if (changeDue < 0) {
        alert(`Dinero insuficiente. Faltan $${Math.abs(changeDue).toLocaleString()}`);
        return;
      }
    }

    setProcessing(true);
    try {
      const transactionId = crypto.randomUUID();
      const finalCashReceived = paymentMethod === 'efectivo' ? Number(cashReceived) : 0;
      const finalChange = paymentMethod === 'efectivo' ? changeDue : 0;

      const salesToInsert = cart.map(item => {
        const unitsToDeduct = item.saleMode === 'caja' ? item.cantidad * (item.product.unidades_por_caja || 1) : item.cantidad;
        return {
          usuario_id: user.id,
          producto_id: item.product.id,
          cantidad: unitsToDeduct, 
          total: item.finalPrice * item.cantidad,
          metodo_pago: paymentMethod,
          dinero_recibido: finalCashReceived,
          cambio: finalChange,
          es_unidad: item.saleMode === 'unidad',
          transaccion_id: transactionId
        };
      });

      const { error: saleError } = await supabase.from('ventas').insert(salesToInsert);
      if (saleError) throw saleError;

      // Actualizar stock para cada producto
      for (const item of cart) {
        const unitsToDeduct = item.saleMode === 'caja' ? item.cantidad * (item.product.unidades_por_caja || 1) : item.cantidad;
        await supabase.rpc('deduct_stock', { p_id: item.product.id, p_qty: unitsToDeduct });
      }

      setCart([]);
      setCashReceived('');
      setShowReceipt(true);
      fetchProducts();
    } catch (err: any) {
      alert("Error en la venta: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.codigo_barras.includes(searchTerm) ||
    (p.laboratorio && p.laboratorio.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up">
      <div className="lg:col-span-5 space-y-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            className="w-full px-12 py-5 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-sm shadow-sm focus:border-emerald-500"
            placeholder="Buscar por nombre o laboratorio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="absolute inset-y-0 left-6 flex items-center text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
          {filteredProducts.map(product => {
            const priceInfo = getPriceInfo(product, saleModes[product.id] || 'caja');
            return (
              <div key={product.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                {priceInfo.isOnSale && (
                  <div className="absolute top-0 right-0 bg-rose-600 text-white px-4 py-1 rounded-bl-2xl font-black text-[9px] uppercase tracking-widest shadow-lg animate-pulse">
                    OFERTA -{Math.round(priceInfo.discountPercent)}%
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-black text-slate-900 text-[13px] uppercase truncate leading-none mb-1">{product.nombre}</h4>
                    <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Laboratorio: {product.laboratorio || 'N/A'}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Stock: {product.stock} uds</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                     {priceInfo.isOnSale && (
                       <p className="text-[10px] text-slate-300 font-bold line-through mb-0.5">
                         ${priceInfo.basePrice.toLocaleString()}
                       </p>
                     )}
                     <p className="font-black text-emerald-600 text-lg tracking-tighter">
                       ${priceInfo.finalPrice.toLocaleString()}
                     </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {product.tipo === 'pastillas' && (
                    <div className="flex bg-slate-50 rounded-2xl p-1 flex-1 border border-slate-100">
                      <button onClick={() => setSaleModes({...saleModes, [product.id]: 'caja'})} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${saleModes[product.id] === 'caja' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Caja</button>
                      <button onClick={() => setSaleModes({...saleModes, [product.id]: 'unidad'})} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${saleModes[product.id] === 'unidad' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Frac.</button>
                    </div>
                  )}
                  <button onClick={() => addToCart(product)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg flex-1">
                    Agregar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-7 bg-white rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-220px)] overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <h3 className="text-sm font-black uppercase tracking-tight">Carrito Actual</h3>
          <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-xl">{cart.length} ITEMS</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {cart.map((item) => (
            <div key={`${item.product.id}-${item.saleMode}`} className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-slate-100">
              <div className="flex-1 overflow-hidden pr-4">
                <p className="font-black text-slate-900 text-[12px] uppercase truncate mb-1">{item.product.nombre}</p>
                <p className="text-[9px] text-indigo-500 font-black uppercase tracking-tighter">Laboratorio: {item.product.laboratorio || 'S/L'}</p>
                <p className="text-[11px] text-slate-400 font-black mt-1">{item.cantidad} x ${item.finalPrice.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-5">
                <p className="font-black text-slate-900 text-base tracking-tighter">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                <button onClick={() => removeFromCart(item.product.id, item.saleMode)} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 bg-white border-t border-slate-100 space-y-6">
           <div className="flex justify-between items-center px-4">
             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Venta</span>
             <span className="text-4xl font-black text-slate-900 tracking-tighter">${totalAmount.toLocaleString()}</span>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setPaymentMethod('efectivo'); setCashReceived(''); }} className={`py-4 rounded-2xl font-black text-[11px] uppercase border-2 transition-all ${paymentMethod === 'efectivo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>Billete / Efec.</button>
              <button onClick={() => { setPaymentMethod('transferencia'); setCashReceived(totalAmount); }} className={`py-4 rounded-2xl font-black text-[11px] uppercase border-2 transition-all ${paymentMethod === 'transferencia' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}>Transferencia</button>
           </div>

           {paymentMethod === 'efectivo' && (
             <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4">
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Recibido</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                   <input 
                    type="number" 
                    className={`w-full pl-8 pr-5 py-4 rounded-2xl border-2 font-black text-base outline-none transition-all ${!cashReceived ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                    placeholder="0" 
                    value={cashReceived} 
                    onChange={e => setCashReceived(e.target.value)} 
                   />
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Devuelta</label>
                 <div className={`w-full px-5 py-4 rounded-2xl border-2 flex items-center justify-end font-black text-xl tracking-tighter ${changeDue < 0 ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                   ${changeDue < 0 ? '0' : changeDue.toLocaleString()}
                 </div>
               </div>
             </div>
           )}

           <button disabled={cart.length === 0 || processing} onClick={handleCheckout} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
             {processing ? 'Confirmando...' : 'Cobrar Transacción'}
           </button>
        </div>
      </div>

      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[4rem] p-12 text-center shadow-2xl">
             <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl border border-emerald-100 shadow-inner">✓</div>
             <h2 className="text-2xl font-black uppercase text-slate-900 mb-2 tracking-tight">¡Cobro Exitoso!</h2>
             <button onClick={() => setShowReceipt(false)} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-2xl">Nueva Venta</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
