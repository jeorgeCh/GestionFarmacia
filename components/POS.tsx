
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Producto, Usuario } from '../types';

interface ProductCardProps {
  product: Producto;
  saleMode: 'caja' | 'unidad';
  onAddToCart: (product: Producto) => void;
  onSetSaleMode: (productId: number, mode: 'caja' | 'unidad') => void;
  getReservedUnits: (productId: number) => number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, saleMode, onAddToCart, onSetSaleMode, getReservedUnits }) => {
  const unitsPerBox = product.unidades_por_caja || 1;
  const mode = unitsPerBox === 1 ? 'unidad' : saleMode;

  const reservedInUnits = getReservedUnits(product.id);
  const effectiveStockInUnits = Math.max(0, (product.stock || 0) - reservedInUnits);
  
  const boxesAvailable = Math.floor(effectiveStockInUnits / unitsPerBox);
  const unitsAvailable = effectiveStockInUnits % unitsPerBox;

  const getDiscountPercentage = (p: Producto): number => {
    if (p.descuentos && p.descuentos.length > 0) {
      return Number(p.descuentos[0].porcentaje);
    }
    return 0;
  };

  const discountPercent = getDiscountPercentage(product);
  const basePrice = mode === 'unidad' ? (Number(product.precio_unidad) || 0) : (Number(product.precio) || 0);
  const finalPrice = basePrice * (1 - discountPercent / 100);

  return (
    <div className={`bg-white p-4 rounded-[1.5rem] border-2 transition-all group flex flex-col justify-between relative overflow-hidden shadow-sm ${discountPercent > 0 ? 'border-emerald-400/70' : 'border-slate-100 hover:border-indigo-400'}`}>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[90px]">{product.laboratorio || 'Generico'}</span>
            {unitsPerBox > 1 && (
                  <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                    Caja x {unitsPerBox}
                  </span>
            )}
        </div>
        <h4 className="font-black text-slate-800 text-sm uppercase leading-tight h-10 flex items-center" title={product.nombre}>{product.nombre}</h4>
        <div className="flex items-center gap-1.5 text-slate-400 mt-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">{product.ubicacion || 'Sin Ubicar'}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
            <div className="flex justify-between items-end mb-1">
                <span className="text-[8px] font-bold text-slate-400 uppercase">Disponible</span>
                <span className={`text-[9px] font-black uppercase ${effectiveStockInUnits < 10 ? 'text-rose-500' : 'text-slate-600'}`}>
                    {unitsPerBox > 1 
                        ? `${boxesAvailable} Cajas / ${unitsAvailable} Und` 
                        : `${effectiveStockInUnits} Unidades`
                    }
                </span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden bg-slate-100`}>
              <div 
                  className={`h-full rounded-full ${effectiveStockInUnits < 10 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                  style={{width: `${Math.min((effectiveStockInUnits / (product.stock || 1)) * 100, 100)}%`}}
              ></div>
            </div>
        </div>

        <div className={`flex items-center justify-between p-2 rounded-xl border ${discountPercent > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex-1 flex flex-col pr-2 overflow-hidden">
                <span className={`text-[8px] font-black uppercase mb-0.5 ${discountPercent > 0 ? 'text-emerald-800' : 'text-slate-400'}`}>
                    {discountPercent > 0 ? 'Precio Oferta' : 'Precio'}
                </span>
                {discountPercent > 0 ? (
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-emerald-600 leading-none">${finalPrice.toLocaleString()}</span>
                        <span className="text-[11px] font-bold text-rose-400 line-through leading-none">${basePrice.toLocaleString()}</span>
                    </div>
                ) : (
                    <span className="text-lg font-black text-slate-900 leading-none">${finalPrice.toLocaleString()}</span>
                )}
            </div>
            
            {unitsPerBox > 1 ? (
                <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-200 shrink-0">
                    <button onClick={() => onSetSaleMode(product.id, 'unidad')} className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${mode === 'unidad' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>Und</button>
                    <button onClick={() => onSetSaleMode(product.id, 'caja')} className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${mode === 'caja' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}>Caja</button>
                </div>
            ) : (
                <div className="p-0.5 shrink-0">
                    <span className="px-3 py-1.5 rounded-md text-[8px] font-black uppercase bg-slate-100 text-slate-400 border border-slate-200">Individual</span>
                </div>
            )}
        </div>

        <button 
            onClick={() => onAddToCart(product)} 
            disabled={effectiveStockInUnits <= 0 || (mode === 'caja' && effectiveStockInUnits < unitsPerBox)} 
            className="w-full py-2.5 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-1">
            {effectiveStockInUnits <= 0 ? 'Agotado' : (mode === 'caja' && effectiveStockInUnits < unitsPerBox) ? 'Incompleto' : <>Agregar <span className="text-emerald-400">+</span></>}
        </button>
      </div>
    </div>
  );
};


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
  const [allProducts, setAllProducts] = useState<Producto[]>([]);
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
    fetchData();
    if (searchInputRef.current) searchInputRef.current.focus();
    return () => stopScanner();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, discountsRes] = await Promise.all([
          supabase.from('productos').select('*').gt('stock', 0),
          supabase.from('descuentos').select('*').eq('activo', true)
      ]);

      const productsData = productsRes.data || [];
      const discountsData = discountsRes.data || [];

      const productsWithDetails = productsData.map(p => ({
        ...p,
        unidades_por_caja: p.unidades_por_caja || 1, 
        descuentos: discountsData?.filter(d => d.producto_id === p.id) || [],
      }));

      setAllProducts(productsWithDetails);

      setSaleModes(prev => {
        const next = { ...prev };
        productsData.forEach(p => {
          if (!next[p.id]) next[p.id] = 'unidad';
        });
        return next;
      });

    } catch (error) {
      console.error("Error cargando datos para POS:", error);
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
                const found = allProducts.find(p => p.codigo_barras === codeValue);
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
    const unitsPerBox = product.unidades_por_caja || 1;
    const mode = unitsPerBox === 1 ? 'unidad' : (saleModes[product.id] || 'unidad');
    
    const currentReserved = getReservedUnits(product.id);
    const quantityInUnitsToDeduct = mode === 'caja' ? unitsPerBox : 1;
    
    if ((currentReserved + quantityInUnitsToDeduct) > (product.stock || 0)) {
        alert(`Stock insuficiente. Disponibles: ${(product.stock || 0) - currentReserved} unidades.`);
        return;
    }

    const basePrice = mode === 'unidad' 
      ? (Number(product.precio_unidad) || 0) 
      : (Number(product.precio) || 0);
      
    const discountPercent = getDiscountPercentage(product);
    const finalPrice = basePrice * (1 - discountPercent / 100);
    
    const existingIndex = cart.findIndex(item => item.product.id === product.id && item.saleMode === mode);
    
    if (existingIndex >= 0) {
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

        if (delta > 0) {
             const product = currentItem.product;
             const unitsNeededPerItem = (mode === 'caja' ? currentItem.unitsPerBox : 1);
             const otherReservedInUnits = prev
                .filter((i, idx) => idx !== itemIndex && i.product.id === productId)
                .reduce((acc, i) => acc + (i.cantidad * (i.saleMode === 'caja' ? i.unitsPerBox : 1)), 0);
             
             const totalAfterUpdateInUnits = otherReservedInUnits + (newQty * unitsNeededPerItem);

             if (totalAfterUpdateInUnits > (product.stock || 0)) {
                 alert("Stock máximo alcanzado.");
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
    
    const userId = Number(user?.id);
    if (!userId) {
      alert("Sesión inválida.");
      return;
    }

    if (paymentMethod === 'efectivo' && (!cashReceived || Number(cashReceived) < totalAmount)) {
      alert("Monto recibido insuficiente");
      return;
    }
    
    setProcessing(true);
    try {
      const transactionId = crypto.randomUUID();
      const salesToInsert = cart.map(item => ({
        usuario_id: userId,
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

      for (const item of cart) {
        const qtyToDeductInUnits = item.cantidad * (item.saleMode === 'caja' ? item.unitsPerBox : 1);
        await supabase.rpc('deduct_stock', { p_id: item.product.id, p_qty: qtyToDeductInUnits });
      }

      await supabase.from('audit_logs').insert({
          usuario_id: userId,
          accion: 'VENTA',
          modulo: 'POS',
          detalles: `Ticket #${transactionId.split('-')[0].toUpperCase()} - Total: $${totalAmount.toLocaleString()} - ${cart.length} items`
      });

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
      fetchData();
    } catch (err: any) {
      console.error("Error en venta:", err);
      alert("Error al procesar la venta.");
    } finally {
      setProcessing(false);
    }
  };

  const productsToDisplay = useMemo(() => {
    if (!searchTerm) {
        return [];
    }
    const filtered = allProducts.filter(p => 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.codigo_barras && p.codigo_barras.includes(searchTerm)) ||
      (p.laboratorio && p.laboratorio.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    return filtered.slice(0, 6);
  }, [searchTerm, allProducts]);

  return (
    <div className="relative lg:h-[calc(100vh-140px)] h-auto animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        <div className="lg:col-span-7 flex flex-col space-y-4 lg:h-full min-h-[500px]">
          <div className="relative group shrink-0">
            <input
              ref={searchInputRef}
              className="w-full pl-14 pr-20 py-5 bg-white border-2 border-slate-100 rounded-[2rem] outline-none font-bold text-lg shadow-sm focus:border-emerald-500 transition-all placeholder:text-slate-300"
              placeholder="Buscar medicamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
               <button onClick={startScanner} className="bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${searchTerm ? 'xl:grid-cols-2' : 'xl:grid-cols-3'} gap-3 lg:overflow-y-auto custom-scrollbar flex-1 pb-20 pr-1 content-start`}>
            {productsToDisplay.map(product => (
              <ProductCard 
                key={product.id}
                product={product}
                saleMode={saleModes[product.id] || 'unidad'}
                onAddToCart={addToCart}
                onSetSaleMode={(pid: number, mode: 'caja' | 'unidad') => setSaleModes({...saleModes, [pid]: mode})}
                getReservedUnits={getReservedUnits}
              />
            ))}
            {productsToDisplay.length === 0 && (
                <div className="col-span-full h-full flex items-center justify-center opacity-30 text-center">
                    {searchTerm ? (
                        <p className="font-black text-slate-400 uppercase text-xs tracking-widest">No se encontraron productos.</p>
                    ) : (
                        <div>
                            <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <p className="font-black text-slate-400 uppercase text-sm tracking-widest">Busca un producto para empezar</p>
                            <p className="text-slate-400 text-xs mt-1 font-bold">Usa el nombre, laboratorio o código de barras.</p>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col bg-white lg:rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden h-full rounded-t-[2.5rem] mt-4 lg:mt-0">
          <div className="p-5 bg-slate-900 text-white shrink-0 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Venta</span>
                <p className="text-4xl font-black text-white tracking-tighter leading-none mt-1">${totalAmount.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                 <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">{cart.length} Items</span>
                 <button onClick={() => setCart([])} className="text-rose-400 hover:text-white text-[9px] font-black uppercase tracking-widest hover:underline">Vaciar</button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                 <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                 <p className="font-black uppercase text-[9px] tracking-widest text-center">Selecciona productos para iniciar la venta</p>
              </div>
            ) : cart.map((item, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between animate-in slide-in-from-right-4">
                <div className="flex-1 min-w-0 pr-3">
                  <h5 className="font-black text-slate-900 text-[11px] uppercase truncate leading-none mb-1">{item.product.nombre}</h5>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.saleMode === 'caja' ? 'bg-slate-100 text-slate-900' : 'bg-indigo-50 text-indigo-600'}`}>
                      {item.saleMode}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold tracking-tight">${item.finalPrice.toLocaleString()} {item.saleMode === 'unidad' ? 'unid' : 'caja'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center bg-slate-100 rounded-lg p-0.5 px-1 border border-slate-200">
                       <button onClick={() => updateQuantity(item.product.id, item.saleMode, -1)} className="w-6 h-6 flex items-center justify-center text-slate-500 font-black"> - </button>
                       <span className="w-8 text-center font-black text-slate-900 text-xs">{item.cantidad}</span>
                       <button onClick={() => updateQuantity(item.product.id, item.saleMode, 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 font-black"> + </button>
                   </div>
                   <button onClick={() => removeFromCart(item.product.id, item.saleMode)} className="w-8 h-8 flex items-center justify-center text-rose-400 bg-rose-50 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-white border-t border-slate-100 space-y-3 shrink-0 shadow-lg z-20">
             <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMethod('efectivo')} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all flex flex-col items-center justify-center gap-1 ${paymentMethod === 'efectivo' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}>💵 Efectivo</button>
                <button onClick={() => setPaymentMethod('transferencia')} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all flex flex-col items-center justify-center gap-1 ${paymentMethod === 'transferencia' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}>📱 Transf.</button>
             </div>
             {paymentMethod === 'efectivo' && (
               <div className="animate-in slide-in-from-bottom-2 fade-in">
                  <div className="relative mb-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                    <input type="number" className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-slate-100 font-black text-xl outline-none focus:border-emerald-500 bg-slate-50" placeholder="PAGA CON" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
                  </div>
                  {Number(cashReceived) >= totalAmount && (
                    <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100"><span className="text-[10px] font-black text-emerald-600 uppercase">Cambio:</span><span className="text-xl font-black text-emerald-600">`${changeDue.toLocaleString()}`</span></div>
                  )}
               </div>
             )}
             <button disabled={cart.length === 0 || processing || (paymentMethod === 'efectivo' && (Number(cashReceived) < totalAmount || cashReceived === ''))} onClick={handleCheckout} className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-slate-900 text-white hover:bg-emerald-600 shadow-xl disabled:opacity-50">{processing ? 'Procesando...' : 'FINALIZAR VENTA'}</button>
          </div>
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-emerald-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center"><div className="w-64 h-64 border-2 border-emerald-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-emerald-500 animate-scan"></div></div></div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-white text-slate-900 px-12 py-5 rounded-full font-black text-xs uppercase shadow-2xl">Cancelar Escaneo</button>
          <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
        </div>
      )}

      {showOrderSummary && (
        <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col p-8 lg:p-12 max-h-[90vh]">
            <div className="text-center mb-8 shrink-0">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-3xl mb-4 mx-auto shadow-xl">✓</div>
              <h2 className="text-3xl font-black uppercase text-slate-900">Venta Exitosa</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">#{showOrderSummary.transactionId}</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-8 pr-2 custom-scrollbar bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {showOrderSummary.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-200/50 last:border-0">
                   <div><p className="font-black text-slate-900 text-[11px] uppercase">{item.product.nombre}</p><p className="text-[9px] text-slate-500 font-bold uppercase">{item.cantidad} {item.saleMode}(s)</p></div>
                   <p className="font-black text-slate-900 text-base tracking-tighter">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="shrink-0 space-y-6">
              <div className="flex justify-between items-end px-2"><div><span className="text-[10px] font-black text-slate-400 uppercase">Total Cobrado</span><p className="text-5xl font-black text-slate-900 tracking-tighter leading-none mt-1">${showOrderSummary.total.toLocaleString()}</p></div>{showOrderSummary.paymentMethod === 'efectivo' && (<div><span className="text-[10px] font-black text-emerald-600 uppercase">Cambio</span><p className="text-3xl font-black text-emerald-600 tracking-tighter">${showOrderSummary.change.toLocaleString()}</p></div>)}</div>
              <button onClick={() => setShowOrderSummary(null)} className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black text-[11px] uppercase shadow-2xl hover:bg-emerald-600 transition-all active:scale-95">Nueva Venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
