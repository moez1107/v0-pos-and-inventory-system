import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne, pool } from '@/lib/db';
import type { Sale, SaleItem } from '@/lib/types';

// Generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const settings = await queryOne<{ setting_value: string }>(
    "SELECT setting_value FROM settings WHERE setting_key = 'invoice_prefix'"
  );
  const prefix = settings?.setting_value || 'INV';
  
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const lastSale = await queryOne<{ invoice_number: string }>(
    "SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1",
    [`${prefix}${today}%`]
  );
  
  let sequence = 1;
  if (lastSale) {
    const lastSeq = parseInt(lastSale.invoice_number.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }
  
  return `${prefix}${today}${sequence.toString().padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const invoiceNumber = searchParams.get('invoice');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');

    // Get single sale with items
    if (id || invoiceNumber) {
      const whereClause = id ? 's.id = ?' : 's.invoice_number = ?';
      const paramValue = id || invoiceNumber;

      const sale = await queryOne<Sale>(
        `SELECT s.*, u.full_name as user_name 
         FROM sales s 
         JOIN users u ON s.user_id = u.id 
         WHERE ${whereClause}`,
        [paramValue]
      );

      if (!sale) {
        return NextResponse.json({ success: false, error: 'Sale not found' }, { status: 404 });
      }

      const items = await query<SaleItem[]>(
        `SELECT si.*, p.name as product_name, p.barcode 
         FROM sale_items si 
         JOIN products p ON si.product_id = p.id 
         WHERE si.sale_id = ?`,
        [sale.id]
      );

      return NextResponse.json({ success: true, sale: { ...sale, items } });
    }

    // Get list of sales
    let sql = `
      SELECT s.*, u.full_name as user_name 
      FROM sales s 
      JOIN users u ON s.user_id = u.id 
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (startDate) {
      sql += ' AND DATE(s.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(s.created_at) <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY s.created_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const sales = await query<Sale[]>(sql, params);

    return NextResponse.json({ success: true, sales });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get sales error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const connection = await pool.getConnection();
  
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const {
      items,
      customer_name,
      customer_phone,
      discount_amount = 0,
      discount_percent = 0,
      payment_method = 'cash',
      payment_status = 'paid',
      notes,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one item is required' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    // Calculate totals
    let subtotal = 0;
    const saleItems: Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
      discount_amount: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const product = await queryOne<{ id: number; selling_price: number; stock_quantity: number }>(
        'SELECT id, selling_price, stock_quantity FROM products WHERE id = ? AND is_active = TRUE',
        [item.product_id]
      );

      if (!product) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: `Product not found: ${item.product_id}` },
          { status: 400 }
        );
      }

      if (product.stock_quantity < item.quantity) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: `Insufficient stock for product ID ${item.product_id}` },
          { status: 400 }
        );
      }

      const itemDiscount = item.discount || 0;
      const itemTotal = (product.selling_price * item.quantity) - itemDiscount;
      
      saleItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.selling_price,
        discount_amount: itemDiscount,
        total_price: itemTotal,
      });

      subtotal += itemTotal;
    }

    // Apply discount
    const discountAmt = discount_percent > 0 
      ? subtotal * (discount_percent / 100) 
      : discount_amount;

    // Get tax rate
    const taxSetting = await queryOne<{ setting_value: string }>(
      "SELECT setting_value FROM settings WHERE setting_key = 'tax_rate'"
    );
    const taxRate = parseFloat(taxSetting?.setting_value || '0');
    const taxAmount = (subtotal - discountAmt) * (taxRate / 100);
    
    const totalAmount = subtotal - discountAmt + taxAmount;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Insert sale
    const [saleResult] = await connection.execute(
      `INSERT INTO sales 
       (invoice_number, user_id, customer_name, customer_phone, subtotal, 
        discount_amount, discount_percent, tax_amount, total_amount, 
        payment_method, payment_status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        user.id,
        customer_name || null,
        customer_phone || null,
        subtotal,
        discountAmt,
        discount_percent,
        taxAmount,
        totalAmount,
        payment_method,
        payment_status,
        notes || null,
      ]
    );

    const saleId = (saleResult as { insertId: number }).insertId;

    // Insert sale items and update stock
    for (const item of saleItems) {
      await connection.execute(
        `INSERT INTO sale_items 
         (sale_id, product_id, quantity, unit_price, discount_amount, total_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, item.product_id, item.quantity, item.unit_price, item.discount_amount, item.total_price]
      );

      // Update stock
      await connection.execute(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      saleId,
      invoiceNumber,
      totalAmount,
    });
  } catch (error) {
    await connection.rollback();
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create sale error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create sale' }, { status: 500 });
  } finally {
    connection.release();
  }
}
