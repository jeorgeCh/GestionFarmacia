
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
  const [showOrderSummary, setShowOrderSummary] = useState<any>(null);
  const [saleModes, setSaleModes] = useState<Record<number, 'caja' | 'unidad'>>({});
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
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
    
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 600);
  };

  const removeFromCart = (productId: number, mode: string) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.saleMode === mode)));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.finalPrice * item.cantidad), 0);
  const changeDue = (Number(cashReceived) || 0) - totalAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'efectivo' && (cashReceived === '' || Number(cashReceived) < totalAmount)) {
      alert("Dinero insuficiente");
      return;
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

      for (const item of cart) {
        const unitsToDeduct = item.saleMode === 'caja' ? item.cantidad * (item.product.unidades_por_caja || 1) : item.cantidad;
        await supabase.rpc('deduct_stock', { p_id: item.product.id, p_qty: unitsToDeduct });
      }

      // Guardar resumen antes de limpiar para mostrarlo en la confirmación
      setShowOrderSummary({
        transactionId: transactionId.split('-')[0].toUpperCase(),
        items: [...cart],
        total: totalAmount,
        paymentMethod,
        cashReceived: finalCashReceived,
        change: finalChange,
        date: new Date().toLocaleString()
      });

      setCart([]);
      setCashReceived('');
      setShowMobileCart(false);
      fetchProducts();
    } catch (err: any) {
      alert("Error: " + err.message);
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
    <div className="relative min-h-[calc(100vh-180px)] animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* BUSCADOR Y LISTA DE PRODUCTOS (IZQUIERDA) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="relative group">
            <input
              ref={searchInputRef}
              className="w-full px-14 py-6 bg-white border-2 border-slate-100 rounded-[2.5rem] outline-none font-bold text-lg shadow-sm focus:border-emerald-500 transition-all"
              placeholder="Escribe para buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar flex-1 pb-32 lg:pb-0 pr-1 max-h-[calc(100vh-320px)] lg:max-h-none">
            {filteredProducts.map(product => {
              const priceInfo = getPriceInfo(product, saleModes[product.id] || 'caja');
              const isAdded = lastAddedId === product.id;
              return (
                <div key={product.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm hover:shadow-lg transition-all relative">
                  {priceInfo.isOnSale && (
                    <div className="absolute top-4 right-4 bg-rose-600 text-white px-3 py-1 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg">
                      -{Math.round(priceInfo.discountPercent)}%
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <h4 className="font-black text-slate-900 text-sm uppercase truncate mb-1">{product.nombre}</h4>
                    <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Lab: {product.laboratorio || 'N/A'}</p>
                    <p className={`text-[9px] font-bold mt-1 uppercase ${product.stock < 10 ? 'text-rose-500' : 'text-slate-400'}`}>Stock: {product.stock} uds</p>
                  </div>

                  <div className="flex items-center justify-between mb-5 bg-slate-50 p-4 rounded-2xl">
                    <div className="text-left">
                       <p className="font-black text-emerald-600 text-xl tracking-tighter">
                         ${priceInfo.finalPrice.toLocaleString()}
                       </p>
                    </div>
                    {product.tipo === 'pastillas' && (
                      <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-inner">
                        <button onClick={() => setSaleModes({...saleModes, [product.id]: 'caja'})} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${saleModes[product.id] === 'caja' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Caja</button>
                        <button onClick={() => setSaleModes({...saleModes, [product.id]: 'unidad'})} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${saleModes[product.id] === 'unidad' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Unid</button>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => addToCart(product)} 
                    className={`w-full py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${isAdded ? 'bg-emerald-500 text-white scale-95' : 'bg-slate-900 text-white hover:bg-emerald-600 active:scale-95'}`}
                  >
                    {isAdded ? '✓ Agregado' : '+ Agregar al Carrito'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARRITO (DERECHA EN PC) */}
        <div className={`lg:col-span-5 fixed inset-0 z-50 lg:relative lg:z-0 lg:flex flex-col bg-white lg:rounded-[3.5rem] shadow-2xl lg:shadow-sm border border-slate-100 overflow-hidden transition-transform duration-300 ${showMobileCart ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
          
          <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Venta Actual</h3>
              <p className="text-[10px] font-bold text-emerald-400 uppercase mt-2">{cart.length} productos en lista</p>
            </div>
            <button onClick={() => setShowMobileCart(false)} className="lg:hidden w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-20 py-20 grayscale">
                <svg className="w-20 h-20 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                <p className="font-black text-[10px] uppercase tracking-[0.4em]">Sin productos seleccionados</p>
              </div>
            ) : cart.map((item) => (
              <div key={`${item.product.id}-${item.saleMode}`} className="bg-white p-5 rounded-[2.2rem] shadow-md flex items-center gap-4 animate-in slide-in-from-right-6">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black shrink-0 text-xs">
                   {item.product.nombre.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-black text-slate-900 text-[12px] uppercase truncate">{item.product.nombre}</h5>
                  <p className="text-[9px] text-slate-400 font-black mt-1 uppercase">
                    {item.cantidad} {item.saleMode === 'unidad' ? 'Uds' : 'Cj'} x ${item.finalPrice.toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-slate-900 text-sm tracking-tighter">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                  <button onClick={() => removeFromCart(item.product.id, item.saleMode)} className="text-rose-500 font-black text-[9px] uppercase tracking-widest mt-2 hover:underline">Quitar</button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-8 bg-white border-t border-slate-100 space-y-6 shrink-0">
             <div className="flex justify-between items-center">
               <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Gran Total</span>
               <span className="text-4xl font-black text-slate-900 tracking-tighter">${totalAmount.toLocaleString()}</span>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setPaymentMethod('efectivo'); setCashReceived(''); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${paymentMethod === 'efectivo' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent'}`}>Efectivo</button>
                <button onClick={() => { setPaymentMethod('transferencia'); setCashReceived(totalAmount); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${paymentMethod === 'transferencia' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent'}`}>Transf.</button>
             </div>

             {paymentMethod === 'efectivo' && (
               <div className="space-y-3 animate-in fade-in">
                 <input 
                  type="number" 
                  className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-black text-lg outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  placeholder="Efectivo Recibido..." 
                  value={cashReceived} 
                  onChange={e => setCashReceived(e.target.value)} 
                 />
                 {Number(cashReceived) >= totalAmount && (
                   <div className="flex justify-between items-center px-2">
                     <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Su cambio</span>
                     <span className="text-xl font-black text-emerald-600 tracking-tighter">${changeDue.toLocaleString()}</span>
                   </div>
                 )}
               </div>
             )}

             <button 
                disabled={cart.length === 0 || processing || (paymentMethod === 'efectivo' && (Number(cashReceived) < totalAmount || cashReceived === ''))} 
                onClick={handleCheckout} 
                className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:opacity-20"
             >
               {processing ? 'Procesando...' : 'Confirmar Venta'}
             </button>
          </div>
        </div>
      </div>

      {/* BOTÓN FLOTANTE MÓVIL */}
      {!showMobileCart && cart.length > 0 && (
        <button 
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-24 left-6 right-6 bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between text-white animate-in slide-in-from-bottom-10"
        >
          <div className="flex items-center gap-4">
            <span className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] font-black">{cart.length}</span>
            <span className="text-xs font-black uppercase tracking-widest">Resumen de Venta</span>
          </div>
          <span className="font-black tracking-tighter text-lg">${totalAmount.toLocaleString()}</span>
        </button>
      )}

      {/* PÁGINA DE CONFIRMACIÓN (RECIBO DIGITAL) */}
      {showOrderSummary && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 lg:p-12 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col md:flex-row h-full max-h-[85vh] lg:max-h-[750px]">
            
            {/* Lado Izquierdo: Estado */}
            <div className="md:w-2/5 bg-emerald-600 p-12 text-white flex flex-col items-center justify-center text-center">
               <div className="w-24 h-24 bg-white/20 rounded-[3rem] flex items-center justify-center text-5xl mb-8 shadow-inner animate-bounce">✓</div>
               <h2 className="text-3xl font-black uppercase tracking-tight mb-2 leading-none">Venta<br/>Exitosa</h2>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Droguería Pro</p>
               <div className="mt-12 w-full pt-12 border-t border-white/10 text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">ID Transacción</p>
                  <p className="font-black text-sm uppercase tracking-widest">#{showOrderSummary.transactionId}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-6 mb-1">Fecha y Hora</p>
                  <p className="font-black text-sm">{showOrderSummary.date}</p>
               </div>
            </div>

            {/* Lado Derecho: Detalle de Productos */}
            <div className="md:w-3/5 p-12 flex flex-col bg-white overflow-hidden">
               <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">Detalle de Factura</h3>
               
               <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                  {showOrderSummary.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-start pb-4 border-b border-slate-50">
                       <div className="flex-1 pr-4">
                          <p className="font-black text-slate-900 text-sm uppercase leading-none mb-1">{item.product.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {item.cantidad} {item.saleMode === 'unidad' ? 'Unidad(es)' : 'Caja(s)'}
                          </p>
                       </div>
                       <p className="font-black text-slate-900 text-sm">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                    </div>
                  ))}
               </div>

               <div className="mt-8 pt-8 border-t-2 border-dashed border-slate-100 space-y-4">
                  <div className="flex justify-between items-center px-2">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Pago</span>
                     <span className="text-[10px] font-black uppercase bg-slate-100 px-3 py-1 rounded-lg">{showOrderSummary.paymentMethod}</span>
                  </div>
                  {showOrderSummary.paymentMethod === 'efectivo' && (
                    <div className="flex justify-between items-center px-2 text-slate-500">
                       <span className="text-[10px] font-black uppercase tracking-widest">Recibido</span>
                       <span className="font-black text-sm">${showOrderSummary.cashReceived.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-2 pt-2">
                     <span className="text-xl font-black text-slate-900 uppercase tracking-tight">Total Cobrado</span>
                     <span className="text-3xl font-black text-emerald-600 tracking-tighter">${showOrderSummary.total.toLocaleString()}</span>
                  </div>
                  {showOrderSummary.paymentMethod === 'efectivo' && (
                    <div className="bg-emerald-50 p-6 rounded-3xl flex justify-between items-center mt-4">
                       <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Cambio Entregado</span>
                       <span className="text-2xl font-black text-emerald-700 tracking-tighter">${showOrderSummary.change.toLocaleString()}</span>
                    </div>
                  )}
               </div>

               <button 
                  onClick={() => setShowOrderSummary(null)}
                  className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl mt-8 hover:bg-slate-800 transition-all active:scale-95"
               >
                 Nueva Venta
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
