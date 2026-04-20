export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'partner';
  full_name: string;
  phone?: string;
  address?: string;
  commission_rate: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Product {
  id: number;
  barcode: string;
  name: string;
  description?: string;
  category_id?: number;
  category_name?: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Sale {
  id: number;
  invoice_number: string;
  user_id: number;
  user_name?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'credit';
  payment_status: 'paid' | 'pending' | 'partial';
  notes?: string;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  barcode?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}

export interface Return {
  id: number;
  return_number: string;
  sale_id: number;
  invoice_number?: string;
  user_id: number;
  user_name?: string;
  reason?: string;
  total_refund: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
  processed_at?: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: number;
  return_id: number;
  sale_item_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  refund_amount: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export interface Settings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  tax_rate: number;
  currency_symbol: string;
  invoice_prefix: string;
  thermal_printer_width: number;
  low_stock_alert: number;
}

export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  monthSales: number;
  monthTransactions: number;
  totalProducts: number;
  lowStockCount: number;
  totalPartners: number;
  pendingReturns: number;
}

export interface SalesReport {
  date: string;
  total_sales: number;
  transaction_count: number;
  average_sale: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}
