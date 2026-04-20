import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { query, queryOne, pool } from '@/lib/db';
import type { Return, ReturnItem, Sale, SaleItem } from '@/lib/types';

// Generate return number
async function generateReturnNumber(): Promise<string> {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const lastReturn = await queryOne<{ return_number: string }>(
    "SELECT return_number FROM returns WHERE return_number LIKE ? ORDER BY id DESC LIMIT 1",
    [`RET${today}%`]
  );
  
  let sequence = 1;
  if (lastReturn) {
    const lastSeq = parseInt(lastReturn.return_number.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }
  
  return `RET${today}${sequence.toString().padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    if (id) {
      const returnData = await queryOne<Return>(
        `SELECT r.*, s.invoice_number, u.full_name as user_name 
         FROM returns r 
         JOIN sales s ON r.sale_id = s.id 
         JOIN users u ON r.user_id = u.id 
         WHERE r.id = ?`,
        [id]
      );

      if (!returnData) {
        return NextResponse.json({ success: false, error: 'Return not found' }, { status: 404 });
      }

      const items = await query<ReturnItem[]>(
        `SELECT ri.*, p.name as product_name 
         FROM return_items ri 
         JOIN products p ON ri.product_id = p.id 
         WHERE ri.return_id = ?`,
        [id]
      );

      return NextResponse.json({ success: true, return: { ...returnData, items } });
    }

    let sql = `
      SELECT r.*, s.invoice_number, u.full_name as user_name 
      FROM returns r 
      JOIN sales s ON r.sale_id = s.id 
      JOIN users u ON r.user_id = u.id
    `;
    const params: string[] = [];

    if (status) {
      sql += ' WHERE r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.created_at DESC';

    const returns = await query<Return[]>(sql, params);

    return NextResponse.json({ success: true, returns });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get returns error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch returns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const connection = await pool.getConnection();
  
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const { sale_id, items, reason } = body;

    if (!sale_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sale ID and at least one item are required' },
        { status: 400 }
      );
    }

    // Verify sale exists
    const sale = await queryOne<Sale>('SELECT * FROM sales WHERE id = ?', [sale_id]);
    if (!sale) {
      return NextResponse.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    await connection.beginTransaction();

    // Calculate total refund and validate items
    let totalRefund = 0;
    const returnItems: Array<{
      sale_item_id: number;
      product_id: number;
      quantity: number;
      refund_amount: number;
    }> = [];

    for (const item of items) {
      const saleItem = await queryOne<SaleItem>(
        'SELECT * FROM sale_items WHERE id = ? AND sale_id = ?',
        [item.sale_item_id, sale_id]
      );

      if (!saleItem) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: `Sale item not found: ${item.sale_item_id}` },
          { status: 400 }
        );
      }

      if (item.quantity > saleItem.quantity) {
        await connection.rollback();
        return NextResponse.json(
          { success: false, error: 'Return quantity exceeds sold quantity' },
          { status: 400 }
        );
      }

      const refundAmount = (saleItem.total_price / saleItem.quantity) * item.quantity;
      
      returnItems.push({
        sale_item_id: item.sale_item_id,
        product_id: saleItem.product_id,
        quantity: item.quantity,
        refund_amount: refundAmount,
      });

      totalRefund += refundAmount;
    }

    // Generate return number
    const returnNumber = await generateReturnNumber();

    // Insert return
    const [returnResult] = await connection.execute(
      `INSERT INTO returns (return_number, sale_id, user_id, reason, total_refund, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [returnNumber, sale_id, user.id, reason || null, totalRefund]
    );

    const returnId = (returnResult as { insertId: number }).insertId;

    // Insert return items
    for (const item of returnItems) {
      await connection.execute(
        `INSERT INTO return_items (return_id, sale_item_id, product_id, quantity, refund_amount) 
         VALUES (?, ?, ?, ?, ?)`,
        [returnId, item.sale_item_id, item.product_id, item.quantity, item.refund_amount]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      returnId,
      returnNumber,
      totalRefund,
    });
  } catch (error) {
    await connection.rollback();
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create return error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create return' }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PUT(request: NextRequest) {
  const connection = await pool.getConnection();
  
  try {
    await requireAdmin();
    const body = await request.json();
    
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'Return ID and status are required' },
        { status: 400 }
      );
    }

    if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const returnData = await queryOne<Return>('SELECT * FROM returns WHERE id = ?', [id]);
    if (!returnData) {
      return NextResponse.json({ success: false, error: 'Return not found' }, { status: 404 });
    }

    await connection.beginTransaction();

    // If approving/completing, restore stock
    if ((status === 'approved' || status === 'completed') && returnData.status === 'pending') {
      const items = await query<ReturnItem[]>(
        'SELECT * FROM return_items WHERE return_id = ?',
        [id]
      );

      for (const item of items) {
        await connection.execute(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Update return status
    await connection.execute(
      `UPDATE returns SET status = ?, processed_at = ${status === 'completed' ? 'NOW()' : 'processed_at'} WHERE id = ?`,
      [status, id]
    );

    await connection.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    await connection.rollback();
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update return error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update return' }, { status: 500 });
  } finally {
    connection.release();
  }
}
