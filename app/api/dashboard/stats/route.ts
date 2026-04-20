import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import type { DashboardStats } from '@/lib/types';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0];

    // Get today's sales
    const todayStats = await queryOne<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
       FROM sales WHERE DATE(created_at) = ?`,
      [today]
    );

    // Get this month's sales
    const monthStats = await queryOne<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
       FROM sales WHERE DATE(created_at) >= ?`,
      [monthStart]
    );

    // Get product counts
    const productStats = await queryOne<{ total: number; low_stock: number }>(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN stock_quantity <= min_stock_level THEN 1 ELSE 0 END) as low_stock
       FROM products WHERE is_active = TRUE`
    );

    // Get partner count
    const partnerCount = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM users WHERE role = 'partner' AND is_active = TRUE`
    );

    // Get pending returns
    const pendingReturns = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM returns WHERE status = 'pending'`
    );

    const stats: DashboardStats = {
      todaySales: todayStats?.total || 0,
      todayTransactions: todayStats?.count || 0,
      monthSales: monthStats?.total || 0,
      monthTransactions: monthStats?.count || 0,
      totalProducts: productStats?.total || 0,
      lowStockCount: productStats?.low_stock || 0,
      totalPartners: partnerCount?.count || 0,
      pendingReturns: pendingReturns?.count || 0,
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
