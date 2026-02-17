
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
  
  // Estados para el Escáner
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    if (searchInputRef.current) searchInputRef.current.focus();
    return () => stopScanner();
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

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        
        // Iniciar detección
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a']
          });

          scanIntervalRef.current = window.setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  handleBarcodeDetected(code);
                }
              } catch (e) {
                console.error("Barcode detection error:", e);
              }
            }
          }, 500);
        } else {
          console.warn("BarcodeDetector no soportado en este navegador.");
        }
      }
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      alert("No se pudo acceder a la cámara");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const handleBarcodeDetected = (code: string) => {
    const product = products.find(p => p.codigo_barras === code);
    if (product) {
      addToCart(product);
      stopScanner();
      // Pequeña vibración si el dispositivo lo soporta
      if (navigator.vibrate) navigator.vibrate(200);
    } else {
      setSearchTerm(code);
      stopScanner();
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
          <div className="relative group flex items-center gap-3">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                className="w-full px-14 py-6 bg-white border-2 border-slate-100 rounded-[2.5rem] outline-none font-bold text-lg shadow-sm focus:border-emerald-500 transition-all"
                placeholder="Escribe o escanea..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </span>
            </div>
            <button 
              onClick={startScanner}
              className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center shadow-lg active:scale-90 transition-all"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
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

      {/* MODAL ESCÁNER */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[3rem] overflow-hidden border-4 border-emerald-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-emerald-500 rounded-3xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)] animate-scan-line"></div>
                </div>
             </div>
             <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-white font-black uppercase text-[10px] tracking-widest bg-black/50 px-6 py-2 rounded-full inline-block">Alinea el código de barras</p>
             </div>
          </div>
          <button 
            onClick={stopScanner}
            className="mt-12 bg-white/10 hover:bg-rose-500 text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest backdrop-blur-md transition-all"
          >
            Cancelar Escaneo
          </button>
          <style>{`
            @keyframes scan-line {
              0% { top: 0; }
              100% { top: 100%; }
            }
            .animate-scan-line { animation: scan-line 2s infinite ease-in-out; }
          `}</style>
        </div>
      )}

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

      {/* PÁGINA DE CONFIRMACIÓN (RECIBO DIGITAL ESTÉTICO) */}
      {showOrderSummary && (
        <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-4xl rounded-[4.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.4)] animate-in zoom-in-95 flex flex-col md:flex-row h-full max-h-[90vh]">
            
            {/* Lado Izquierdo: Diseño de Factura */}
            <div className="md:w-[45%] bg-slate-900 p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
               <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
               
               <div>
                 <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white text-4xl mb-10 shadow-2xl shadow-emerald-500/20 animate-in slide-in-from-top-10">✓</div>
                 <h2 className="text-5xl font-black uppercase tracking-tighter leading-[0.9] mb-4">Venta<br/><span className="text-emerald-500">Completada</span></h2>
                 <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Droguería Pro v3.0</p>
               </div>

               <div className="space-y-8 pt-10 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-8">
                     <div>
                       <p className="text-slate-500 font-black uppercase text-[8px] tracking-widest mb-1">ID Transacción</p>
                       <p className="font-black text-sm text-indigo-400">#{showOrderSummary.transactionId}</p>
                     </div>
                     <div>
                       <p className="text-slate-500 font-black uppercase text-[8px] tracking-widest mb-1">Método</p>
                       <p className="font-black text-sm uppercase">{showOrderSummary.paymentMethod}</p>
                     </div>
                  </div>
                  <div>
                    <p className="text-slate-500 font-black uppercase text-[8px] tracking-widest mb-1">Fecha de Operación</p>
                    <p className="font-black text-sm">{showOrderSummary.date}</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                     <p className="text-slate-500 font-black uppercase text-[8px] tracking-widest mb-2">Resumen de Pago</p>
                     <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Recibido</p>
                          <p className="font-black text-xl">${showOrderSummary.cashReceived.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1">Cambio</p>
                          <p className="font-black text-3xl text-emerald-500Tracking-tighter">${showOrderSummary.change.toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Lado Derecho: Lista de Productos y Acción */}
            <div className="md:w-[55%] p-12 lg:p-16 flex flex-col bg-white overflow-hidden">
               <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Detalle de Productos</h3>
                 <span className="bg-slate-100 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">{showOrderSummary.items.length} Items</span>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-5 pr-4 custom-scrollbar">
                  {showOrderSummary.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center pb-5 border-b border-slate-50 animate-in slide-in-from-right-10" style={{ animationDelay: `${i * 100}ms` }}>
                       <div className="flex-1 pr-6">
                          <p className="font-black text-slate-900 text-base uppercase leading-tight mb-1">{item.product.nombre}</p>
                          <div className="flex gap-3">
                             <span className="text-[10px] text-slate-400 font-bold">CANT: {item.cantidad}</span>
                             <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{item.saleMode}</span>
                          </div>
                       </div>
                       <p className="font-black text-slate-900 text-lg tracking-tighter">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                    </div>
                  ))}
               </div>

               <div className="mt-12 pt-10 border-t-4 border-dashed border-slate-100 space-y-10">
                  <div className="flex justify-between items-end px-2">
                     <div>
                       <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] block mb-2">Total Factura</span>
                       <span className="text-6xl font-black text-slate-950 tracking-tighter">${showOrderSummary.total.toLocaleString()}</span>
                     </div>
                     <div className="text-right">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impuestos Incl.</p>
                       <p className="text-xs font-black text-emerald-600 uppercase">Cerrado</p>
                     </div>
                  </div>

                  <button 
                    onClick={() => setShowOrderSummary(null)}
                    className="w-full py-8 bg-slate-950 text-white rounded-[2.8rem] font-black text-sm uppercase tracking-[0.4em] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] hover:bg-emerald-600 transition-all active:scale-95 group flex items-center justify-center gap-4"
                  >
                    Nueva Transacción
                    <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
