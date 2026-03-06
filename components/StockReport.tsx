
import React from 'react';
import { Producto } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockReportProps {
  products: Producto[];
  onClose: () => void;
}

const StockReport: React.FC<StockReportProps> = ({ products, onClose }) => {

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const reportTitle = "Reporte de Inventario";
      const reportDate = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(reportTitle, 14, 22);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha de Generación: ${reportDate}`, 14, 30);

      const tableColumns = ["Producto", "Stock (Cajas)", "Stock (Unidades)"];
      const tableRows: any[] = [];

      products.forEach(p => {
        const totalUnits = p.stock ?? 0;
        const unitsPerBox = p.unidades_por_caja ?? 1;
        
        const boxes = unitsPerBox > 1 ? Math.floor(totalUnits / unitsPerBox) : 0;
        const remainingUnits = unitsPerBox > 1 ? totalUnits % unitsPerBox : totalUnits;
        
        const productData = [ p.nombre, boxes.toLocaleString(), remainingUnits.toLocaleString() ];
        tableRows.push(productData);
      });

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [23, 37, 84], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [241, 245, 255] },
        didDrawPage: (data) => {
          // @ts-ignore
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(10);
          doc.text(`Página ${data.pageNumber} de ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        },
      });

      const date = new Date().toISOString().split('T')[0];
      doc.save(`Reporte_Stock_${date}.pdf`);

    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("Hubo un problema al generar el PDF. Revisa la consola para más detalles.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-8 border-b flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reporte de Stock</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
             <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-8 overflow-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4 text-center">Stock (Cajas)</th>
                <th className="px-6 py-4 text-center">Stock (Unidades)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => {
                const totalUnits = p.stock ?? 0;
                const unitsPerBox = p.unidades_por_caja ?? 1;

                const boxes = unitsPerBox > 1 ? Math.floor(totalUnits / unitsPerBox) : 0;
                const remainingUnits = unitsPerBox > 1 ? totalUnits % unitsPerBox : totalUnits;
                
                return (
                  <tr key={p.id}>
                    <td className="px-6 py-4 font-bold text-slate-800 text-sm whitespace-nowrap">{p.nombre}</td>
                    <td className="px-6 py-4 text-center font-black text-indigo-600 text-lg">{boxes}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-500 text-base">{remainingUnits}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-8 border-t bg-slate-50/50 flex justify-end rounded-b-[3rem]">
          <button 
            onClick={exportToPDF}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            Descargar como PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockReport;
