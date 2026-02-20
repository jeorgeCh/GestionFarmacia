
import React from 'react';
import { Producto } from '../types';

interface ProductCardProps {
  product: Producto;
  onEdit: (product: Producto) => void;
  isAdmin: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, isAdmin }) => {
  const { 
    nombre, 
    laboratorio, 
    descripcion,
    stock, 
    precio, 
    precio_unidad, 
    unidades_por_caja,
  } = product;

  const unitsPerBox = unidades_por_caja || 1;
  const isSimple = unitsPerBox <= 1;
  const currentStock = stock || 0;
  const boxes = Math.floor(currentStock / unitsPerBox);
  const leftovers = currentStock % unitsPerBox;

  const hasStock = currentStock > 0;
  const isLowStock = currentStock > 0 && currentStock < 10;

  const stockColor = !hasStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500';
  const stockBgColor = !hasStock ? 'bg-red-50/50' : isLowStock ? 'bg-amber-50/50' : 'bg-emerald-50/50';
  const stockTextColor = !hasStock ? 'text-red-700' : isLowStock ? 'text-amber-700' : 'text-emerald-700';
  const stockBorderColor = !hasStock ? 'border-red-100' : isLowStock ? 'border-amber-100' : 'border-emerald-100';


  return (
    <div className={`bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 flex flex-col justify-between transition-all hover:shadow-lg hover:border-indigo-100 group relative`}>
      {isAdmin && (
        <button 
          onClick={() => onEdit(product)} 
          className="absolute top-6 right-6 p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 z-10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
      )}

      <div>
        <div className="flex justify-between items-start">
          <p className="text-[9px] text-indigo-500 font-black uppercase tracking-wider">{laboratorio || 'GENÉRICO'}</p>
          {!isSimple && (
            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-bold uppercase tracking-widest">
              Caja x{unitsPerBox}
            </span>
          )}
        </div>

        <h3 className="font-black text-slate-900 text-sm uppercase mt-3 truncate pr-8">{nombre}</h3>
        <p className="text-[9px] text-slate-400 font-medium mt-1 h-8 line-clamp-2">{descripcion || 'Sin descripción detallada.'}</p>
      </div>

      <div className="mt-6 space-y-4">
        <div className={`p-4 rounded-2xl border ${stockBorderColor} ${stockBgColor} flex items-center gap-4`}>
            <div className={`w-2.5 h-2.5 rounded-full ${stockColor} flex-shrink-0`}></div>
            <div className="flex-grow">
              <p className={`text-[9px] font-black uppercase tracking-widest ${stockTextColor}`}>
                {hasStock ? 'Disponible' : 'Agotado'}
              </p>
              <p className={`text-sm font-black ${stockTextColor}`}>
                {isSimple 
                  ? `${currentStock} Unidades` 
                  : `${boxes} Cajas / ${leftovers} Unid.`
                }
              </p>
            </div>
        </div>

        <div className="flex items-center justify-between bg-slate-50/80 p-4 rounded-2xl">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PVP Unidad</p>
            <p className="font-black text-indigo-600 text-base">
              ${(precio_unidad || 0).toLocaleString('es-CO')}
            </p>
          </div>
          {!isSimple && precio > 0 && (
            <div className="text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">PVP Caja</p>
              <p className="font-bold text-slate-600 text-sm">
                ${(precio || 0).toLocaleString('es-CO')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
