
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
  
  // Cámara
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const addToCart = (product: Producto) => {
    const mode = product.tipo === 'pastillas' ? (saleModes[product.id] || 'caja') : 'caja';
    const basePrice = mode === 'unidad' ? product.precio_unidad : product.precio;
    let discountPercent = 0;
    const rawDescuentos = product.descuentos as any;
    if (Array.isArray(rawDescuentos)) {
      const active = rawDescuentos.find((d: any) => d.activo);
      if (active) discountPercent = active.porcentaje;
    }
    const finalPrice = basePrice * (1 - discountPercent / 100);
    const existing = cart.find(item => item.product.id === product.id && item.saleMode === mode);
    if (existing) {
      setCart(cart.map(item => (item.product.id === product.id && item.saleMode === mode) ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCart([...cart, { product, cantidad: 1, saleMode: mode, originalPrice: basePrice, finalPrice, discountApplied: discountPercent }]);
    }
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

      for (const item of cart) {
        await supabase.rpc('deduct_stock', { p_id: item.product.id, p_qty: item.cantidad });
      }

      setShowOrderSummary({ transactionId: transactionId.split('-')[0].toUpperCase(), items: [...cart], total: totalAmount, paymentMethod, cashReceived: paymentMethod === 'efectivo' ? Number(cashReceived) : totalAmount, change: paymentMethod === 'efectivo' ? changeDue : 0, date: new Date().toLocaleString() });
      setCart([]);
      setCashReceived('');
      fetchProducts();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo_barras.includes(searchTerm));

  return (
    <div className="relative min-h-[calc(100vh-180px)] animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="relative group">
            <input
              ref={searchInputRef}
              className="w-full pl-14 pr-20 py-6 bg-white border-2 border-slate-100 rounded-[2.5rem] outline-none font-bold text-lg shadow-sm focus:border-emerald-500 transition-all"
              placeholder="Buscar medicamento o escanea..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button onClick={startScanner} className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-emerald-600 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar flex-1 pb-20 pr-1">
            {filteredProducts.map(product => {
              const mode = saleModes[product.id] || 'caja';
              const basePrice = mode === 'unidad' ? product.precio_unidad : product.precio;
              return (
                <div key={product.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm hover:shadow-lg transition-all group">
                  <h4 className="font-black text-slate-900 text-sm uppercase truncate mb-1">{product.nombre}</h4>
                  <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{product.laboratorio}</p>
                  <p className="text-[9px] font-bold mt-2 text-slate-400 uppercase">Stock: {product.stock} disponibles</p>
                  <div className="flex items-center justify-between my-5 bg-slate-50 p-4 rounded-2xl">
                    <p className="font-black text-emerald-600 text-xl tracking-tighter">${basePrice.toLocaleString()}</p>
                    {product.tipo === 'pastillas' && (
                      <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-inner">
                        <button onClick={() => setSaleModes({...saleModes, [product.id]: 'caja'})} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${saleModes[product.id] === 'caja' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Caja</button>
                        <button onClick={() => setSaleModes({...saleModes, [product.id]: 'unidad'})} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${saleModes[product.id] === 'unidad' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>Unid</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => addToCart(product)} className="w-full py-4 bg-slate-950 text-white rounded-[1.5rem] text-[10px] font-black uppercase hover:bg-emerald-600 active:scale-95 transition-all">+ Agregar al Carrito</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col bg-white lg:rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 bg-slate-900 text-white">
            <h3 className="text-lg font-black uppercase tracking-tight">Caja de Cobro</h3>
            <p className="text-[10px] font-bold text-emerald-400 uppercase mt-2">{cart.length} productos listos</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 custom-scrollbar">
            {cart.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-[2.2rem] shadow-md flex items-center justify-between animate-in slide-in-from-right-4">
                <div className="flex-1 min-w-0 pr-4">
                  <h5 className="font-black text-slate-900 text-[12px] uppercase truncate">{item.product.nombre}</h5>
                  <p className="text-[9px] text-slate-400 font-black mt-1 uppercase">{item.cantidad} {item.saleMode} x ${item.finalPrice.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 text-sm">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                  <button onClick={() => removeFromCart(item.product.id, item.saleMode)} className="text-rose-500 font-black text-[9px] uppercase mt-1 hover:underline">Quitar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-8 bg-white border-t border-slate-100 space-y-4">
             <div className="flex justify-between items-center mb-2">
               <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</span>
               <span className="text-4xl font-black text-slate-900 tracking-tighter">${totalAmount.toLocaleString()}</span>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setPaymentMethod('efectivo')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${paymentMethod === 'efectivo' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-transparent'}`}>Efectivo</button>
                <button onClick={() => setPaymentMethod('transferencia')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${paymentMethod === 'transferencia' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-transparent'}`}>Transferencia</button>
             </div>
             {paymentMethod === 'efectivo' && (
               <input type="number" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-lg outline-none focus:border-indigo-600" placeholder="¿Cuánto paga?" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
             )}
             <button disabled={cart.length === 0 || processing || (paymentMethod === 'efectivo' && (Number(cashReceived) < totalAmount || cashReceived === ''))} onClick={handleCheckout} className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:opacity-20">Finalizar Venta</button>
          </div>
        </div>
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="w-full max-w-lg aspect-square relative rounded-[4rem] overflow-hidden border-4 border-emerald-500/30">
             <video ref={videoRef} className="w-full h-full object-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-emerald-500 rounded-[3rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-emerald-500 animate-scan"></div>
                </div>
             </div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-rose-600 text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest">Cerrar</button>
          <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } } .animate-scan { position: absolute; animation: scan 2s infinite ease-in-out; }`}</style>
        </div>
      )}

      {showOrderSummary && (
        <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col p-12">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white text-4xl mb-6 mx-auto">✓</div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">Venta Exitosa</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">ID: #{showOrderSummary.transactionId}</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-10 pr-2">
              {showOrderSummary.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-slate-50">
                   <div>
                      <p className="font-black text-slate-900 text-sm uppercase">{item.product.nombre}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{item.cantidad} x ${item.finalPrice.toLocaleString()}</p>
                   </div>
                   <p className="font-black text-slate-900 text-lg">${(item.cantidad * item.finalPrice).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border-t-4 border-dashed border-slate-100 pt-8 space-y-6">
              <div className="flex justify-between items-end px-2">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Venta</span>
                <span className="text-5xl font-black text-slate-900 tracking-tighter">${showOrderSummary.total.toLocaleString()}</span>
              </div>
              <button onClick={() => setShowOrderSummary(null)} className="w-full py-6 bg-slate-950 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-xl hover:bg-emerald-600 transition-all active:scale-95">Nueva Venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
