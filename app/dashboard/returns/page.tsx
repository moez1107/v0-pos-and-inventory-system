'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, MoreHorizontal, RotateCcw, Check, X, Search } from 'lucide-react';
import type { Return, Sale, SaleItem } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ReturnsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; returns: Return[] }>(
    `/api/returns${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`,
    fetcher
  );

  const [newReturnOpen, setNewReturnOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ [key: number]: number }>({});
  const [returnReason, setReturnReason] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSearchInvoice = async () => {
    if (!invoiceSearch) return;
    setSearchLoading(true);

    try {
      const res = await fetch(`/api/sales?invoice=${encodeURIComponent(invoiceSearch)}`);
      const data = await res.json();

      if (data.success && data.sale) {
        setSelectedSale(data.sale);
        setSelectedItems({});
      } else {
        alert('Invoice not found');
        setSelectedSale(null);
      }
    } catch {
      alert('Failed to search invoice');
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleItem = (itemId: number, maxQty: number) => {
    setSelectedItems((prev) => {
      if (prev[itemId]) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: maxQty };
    });
  };

  const updateItemQty = (itemId: number, qty: number, maxQty: number) => {
    if (qty < 1 || qty > maxQty) return;
    setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handleCreateReturn = async () => {
    if (!selectedSale || Object.keys(selectedItems).length === 0) return;
    setProcessing(true);

    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: selectedSale.id,
          reason: returnReason,
          items: Object.entries(selectedItems).map(([sale_item_id, quantity]) => ({
            sale_item_id: parseInt(sale_item_id),
            quantity,
          })),
        }),
      });

      const result = await res.json();

      if (!result.success) {
        alert(result.error);
        return;
      }

      setNewReturnOpen(false);
      setSelectedSale(null);
      setSelectedItems({});
      setReturnReason('');
      setInvoiceSearch('');
      mutate();
      alert(`Return created: ${result.returnNumber}`);
    } catch {
      alert('Failed to create return');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch('/api/returns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await res.json();
      if (!result.success) {
        alert(result.error);
        return;
      }

      mutate();
    } catch {
      alert('Failed to update return');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalRefund = selectedSale?.items
    ? Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
        const item = selectedSale.items?.find((i) => i.id === parseInt(itemId));
        if (!item) return sum;
        return sum + (item.total_price / item.quantity) * qty;
      }, 0)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="text-muted-foreground">Process and manage product returns</p>
        </div>
        <Button onClick={() => setNewReturnOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Return
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Return Requests
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error || !data?.success ? (
            <p className="text-muted-foreground text-center py-8">
              Failed to load returns. Please check your database connection.
            </p>
          ) : data.returns.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No return requests found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.returns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-mono">{ret.return_number}</TableCell>
                    <TableCell className="font-mono">{ret.invoice_number}</TableCell>
                    <TableCell>{ret.user_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ret.reason || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${ret.total_refund.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(ret.status)}</TableCell>
                    <TableCell>
                      {user?.role === 'admin' && ret.status === 'pending' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleUpdateStatus(ret.id, 'approved')}>
                              <Check className="h-4 w-4 mr-2 text-blue-500" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(ret.id, 'completed')}>
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                              Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateStatus(ret.id, 'rejected')}
                              className="text-destructive"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Return Dialog */}
      <Dialog open={newReturnOpen} onOpenChange={setNewReturnOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Return Request</DialogTitle>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>Invoice Number</FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Enter invoice number"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchInvoice()}
                />
                <Button onClick={handleSearchInvoice} disabled={searchLoading}>
                  {searchLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </Field>

            {selectedSale && (
              <>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Invoice:</strong> {selectedSale.invoice_number}</p>
                  <p><strong>Date:</strong> {new Date(selectedSale.created_at).toLocaleString()}</p>
                  <p><strong>Total:</strong> ${selectedSale.total_amount.toFixed(2)}</p>
                </div>

                <Field>
                  <FieldLabel>Select Items to Return</FieldLabel>
                  <div className="border rounded-lg divide-y">
                    {selectedSale.items?.map((item) => (
                      <div key={item.id} className="p-3 flex items-center gap-3">
                        <Checkbox
                          checked={!!selectedItems[item.id]}
                          onCheckedChange={() => toggleItem(item.id, item.quantity)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            ${item.unit_price.toFixed(2)} x {item.quantity} = ${item.total_price.toFixed(2)}
                          </p>
                        </div>
                        {selectedItems[item.id] && (
                          <Input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={selectedItems[item.id]}
                            onChange={(e) =>
                              updateItemQty(item.id, parseInt(e.target.value) || 1, item.quantity)
                            }
                            className="w-20"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </Field>

                <Field>
                  <FieldLabel>Reason for Return</FieldLabel>
                  <Input
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Describe the reason for return"
                  />
                </Field>

                {Object.keys(selectedItems).length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between font-medium">
                      <span>Total Refund Amount</span>
                      <span>${totalRefund.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateReturn}
              disabled={!selectedSale || Object.keys(selectedItems).length === 0 || processing}
            >
              {processing && <Spinner className="mr-2" />}
              Create Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
