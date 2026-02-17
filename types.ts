
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
  descripcion?: string;
  precio: number;
  stock: number;
  ubicacion?: string;
  fecha_vencimiento?: string;
  created_at: string;
  descuentos?: Descuento[]; // Relación con descuentos
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
  fecha: string;
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
