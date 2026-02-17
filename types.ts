
export interface Role {
  id: number;
  nombre: 'admin' | 'vendedor';
  descripcion?: string;
}

export interface Usuario {
  id: number;
  username: string;
  email: string;
  password_plano: string;
  role_id: number;
  activo: boolean;
  created_at: string;
  roles?: Role;
}

export interface CierreDiario {
  id: number;
  fecha: string;
  total_ventas: number;
  total_costos: number;
  utilidad: number;
  usuario_id: number;
  created_at: string;
}

export interface Descuento {
  id: number;
  producto_id: number;
  porcentaje: number;
  activo: boolean;
  created_at: string;
  productos?: Producto;
}

export interface Producto {
  id: number;
  codigo_barras: string;
  nombre: string;
  tipo: 'producto' | 'pastillas';
  descripcion?: string;
  laboratorio?: string;
  precio: number; 
  precio_unidad: number; 
  blisters_por_caja: number; 
  unidades_por_caja: number; 
  stock: number; 
  ubicacion?: string;
  fecha_vencimiento?: string;
  created_at: string;
  descuentos?: Descuento[];
}

export interface Proveedor {
  id: number;
  nombre: string;
  nit?: string;
  telefono?: string;
  email?: string;
  created_at: string;
}

export interface Venta {
  id: number;
  usuario_id: number;
  producto_id: number;
  cantidad: number;
  total: number;
  metodo_pago: 'efectivo' | 'transferencia';
  dinero_recibido?: number;
  cambio?: number;
  es_unidad: boolean;
  fecha: string;
  transaccion_id?: string;
  productos?: Producto;
  usuarios?: Usuario;
}

export interface Ingreso {
  id: number;
  usuario_id: number;
  producto_id: number;
  proveedor_id: number;
  cantidad: number;
  costo_unitario: number;
  total: number;
  lote?: string;
  fecha: string;
  fecha_vencimiento?: string;
  productos?: Producto;
  proveedores?: Proveedor;
  usuarios?: Usuario;
}
