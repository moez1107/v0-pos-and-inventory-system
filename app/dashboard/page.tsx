'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import type { DashboardStats } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, error, isLoading } = useSWR<{ success: boolean; stats: DashboardStats }>(
    '/api/dashboard/stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Unable to load dashboard stats. Please ensure your database is connected.
          </p>
        </Card>
      </div>
    );
  }

  const stats = data.stats;
  const currencySymbol = '$';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today&apos;s Sales"
          value={`${currencySymbol}${stats.todaySales.toLocaleString()}`}
          icon={DollarSign}
          description={`${stats.todayTransactions} transactions`}
          trend="up"
        />
        <StatCard
          title="This Month"
          value={`${currencySymbol}${stats.monthSales.toLocaleString()}`}
          icon={Calendar}
          description={`${stats.monthTransactions} transactions`}
        />
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          description={stats.lowStockCount > 0 ? `${stats.lowStockCount} low stock` : 'Stock healthy'}
          trend={stats.lowStockCount > 0 ? 'down' : 'neutral'}
        />
        <StatCard
          title="Partners"
          value={stats.totalPartners}
          icon={Users}
          description="Active partners"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <a
              href="/dashboard/pos"
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <ShoppingCart className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">New Sale</span>
            </a>
            <a
              href="/dashboard/products"
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <Package className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Products</span>
            </a>
            <a
              href="/dashboard/returns"
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Returns</span>
            </a>
            <a
              href="/dashboard/reports"
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <TrendingUp className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Reports</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockCount > 0 ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 text-destructive">
                <Package className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">Low Stock Warning</p>
                  <p className="text-sm opacity-90">
                    {stats.lowStockCount} product{stats.lowStockCount > 1 ? 's' : ''} running low on stock
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted text-muted-foreground">
                <Package className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">All Good</p>
                  <p className="text-sm">No alerts at this time</p>
                </div>
              </div>
            )}
            {stats.pendingReturns > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-chart-4/10 text-chart-4 mt-3">
                <RotateCcw className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">Pending Returns</p>
                  <p className="text-sm opacity-90">
                    {stats.pendingReturns} return{stats.pendingReturns > 1 ? 's' : ''} awaiting approval
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
