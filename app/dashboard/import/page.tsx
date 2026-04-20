'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState('skip');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const res = await fetch('/api/import/products', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error);
        return;
      }

      setResult(data.results);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Create template CSV
    const headers = ['barcode', 'name', 'description', 'category', 'cost_price', 'selling_price', 'stock_quantity', 'min_stock_level', 'unit'];
    const example = ['PRD001', 'Example Product', 'Product description', 'Electronics', '10.00', '15.99', '100', '10', 'piece'];
    
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Excel Import</h1>
        <p className="text-muted-foreground">Bulk import products from Excel or CSV files</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Products
            </CardTitle>
            <CardDescription>
              Upload an Excel (.xlsx) or CSV file to import products in bulk
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>File</FieldLabel>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  {file ? (
                    <p className="font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="font-medium">Click to upload</p>
                      <p className="text-sm text-muted-foreground">
                        Supports .xlsx, .xls, .csv
                      </p>
                    </>
                  )}
                </div>
              </Field>

              <Field>
                <FieldLabel>Duplicate Handling</FieldLabel>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip duplicates</SelectItem>
                    <SelectItem value="update">Update existing</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Duplicates are identified by barcode
                </p>
              </Field>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleImport} disabled={!file || importing} className="flex-1">
                  {importing && <Spinner className="mr-2" />}
                  {importing ? 'Importing...' : 'Import Products'}
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Required Columns</CardTitle>
            <CardDescription>
              Your file must contain these columns (case-sensitive)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">barcode</TableCell>
                  <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Auto-generated if empty</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">name</TableCell>
                  <TableCell><Badge>Required</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Product name</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">description</TableCell>
                  <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Product description</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">category</TableCell>
                  <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Category name (auto-created)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">cost_price</TableCell>
                  <TableCell><Badge>Required</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Cost/purchase price</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">selling_price</TableCell>
                  <TableCell><Badge>Required</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Selling price</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">stock_quantity</TableCell>
                  <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Default: 0</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">min_stock_level</TableCell>
                  <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Default: 10</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">unit</TableCell>
                  <TableCell><Badge variant="secondary">Optional</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">Default: piece</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Import Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-lg">
                <div className="p-3 bg-destructive/10 border-b flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">
                    {result.errors.length} Error{result.errors.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto p-3 space-y-1">
                  {result.errors.map((error, index) => (
                    <p key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
