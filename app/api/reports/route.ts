import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'daily';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default date range - last 30 days
    const defaultEndDate = new Date().toISOString().split('T')[0];
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const start = startDate || defaultStartDate;
    const end = endDate || defaultEndDate;

    switch (reportType) {
      case 'daily': {
        // Daily sales summary
        const dailySales = await query<{
          date: string;
          total_sales: number;
          transaction_count: number;
          average_sale: number;
        }[]>(
          `SELECT 
             DATE(created_at) as date,
             SUM(total_amount) as total_sales,
             COUNT(*) as transaction_count,
             AVG(total_amount) as average_sale
           FROM sales 
           WHERE DATE(created_at) BETWEEN ? AND ?
           GROUP BY DATE(created_at)
           ORDER BY date DESC`,
          [start, end]
        );

        return NextResponse.json({ success: true, data: dailySales });
      }

      case 'monthly': {
        // Monthly sales summary
        const monthlySales = await query<{
          month: string;
          total_sales: number;
          transaction_count: number;
          average_sale: number;
        }[]>(
          `SELECT 
             DATE_FORMAT(created_at, '%Y-%m') as month,
             SUM(total_amount) as total_sales,
             COUNT(*) as transaction_count,
             AVG(total_amount) as average_sale
           FROM sales 
           WHERE DATE(created_at) BETWEEN ? AND ?
           GROUP BY DATE_FORMAT(created_at, '%Y-%m')
           ORDER BY month DESC`,
          [start, end]
        );

        return NextResponse.json({ success: true, data: monthlySales });
      }

      case 'products': {
        // Top selling products
        const topProducts = await query<{
          product_id: number;
          product_name: string;
          barcode: string;
          total_quantity: number;
          total_revenue: number;
        }[]>(
          `SELECT 
             p.id as product_id,
             p.name as product_name,
             p.barcode,
             SUM(si.quantity) as total_quantity,
             SUM(si.total_price) as total_revenue
           FROM sale_items si
           JOIN products p ON si.product_id = p.id
           JOIN sales s ON si.sale_id = s.id
           WHERE DATE(s.created_at) BETWEEN ? AND ?
           GROUP BY p.id
           ORDER BY total_quantity DESC
           LIMIT 20`,
          [start, end]
        );

        return NextResponse.json({ success: true, data: topProducts });
      }

      case 'partners': {
        // Sales by partner
        const partnerSales = await query<{
          user_id: number;
          user_name: string;
          total_sales: number;
          transaction_count: number;
          commission_earned: number;
        }[]>(
          `SELECT 
             u.id as user_id,
             u.full_name as user_name,
             SUM(s.total_amount) as total_sales,
             COUNT(*) as transaction_count,
             SUM(s.total_amount * u.commission_rate / 100) as commission_earned
           FROM sales s
           JOIN users u ON s.user_id = u.id
           WHERE DATE(s.created_at) BETWEEN ? AND ?
           GROUP BY u.id
           ORDER BY total_sales DESC`,
          [start, end]
        );

        return NextResponse.json({ success: true, data: partnerSales });
      }

      case 'inventory': {
        // Inventory status
        const inventory = await query<{
          id: number;
          name: string;
          barcode: string;
          category_name: string;
          stock_quantity: number;
          min_stock_level: number;
          stock_value: number;
        }[]>(
          `SELECT 
             p.id,
             p.name,
             p.barcode,
             c.name as category_name,
             p.stock_quantity,
             p.min_stock_level,
             (p.stock_quantity * p.cost_price) as stock_value
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE p.is_active = TRUE
           ORDER BY p.stock_quantity ASC`
        );

        const totalValue = inventory.reduce((sum, item) => sum + item.stock_value, 0);
        const lowStockCount = inventory.filter(
          (item) => item.stock_quantity <= item.min_stock_level
        ).length;

        return NextResponse.json({
          success: true,
          data: inventory,
          summary: {
            totalProducts: inventory.length,
            totalValue,
            lowStockCount,
          },
        });
      }

      case 'payment': {
        // Sales by payment method
        const paymentStats = await query<{
          payment_method: string;
          total_sales: number;
          transaction_count: number;
        }[]>(
          `SELECT 
             payment_method,
             SUM(total_amount) as total_sales,
             COUNT(*) as transaction_count
           FROM sales 
           WHERE DATE(created_at) BETWEEN ? AND ?
           GROUP BY payment_method
           ORDER BY total_sales DESC`,
          [start, end]
        );

        return NextResponse.json({ success: true, data: paymentStats });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid report type' },
          { status: 400 }
        );
    }
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}
