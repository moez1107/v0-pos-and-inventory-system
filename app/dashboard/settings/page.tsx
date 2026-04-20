'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Store, Receipt, AlertTriangle, Save } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SettingsPage() {
  const { data, isLoading, mutate } = useSWR('/api/settings', fetcher);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    tax_rate: '0',
    currency_symbol: '$',
    invoice_prefix: 'INV',
    thermal_printer_width: '80',
    low_stock_alert: '10',
  });

  useEffect(() => {
    if (data?.success && data.settings) {
      setSettings({
        company_name: data.settings.company_name || '',
        company_address: data.settings.company_address || '',
        company_phone: data.settings.company_phone || '',
        company_email: data.settings.company_email || '',
        tax_rate: data.settings.tax_rate || '0',
        currency_symbol: data.settings.currency_symbol || '$',
        invoice_prefix: data.settings.invoice_prefix || 'INV',
        thermal_printer_width: data.settings.thermal_printer_width || '80',
        low_stock_alert: data.settings.low_stock_alert || '10',
      });
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const result = await res.json();
      if (!result.success) {
        alert(result.error);
        return;
      }

      mutate();
      alert('Settings saved successfully');
    } catch {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your POS system preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              This information will appear on invoices and receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Company Name</FieldLabel>
                <Input
                  value={settings.company_name}
                  onChange={(e) =>
                    setSettings({ ...settings, company_name: e.target.value })
                  }
                  placeholder="My Store"
                />
              </Field>
              <Field>
                <FieldLabel>Address</FieldLabel>
                <Input
                  value={settings.company_address}
                  onChange={(e) =>
                    setSettings({ ...settings, company_address: e.target.value })
                  }
                  placeholder="123 Main Street, City"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Phone</FieldLabel>
                  <Input
                    value={settings.company_phone}
                    onChange={(e) =>
                      setSettings({ ...settings, company_phone: e.target.value })
                    }
                    placeholder="+1234567890"
                  />
                </Field>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    value={settings.company_email}
                    onChange={(e) =>
                      setSettings({ ...settings, company_email: e.target.value })
                    }
                    placeholder="contact@store.com"
                  />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice Settings
            </CardTitle>
            <CardDescription>
              Configure invoice numbering and printing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Invoice Prefix</FieldLabel>
                  <Input
                    value={settings.invoice_prefix}
                    onChange={(e) =>
                      setSettings({ ...settings, invoice_prefix: e.target.value })
                    }
                    placeholder="INV"
                  />
                </Field>
                <Field>
                  <FieldLabel>Currency Symbol</FieldLabel>
                  <Select
                    value={settings.currency_symbol}
                    onValueChange={(value) =>
                      setSettings({ ...settings, currency_symbol: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="$">$ (USD)</SelectItem>
                      <SelectItem value="€">€ (EUR)</SelectItem>
                      <SelectItem value="£">£ (GBP)</SelectItem>
                      <SelectItem value="₹">₹ (INR)</SelectItem>
                      <SelectItem value="¥">¥ (JPY/CNY)</SelectItem>
                      <SelectItem value="₿">₿ (BTC)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>Tax Rate (%)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settings.tax_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, tax_rate: e.target.value })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Applied automatically to all sales
                </p>
              </Field>
              <Field>
                <FieldLabel>Thermal Printer Width</FieldLabel>
                <Select
                  value={settings.thermal_printer_width}
                  onValueChange={(value) =>
                    setSettings({ ...settings, thermal_printer_width: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Inventory Alerts
            </CardTitle>
            <CardDescription>
              Configure low stock notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Low Stock Alert Threshold</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={settings.low_stock_alert}
                  onChange={(e) =>
                    setSettings({ ...settings, low_stock_alert: e.target.value })
                  }
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Products below this quantity will be flagged as low stock
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              Technical details about your system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Database</span>
                <span className="font-mono">MySQL</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Authentication</span>
                <span className="font-mono">JWT</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Printing</span>
                <span className="font-mono">Thermal + A4</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
