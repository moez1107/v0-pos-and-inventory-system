'use client';

import { useState, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  X,
  ScanBarcode,
} from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import type { Product, CartItem } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<{ invoiceNumber: string; total: number } | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Checkout form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [notes, setNotes] = useState('');

  const { data: productsData } = useSWR<{ success: boolean; products: Product[] }>(
    `/api/products${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    fetcher
  );

  const products = productsData?.products || [];

  // Handle barcode scan
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      try {
        const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        
        if (data.success && data.products.length > 0) {
          addToCart(data.products[0]);
        } else {
          // Play error sound or show notification
          console.log('Product not found for barcode:', barcode);
        }
      } catch (error) {
        console.error('Barcode lookup error:', error);
      }
    },
    []
  );

  useBarcodeScanner({ onScan: handleBarcodeScan, enabled: !checkoutOpen });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      
      if (existing) {
        // Check stock
        if (existing.quantity >= product.stock_quantity) {
          alert('Not enough stock available');
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      if (product.stock_quantity < 1) {
        alert('Product is out of stock');
        return prev;
      }
      
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty < 1) return item;
            if (newQty > item.product.stock_quantity) {
              alert('Not enough stock available');
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.selling_price * item.quantity - item.discount,
    0
  );
  const discountAmt = subtotal * (parseFloat(discountPercent) / 100);
  const total = subtotal - discountAmt;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            discount: item.discount,
          })),
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          discount_percent: parseFloat(discountPercent),
          payment_method: paymentMethod,
          notes: notes || undefined,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        alert(result.error);
        return;
      }

      setLastSale({
        invoiceNumber: result.invoiceNumber,
        total: result.totalAmount,
      });
      setCheckoutOpen(false);
      setSuccessOpen(true);
      
      // Reset
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountPercent('0');
      setNotes('');
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to process sale');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (lastSale) {
      window.open(`/dashboard/invoice/${lastSale.invoiceNumber}?print=thermal`, '_blank');
    }
    setSuccessOpen(false);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search products or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-10"
            />
            <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Barcode scanner active - scan products to add to cart
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!productsData?.success ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Connect database to view products</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                {search ? 'No products found' : 'No products available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock_quantity < 1}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {product.barcode}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold">${product.selling_price.toFixed(2)}</span>
                    <Badge
                      variant={product.stock_quantity > product.min_stock_level ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {product.stock_quantity}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <Card className="w-full lg:w-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart
              {cart.length > 0 && (
                <Badge variant="secondary">{cart.length}</Badge>
              )}
            </CardTitle>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto pb-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
              <p>Cart is empty</p>
              <p className="text-xs">Scan or click products to add</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start gap-3 pb-3 border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${item.product.selling_price.toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col pt-4 border-t">
          <div className="w-full space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {parseFloat(discountPercent) > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Discount ({discountPercent}%)</span>
                <span>-${discountAmt.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Checkout
          </Button>
        </CardFooter>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>
          
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Customer Name</FieldLabel>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field>
                <FieldLabel>Customer Phone</FieldLabel>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Discount (%)</FieldLabel>
              <Input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Payment Method</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="flex flex-col h-auto py-3"
                >
                  <Banknote className="h-5 w-5 mb-1" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className="flex flex-col h-auto py-3"
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  <span className="text-xs">Card</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('upi')}
                  className="flex flex-col h-auto py-3"
                >
                  <Smartphone className="h-5 w-5 mb-1" />
                  <span className="text-xs">UPI</span>
                </Button>
              </div>
            </Field>

            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </Field>
          </FieldGroup>

          <div className="bg-muted p-4 rounded-lg mt-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total to Pay</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={processing}>
              {processing && <Spinner className="mr-2" />}
              Complete Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-6">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Sale Complete!</h2>
            <p className="text-muted-foreground mb-1">
              Invoice: <span className="font-mono">{lastSale?.invoiceNumber}</span>
            </p>
            <p className="text-2xl font-bold">${lastSale?.total.toFixed(2)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSuccessOpen(false)}>
              Close
            </Button>
            <Button className="flex-1" onClick={handlePrintReceipt}>
              <Receipt className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
