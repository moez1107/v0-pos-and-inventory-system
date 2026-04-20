'use client';

import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Sale, Settings } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceNumber = params.invoiceNumber as string;
  const printMode = searchParams.get('print');
  const printRef = useRef<HTMLDivElement>(null);

  const { data: saleData, isLoading: saleLoading } = useSWR<{ success: boolean; sale: Sale }>(
    `/api/sales?invoice=${invoiceNumber}`,
    fetcher
  );

  const { data: settingsData } = useSWR<{ success: boolean; settings: Record<string, string> }>(
    '/api/settings',
    fetcher
  );

  const sale = saleData?.sale;
  const settings = settingsData?.settings || {};
  const isThermal = printMode === 'thermal';

  // Auto-print if print mode is set
  useEffect(() => {
    if (printMode && sale && !saleLoading) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [printMode, sale, saleLoading]);

  const handlePrint = (thermal: boolean) => {
    const url = `/dashboard/invoice/${invoiceNumber}?print=${thermal ? 'thermal' : 'a4'}`;
    window.open(url, '_blank');
  };

  if (saleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Invoice not found</p>
        <Link href="/dashboard/pos">
          <Button variant="link">Go back to POS</Button>
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print, #invoice-print * {
            visibility: visible;
          }
          #invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          ${isThermal ? `
            @page {
              size: ${settings.thermal_printer_width || '80'}mm auto;
              margin: 0;
            }
            #invoice-print {
              width: ${settings.thermal_printer_width || '80'}mm;
              font-size: 12px;
              padding: 4mm;
            }
          ` : `
            @page {
              size: A4;
              margin: 15mm;
            }
          `}
        }
      `}</style>

      {/* Action Buttons - Hidden in print */}
      {!printMode && (
        <div className="mb-6 flex items-center justify-between no-print">
          <Link href="/dashboard/pos">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to POS
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handlePrint(true)}>
              <Printer className="h-4 w-4 mr-2" />
              Thermal Print
            </Button>
            <Button variant="outline" onClick={() => handlePrint(false)}>
              <Download className="h-4 w-4 mr-2" />
              A4 Print
            </Button>
          </div>
        </div>
      )}

      {/* Invoice Content */}
      <div
        id="invoice-print"
        ref={printRef}
        className={`bg-white text-black mx-auto ${
          isThermal ? 'max-w-[80mm] text-xs' : 'max-w-2xl p-8 shadow-lg rounded-lg'
        }`}
      >
        {/* Header */}
        <div className={`text-center ${isThermal ? 'mb-2' : 'mb-6'}`}>
          <h1 className={`font-bold ${isThermal ? 'text-sm' : 'text-xl'}`}>
            {settings.company_name || 'My Store'}
          </h1>
          <p className={isThermal ? 'text-[10px]' : 'text-sm text-gray-600'}>
            {settings.company_address || ''}
          </p>
          <p className={isThermal ? 'text-[10px]' : 'text-sm text-gray-600'}>
            {settings.company_phone || ''}
          </p>
        </div>

        {/* Invoice Info */}
        <div className={`${isThermal ? 'border-t border-b border-dashed border-gray-400 py-1 my-1' : 'border-t border-b py-4 my-4'}`}>
          <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
            <span>Invoice #:</span>
            <span className="font-mono">{sale.invoice_number}</span>
          </div>
          <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
            <span>Date:</span>
            <span>{formatDate(sale.created_at)}</span>
          </div>
          <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
            <span>Cashier:</span>
            <span>{sale.user_name}</span>
          </div>
          {sale.customer_name && (
            <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              <span>Customer:</span>
              <span>{sale.customer_name}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className={isThermal ? 'my-1' : 'my-4'}>
          <table className="w-full">
            <thead>
              <tr className={`${isThermal ? 'text-[10px]' : 'text-sm'} border-b`}>
                <th className="text-left py-1">Item</th>
                <th className="text-center py-1">Qty</th>
                <th className="text-right py-1">Price</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, index) => (
                <tr key={index} className={isThermal ? 'text-[10px]' : 'text-sm'}>
                  <td className="py-1">
                    <div className={isThermal ? 'max-w-[100px] truncate' : ''}>
                      {item.product_name}
                    </div>
                    {!isThermal && (
                      <div className="text-xs text-gray-500 font-mono">{item.barcode}</div>
                    )}
                  </td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-right py-1">{settings.currency_symbol || '$'}{item.unit_price.toFixed(2)}</td>
                  <td className="text-right py-1">{settings.currency_symbol || '$'}{item.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className={`${isThermal ? 'border-t border-dashed border-gray-400 pt-1' : 'border-t pt-4'}`}>
          <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
            <span>Subtotal:</span>
            <span>{settings.currency_symbol || '$'}{sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              <span>Discount{sale.discount_percent > 0 ? ` (${sale.discount_percent}%)` : ''}:</span>
              <span>-{settings.currency_symbol || '$'}{sale.discount_amount.toFixed(2)}</span>
            </div>
          )}
          {sale.tax_amount > 0 && (
            <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'}`}>
              <span>Tax:</span>
              <span>{settings.currency_symbol || '$'}{sale.tax_amount.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between font-bold ${isThermal ? 'text-xs mt-1 pt-1 border-t border-dashed' : 'text-lg mt-2 pt-2 border-t'}`}>
            <span>TOTAL:</span>
            <span>{settings.currency_symbol || '$'}{sale.total_amount.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between ${isThermal ? 'text-[10px]' : 'text-sm'} mt-1`}>
            <span>Payment:</span>
            <span className="capitalize">{sale.payment_method}</span>
          </div>
        </div>

        {/* Footer */}
        <div className={`text-center ${isThermal ? 'mt-2 pt-2 border-t border-dashed text-[10px]' : 'mt-6 pt-4 border-t text-sm'}`}>
          <p>Thank you for your purchase!</p>
          {settings.company_email && (
            <p className="text-gray-500">{settings.company_email}</p>
          )}
        </div>
      </div>
    </>
  );
}
