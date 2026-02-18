
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
  unitsPerBox: number;
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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (searchInputRef.current) searchInputRef.current.focus();
    return () => stopScanner();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: productsData } = await supabase
        .from('productos')
        .select('*')
        .gt('stock', 0)
        .order('nombre');
      
      const { data: discountsData } = await supabase
        .from('descuentos')
        .select('*')
        .eq('activo', true);

      if (productsData) {
        const mergedProducts = productsData.map(p => ({
          ...p,
          // Aseguramos que unidades_por_caja tenga un valor mínimo de 1 para evitar divisiones por cero
          unidades_por_caja: p.unidades_por_caja || 1, 
          descuentos: discountsData?.filter(d => d.producto_id === p.id) || []
        }));

        setProducts(mergedProducts);

        setSaleModes(prev => {
          const next = { ...prev };
          mergedProducts.forEach(p => {
            // Por defecto caja si tiene, si no unidad
            if (!next[p.id]) next[p.id] = 'caja';
          });
          return next;
        });
      }
    } catch (error) {
      console.error("Error cargando inventario POS:", error);
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128'] });
          scanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current?.readyState === 4) {
              const codes = await barcodeDetector.detect(videoRef.current);
              if (codes.length > 0) {
                const codeValue = codes[0].rawValue;
                setSearchTerm(codeValue);
                const found = products.find(p => p.codigo_barras === codeValue);
                if (found) addToCart(found);
                stopScanner();
              }
            }
          }, 500);
        }
      }
    } catch (err) {
      setIsScanning(false);
      alert("Permiso de cámara denegado.");
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setIsScanning(false);
  };

  // Calcula cuántas unidades de este producto ya están "comprometidas" en el carrito
  const getReservedUnits = (productId: number) => {
    return cart
      .filter(item => item.product.id === productId)
      .reduce((acc, item) => acc + (item.cantidad * (item.saleMode === 'caja' ? item.unitsPerBox : 1)), 0);
  };

  const getDiscountPercentage = (product: Producto): number => {
    if (product.descuentos && product.descuentos.length > 0) {
      const bestDiscount = product.descuentos.reduce((max, curr) => (curr.porcentaje > max.porcentaje ? curr : max));
      return Number(bestDiscount.porcentaje);
    }
    return 0;
  };

  const addToCart = (product: Producto) => {
    const mode = product.tipo === 'pastillas' ? (saleModes[product.id] || 'caja') : 'caja';
    const unitsPerBox = product.unidades_por_caja || 1;
    
    // Validar Stock Disponible
    const currentReserved = getReservedUnits(product.id);
    const quantityToDeduct = mode === 'caja' ? unitsPerBox : 1;
    
    if ((currentReserved + quantityToDeduct) > product.stock) {
        alert(`Stock insuficiente. Disponibles: ${product.stock - currentReserved} unidades.`);
        return;
    }

    const basePrice = mode === 'unidad' 
      ? (Number(product.precio_unidad) || 0) 
      : (Number(product.precio) || 0);
      
    const discountPercent = getDiscountPercentage(product);
    const finalPrice = basePrice * (1 - discountPercent / 100);
    
    const existingIndex = cart.findIndex(item => item.product.id === product.id && item.saleMode === mode);
    
    if (existingIndex >= 0) {
       // Actualizar cantidad existente
       const newCart = [...cart];
       newCart[existingIndex].cantidad += 1;
       setCart(newCart);
    } else {
      setCart([...cart, { 
        product, 
        cantidad: 1, 
        saleMode: mode, 
        originalPrice: basePrice, 
        finalPrice, 
        discountApplied: discountPercent,
        unitsPerBox
      }]);
    }
  };

  const updateQuantity = (productId: number, mode: string, delta: number) => {
    setCart(prev => {
        const itemIndex = prev.findIndex(item => item.product.id === productId && item.saleMode === mode);
        if (itemIndex === -1) return prev;

        const currentItem = prev[itemIndex];
        const newQty = currentItem.cantidad + delta;

        if (newQty <= 0) {
            return prev.filter((_, i) => i !== itemIndex);
        }

        // Validación de Stock al incrementar
        if (delta > 0) {
             const product = currentItem.product;
             const unitsNeeded = (mode === 'caja' ? currentItem.unitsPerBox : 1);
             // Calcular todo lo reservado EXCLUYENDO la cantidad actual de ESTE item para recalcular con el nuevo valor
             const otherReserved = prev
                .filter((i, idx) => idx !== itemIndex && i.product.id === productId)
                .reduce((acc, i) => acc + (i.cantidad * (i.saleMode === 'caja' ? i.unitsPerBox : 1)), 0);
             
             const totalAfterUpdate = otherReserved + (newQty * unitsNeeded);

             if (totalAfterUpdate > product.stock) {
                 alert("Stock máximo alcanzado para este producto.");
                 return prev;
             }
        }

        const newCart = [...prev];
        newCart[itemIndex] = { ...currentItem, cantidad: newQty };
        return newCart;
    });
  };

  const removeFromCart = (productId: number, mode: string) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.saleMode === mode)));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.finalPrice * item.cantidad), 0);
  const changeDue = (Number(cashReceived) || 0) - totalAmount;

  const handleCheckout = async () => {
    if (cart.length === 0 || processing) return;
    if (paymentMethod === 'efectivo' && (!cashReceived || Number(cashReceived) < totalAmount)) {
      alert("Monto recibido insuficiente");
      return;
    }
    
    setProcessing(true);
    try {
      const transactionId = crypto.randomUUID();
      const salesToInsert = cart.map(item => ({
        usuario_id: user.id,
        producto_id: item.product.id,
        cantidad: item.cantidad,
        total: item.finalPrice * item.cantidad,
        metodo_pago: paymentMethod,
        dinero_recibido: paymentMethod === 'efectivo' ? Number(cashReceived) : totalAmount,
        cambio: paymentMethod === 'efectivo' ? changeDue : 0,
        es_unidad: item.saleMode === 'unidad',
        transaccion_id: transactionId
      }));

      const { error: saleError } = await supabase.from('ventas').insert(salesToInsert);
      if (saleError) throw saleError;

      // Descontar del inventario (unidades atómicas)
      for (const item of cart) {
        const qtyToDeduct = item.cantidad * (item.saleMode === 'caja' ? item.unitsPerBox : 1);
        await supabase.rpc('deduct_stock', { p_id: item.product.id, p_qty: qtyToDeduct });
      }

      setShowOrderSummary({ 
        transactionId: transactionId.split('-')[0].toUpperCase(), 
        items: [...cart], 
        total: totalAmount, 
        paymentMethod, 
        cashReceived: paymentMethod === 'efectivo' ? Number(cashReceived) : totalAmount, 
        change: paymentMethod === 'efectivo' ? changeDue : 0, 
        date: new Date().toLocaleString() 
      });
      setCart([]);
      setCashReceived('');
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
    p.laboratorio?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative lg:h-[calc(100vh-140px)] h-auto animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* PANEL IZQUIERDO: BÚSQUEDA Y PRODUCTOS */}
        <div className="lg:col-span-7 flex flex-col space-y-4 lg:h-full min-h-[500px]">
          <div className="relative group shrink-0">
            <input
              ref={searchInputRef}
              className="w-full pl-14 pr-20 py-5 bg-white border-2 border-slate-100 rounded-[2rem] outline-none font-bold text-lg shadow-sm focus:border-emerald-500 transition-all placeholder:text-slate-300"
              placeholder="Buscar por nombre, lab o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
               <button onClick={startScanner} className="bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:overflow-y-auto custom-scrollbar flex-1 pb-20 pr-1">
            {filteredProducts.map(product => {
              const mode = saleModes[product.id] || 'caja';
              const unitsPerBox = product.unidades_por_caja || 1;
              
              // Calcular Stock Real Disponible (Total - En Carrito)
              const reserved = getReservedUnits(product.id);
              const effectiveStock = Math.max(0, product.stock - reserved);
              
              const boxesAvailable = Math.floor(effectiveStock / unitsPerBox);
              const unitsAvailable = effectiveStock % unitsPerBox;

              const basePrice = mode === 'unidad' 
                ? (Number(product.precio_unidad) || 0)
                : (Number(product.precio) || 0);
                
              const discountPercent = getDiscountPercentage(product);
              const finalPrice = basePrice * (1 - discountPercent / 100);

              return (
                <div key={product.id} className={`bg-white p-5 rounded-[2rem] border-2 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between relative overflow-hidden ${discountPercent > 0 ? 'border-rose-100 shadow-md' : 'border-slate-50'}`}>
                  {discountPercent > 0 && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white px-3 py-1.5 rounded-bl-2xl font-black text-[9px] uppercase tracking-widest shadow-lg animate-pulse z-10">
                      -{Math.round(discountPercent)}%
                    </div>
                  )}

                  <div>
                    <h4 className="font-black text-slate-900 text-xs uppercase leading-tight pr-2 mb-1 truncate">{product.nombre}</h4>
                    
                    <p className="text-[9px] text-slate-400 font-medium mb-2 line-clamp-2 leading-relaxed lowercase first-letter:uppercase">
                      {product.descripcion || 'Sin descripción detallada'}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                       <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase whitespace-nowrap border border-indigo-100">{product.laboratorio || 'S/L'}</span>
                       <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-tight">📍 {product.ubicacion || '---'}</span>
                       </div>
                    </div>

                    <div className={`flex items-center gap-2 mb-3 p-2 rounded-xl border ${effectiveStock <= (unitsPerBox * 2) ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                       <span className={`w-2 h-2 rounded-full ${effectiveStock < (unitsPerBox * 2) ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                       <div className="flex flex-col w-full">
                          <div className="flex justify-between items-center w-full">
                             <p className="text-[9px] font-black text-slate-600 uppercase tracking-tight">
                               Disp: {effectiveStock} Unid
                             </p>
                             {product.tipo === 'pastillas' && (
                                <span className="text-[8px] font-bold text-indigo-500 uppercase">
                                   (1 Caja = {unitsPerBox}u)
                                </span>
                             )}
                          </div>
                          {product.tipo === 'pastillas' ? (
                             <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight mt-0.5">
                               {boxesAvailable} Cajas / {unitsAvailable} Unid
                             </p>
                          ) : (
                             <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden w-full">
                                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (effectiveStock / 50) * 100)}%` }}></div>
                             </div>
                          )}
                       </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                      <div className="flex flex-col">
                        {discountPercent > 0 ? (
                          <>
                            <p className="text-[10px] text-slate-400 line-through font-bold decoration-slate-300 mb-0.5">${basePrice.toLocaleString()}</p>
                            <p className="font-black text-emerald-600 text-lg tracking-tighter leading-none">${finalPrice.toLocaleString()}</p>
                          </>
                        ) : (
                          <>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">Precio</span>
                            <p className="font-black text-slate-900 text-lg tracking-tighter leading-none">${basePrice.toLocaleString()}</p>
                          </>
                        )}
                      </div>
                      
                      {product.tipo === 'pastillas' && (
                        <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-inner h-fit">
                          <button onClick={() => setSaleModes({...saleModes, [product.id]: 'caja'})} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${mode === 'caja' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Caja</button>
                          <button onClick={() => setSaleModes({...saleModes, [product.id]: 'unidad'})} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${mode === 'unidad' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Unid</button>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => addToCart(product)} 
                      disabled={effectiveStock <= 0}
                      className="w-full py-3 bg-slate-950 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:active:scale-100"
                    >
                      {effectiveStock > 0 ? '+ Agregar' : 'Agotado'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: CARRITO Y PAGO - ESTRUCTURA FIJA */}
        <div className="lg:col-span-5 flex flex-col bg-white lg:rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden h-full rounded-t-[2.5rem] mt-4 lg:mt-0">
          
          {/* HEADER CON TOTAL GRANDE PARA AHORRAR ESPACIO ABAJO */}
          <div className="p-5 bg-slate-900 text-white shrink-0 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total a Pagar</span>
                <p className="text-4xl font-black text-white tracking-tighter leading-none mt-1">${totalAmount.toLocaleString()}</p>
              </div>
               <div className="flex flex-col items-end gap-2">
                 <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">
                    {cart.length} Items
                 </span>
                 <button onClick={() => setCart([])} className="text-rose-400 hover:text-white text-[9px] font-black uppercase tracking-widest hover:underline">
                    Vaciar
                 </button>
               </div>
            </div>
          </div>

          {/* LISTA DE ITEMS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                 <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                 <p className="font-black uppercase text-[9px] tracking-widest">Carrito Vacío</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between animate-in slide-in-from-right-4">
                <div className="flex-1 min-w-0 pr-3">
                  <h5 className="font-black text-slate-900 text-[11px] uppercase truncate leading-none mb-1">{item.product.nombre}</h5>
                  <div className="flex items-center gap-2 mt-0.5">
                     {item.discountApplied > 0 ? (
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{item.saleMode}</span>
                            <span className="text-[9px] text-slate-400 line-through font-bold decoration-rose-400">${item.originalPrice.toLocaleString()}</span>
                            <span className="text-[10px] text-emerald-600 font-black">${item.finalPrice.toLocaleString()}</span>
                        </div>
                     ) : (
                        <p className="text-[10px] text-indigo-600 font-black uppercase tracking-tight">{item.saleMode} • ${item.finalPrice.toLocaleString()}</p>
                     )}
                     {item.discountApplied > 0 && (
                      <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter border border-rose-200">
                        -{Math.round(item.discountApplied)}%
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="flex items-center bg-slate-100 rounded-lg p-0.5 px-1 border border-slate-200">
                       <button onClick={() => updateQuantity(item.product.id, item.saleMode, -1)} className="w-5 h-5 flex items-center justify-center text-slate-500 font-black hover:text-rose-600"> - </button>
                       <span className="w-5 text-center font-black text-slate-900 text-xs">{item.cantidad}</span>
                       <button onClick={() => updateQuantity(item.product.id, item.saleMode, 1)} className="w-5 h-5 flex items-center justify-center text-slate-500 font-black hover:text-emerald-600"> + </button>
                   </div>
                   <button onClick={() => removeFromCart(item.product.id, item.saleMode)} className="w-6 h-6 flex items-center justify-center text-rose-400 hover:text-rose-600 bg-rose-50 rounded-lg">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                   </button>
                </div>
              </div>
            ))}
          </div>

          {/* ÁREA DE PAGO COMPACTA */}
          <div className="p-4 bg-white border-t border-slate-100 space-y-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('efectivo')} 
                  className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === 'efectivo' 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                    : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg">💵</span>
                  Efectivo
                </button>
                <button 
                  onClick={() => setPaymentMethod('transferencia')} 
                  className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    paymentMethod === 'transferencia' 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                    : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg">📱</span>
                  Transferencia
                </button>
             </div>

             {paymentMethod === 'efectivo' && (
               <div className="animate-in slide-in-from-bottom-2 fade-in">
                  <div className="relative mb-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                    <input 
                      type="number" 
                      className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-slate-100 font-black text-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all bg-slate-50 text-slate-900 placeholder:text-slate-300" 
                      placeholder="RECIBIDO" 
                      value={cashReceived} 
                      onChange={e => setCashReceived(e.target.value)} 
                    />
                  </div>
                  
                  {Number(cashReceived) >= totalAmount && Number(cashReceived) > 0 && (
                    <div className="flex justify-between items-center px-3 py-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Cambio:</span>
                      <span className="text-xl font-black text-emerald-600 tracking-tighter">${changeDue.toLocaleString()}</span>
                    </div>
                  )}
               </div>
             )}

             <button 
                disabled={cart.length === 0 || processing || (paymentMethod === 'efectivo' && (Number(cashReceived) < totalAmount || cashReceived === ''))} 
                onClick={handleCheckout} 
                className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none ${
                  paymentMethod === 'efectivo' ? 'bg-slate-900 text-white hover:bg-emerald-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {processing ? '...' : 'COBRAR'}
              </button>
          </div>
        </div>
      </div>

      {/* MODAL SCANNER */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-emerald-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-emerald-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-emerald-500 animate-scan shadow-[0_0_15px_#10b981]"></div>
                </div>
             </div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-white text-slate-900 px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-rose-500 hover:text-white transition-all">Cancelar Escaneo</button>
          <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
        </div>
      )}

      {/* RESUMEN DE ÉXITO */}
      {showOrderSummary && (
        <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col p-8 lg:p-12 max-h-[90vh]">
            <div className="text-center mb-8 shrink-0">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-3xl mb-4 mx-auto shadow-xl shadow-emerald-200">✓</div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">Venta Exitosa</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">#{showOrderSummary.transactionId}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-8 pr-2 custom-scrollbar bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {showOrderSummary.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                   <div>
                      <p className="font-black text-slate-900 text-[11px] uppercase">{item.product.nombre}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] text-slate-500 font-bold uppercase">{item.cantidad} {item.saleMode}(s)</p>
                        {item.discountApplied > 0 && (
                          <span className="text-[9px] text-slate-400 font-bold uppercase line-through decoration-rose-400">
                            ${(item.originalPrice * item.cantidad).toLocaleString()}
                          </span>
                        )}
                      </div>
                   </div>
                   <p className="font-black text-slate-900 text-base tracking-tighter">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-6">
              <div className="flex justify-between items-end px-2">
                <div className="text-left">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Cobrado</span>
                   <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">${showOrderSummary.total.toLocaleString()}</p>
                </div>
                {showOrderSummary.paymentMethod === 'efectivo' && (
                  <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Cambio</span>
                    <p className="text-3xl font-black text-emerald-600 tracking-tighter">${showOrderSummary.change.toLocaleString()}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setShowOrderSummary(null)} className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:bg-emerald-600 transition-all active:scale-95">Nueva Venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
