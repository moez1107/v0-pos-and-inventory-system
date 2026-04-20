import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import type { Product } from '@/lib/types';

// Generate unique barcode
function generateBarcode(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PRD${timestamp}${random}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const categoryId = searchParams.get('category');
    const lowStock = searchParams.get('lowStock');
    const barcode = searchParams.get('barcode');

    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = TRUE
    `;
    const params: (string | number)[] = [];

    if (barcode) {
      sql += ' AND p.barcode = ?';
      params.push(barcode);
    }

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    if (lowStock === 'true') {
      sql += ' AND p.stock_quantity <= p.min_stock_level';
    }

    sql += ' ORDER BY p.name ASC';

    const products = await query<Product[]>(sql, params);

    return NextResponse.json({ success: true, products });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get products error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      barcode,
      name,
      description,
      category_id,
      cost_price,
      selling_price,
      stock_quantity,
      min_stock_level,
      unit,
    } = body;

    if (!name || cost_price === undefined || selling_price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, cost price, and selling price are required' },
        { status: 400 }
      );
    }

    // Generate barcode if not provided
    const finalBarcode = barcode || generateBarcode();

    // Check if barcode already exists
    const existing = await queryOne<Product>(
      'SELECT id FROM products WHERE barcode = ?',
      [finalBarcode]
    );

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Barcode already exists' },
        { status: 400 }
      );
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO products 
       (barcode, name, description, category_id, cost_price, selling_price, stock_quantity, min_stock_level, unit) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalBarcode,
        name,
        description || null,
        category_id || null,
        parseFloat(cost_price),
        parseFloat(selling_price),
        parseInt(stock_quantity) || 0,
        parseInt(min_stock_level) || 10,
        unit || 'piece',
      ]
    );

    return NextResponse.json({
      success: true,
      productId: (result as unknown as { insertId: number }).insertId,
      barcode: finalBarcode,
    });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const {
      id,
      barcode,
      name,
      description,
      category_id,
      cost_price,
      selling_price,
      stock_quantity,
      min_stock_level,
      unit,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    const existing = await queryOne<Product>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Check barcode uniqueness if changed
    if (barcode && barcode !== existing.barcode) {
      const barcodeExists = await queryOne<Product>(
        'SELECT id FROM products WHERE barcode = ? AND id != ?',
        [barcode, id]
      );
      if (barcodeExists) {
        return NextResponse.json(
          { success: false, error: 'Barcode already exists' },
          { status: 400 }
        );
      }
    }

    await query(
      `UPDATE products SET 
       barcode = ?, name = ?, description = ?, category_id = ?, 
       cost_price = ?, selling_price = ?, stock_quantity = ?, 
       min_stock_level = ?, unit = ?, is_active = ?
       WHERE id = ?`,
      [
        barcode || existing.barcode,
        name || existing.name,
        description ?? existing.description,
        category_id ?? existing.category_id,
        parseFloat(cost_price) || existing.cost_price,
        parseFloat(selling_price) || existing.selling_price,
        stock_quantity !== undefined ? parseInt(stock_quantity) : existing.stock_quantity,
        min_stock_level !== undefined ? parseInt(min_stock_level) : existing.min_stock_level,
        unit || existing.unit,
        is_active !== undefined ? is_active : existing.is_active,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    // Soft delete
    await query('UPDATE products SET is_active = FALSE WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete product error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete product' }, { status: 500 });
  }
}
