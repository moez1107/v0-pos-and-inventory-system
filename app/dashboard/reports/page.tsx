'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  Calendar,
  BarChart3,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Download,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function DateRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className="w-auto"
      />
      <span className="text-muted-foreground">to</span>
      <Input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className="w-auto"
      />
    </div>
  );
}

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [activeTab, setActiveTab] = useState('daily');

  const queryString = `?type=${activeTab}&startDate=${startDate}&endDate=${endDate}`;
  const { data, isLoading } = useSWR(`/api/reports${queryString}`, fetcher);

  const exportToCSV = (reportData: Record<string, unknown>[], filename: string) => {
    if (!reportData || reportData.length === 0) return;
    
    const headers = Object.keys(reportData[0]);
    const csv = [
      headers.join(','),
      ...reportData.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View sales analytics and inventory reports</p>
        </div>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="daily" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Daily
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="partners" className="gap-2">
            <Users className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : !data?.success ? (
          <Card className="mt-6">
            <CardContent className="py-12 text-center text-muted-foreground">
              Unable to load report. Please check your database connection.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Daily Sales */}
            <TabsContent value="daily">
              <div className="grid gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Daily Sales Trend</CardTitle>
                      <CardDescription>Sales performance over time</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(data.data, 'daily_sales')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {data.data.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No sales data for this period</p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[...data.data].reverse()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="total_sales" fill="#0088FE" name="Sales" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Sales Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right">Avg. Sale</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.data.map((row: { date: string; total_sales: number; transaction_count: number; average_sale: number }) => (
                          <TableRow key={row.date}>
                            <TableCell>{row.date}</TableCell>
                            <TableCell className="text-right">${row.total_sales.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{row.transaction_count}</TableCell>
                            <TableCell className="text-right">${row.average_sale.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Monthly Sales */}
            <TabsContent value="monthly">
              <div className="grid gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Monthly Sales Trend</CardTitle>
                      <CardDescription>Monthly revenue overview</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(data.data, 'monthly_sales')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {data.data.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No sales data for this period</p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...data.data].reverse()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="total_sales" stroke="#0088FE" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Top Products */}
            <TabsContent value="products">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Top Selling Products</CardTitle>
                    <CardDescription>Best performing products by quantity sold</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(data.data, 'top_products')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No product data for this period</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Barcode</TableHead>
                          <TableHead className="text-right">Qty Sold</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.data.map((row: { product_id: number; product_name: string; barcode: string; total_quantity: number; total_revenue: number }) => (
                          <TableRow key={row.product_id}>
                            <TableCell className="font-medium">{row.product_name}</TableCell>
                            <TableCell className="font-mono text-sm">{row.barcode}</TableCell>
                            <TableCell className="text-right">{row.total_quantity}</TableCell>
                            <TableCell className="text-right">${row.total_revenue.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Partner Sales */}
            <TabsContent value="partners">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Sales by Partner</CardTitle>
                    <CardDescription>Partner performance and commissions</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(data.data, 'partner_sales')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.data.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No partner data for this period</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Partner</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.data.map((row: { user_id: number; user_name: string; total_sales: number; transaction_count: number; commission_earned: number }) => (
                          <TableRow key={row.user_id}>
                            <TableCell className="font-medium">{row.user_name}</TableCell>
                            <TableCell className="text-right">${row.total_sales.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{row.transaction_count}</TableCell>
                            <TableCell className="text-right">${row.commission_earned?.toFixed(2) || '0.00'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inventory */}
            <TabsContent value="inventory">
              <div className="grid gap-6">
                {data.summary && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <Package className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="text-2xl font-bold">{data.summary.totalProducts}</p>
                            <p className="text-sm text-muted-foreground">Total Products</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <DollarSign className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="text-2xl font-bold">${data.summary.totalValue.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Stock Value</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <AlertTriangle className="h-8 w-8 text-destructive" />
                          <div>
                            <p className="text-2xl font-bold">{data.summary.lowStockCount}</p>
                            <p className="text-sm text-muted-foreground">Low Stock Items</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Inventory Status</CardTitle>
                      <CardDescription>Current stock levels</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(data.data, 'inventory')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Min Level</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.data.slice(0, 50).map((row: { id: number; name: string; category_name: string; stock_quantity: number; min_stock_level: number; stock_value: number }) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.category_name || '-'}</TableCell>
                            <TableCell className="text-right">{row.stock_quantity}</TableCell>
                            <TableCell className="text-right">{row.min_stock_level}</TableCell>
                            <TableCell className="text-right">${row.stock_value.toFixed(2)}</TableCell>
                            <TableCell>
                              {row.stock_quantity <= row.min_stock_level ? (
                                <Badge variant="destructive">Low</Badge>
                              ) : (
                                <Badge variant="secondary">OK</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Payment Methods */}
            <TabsContent value="payment">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Method Distribution</CardTitle>
                    <CardDescription>Sales breakdown by payment type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.data.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No payment data for this period</p>
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={data.data}
                              dataKey="total_sales"
                              nameKey="payment_method"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {data.data.map((_: unknown, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.data.map((row: { payment_method: string; total_sales: number; transaction_count: number }) => (
                          <TableRow key={row.payment_method}>
                            <TableCell className="font-medium capitalize">{row.payment_method}</TableCell>
                            <TableCell className="text-right">${row.total_sales.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{row.transaction_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
