import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query, queryOne, pool } from '@/lib/db';
import * as XLSX from 'xlsx';

interface ProductRow {
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  cost_price: number;
  selling_price: number;
  stock_quantity?: number;
  min_stock_level?: number;
  unit?: string;
}

// Generate unique barcode
function generateBarcode(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PRD${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  const connection = await pool.getConnection();
  
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'skip'; // skip, update, or replace

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<ProductRow>(worksheet);

    if (data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data found in file' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    const results = {
      total: data.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Cache categories
    const categoryCache: Record<string, number> = {};

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)

      try {
        // Validate required fields
        if (!row.name) {
          results.errors.push(`Row ${rowNum}: Product name is required`);
          results.skipped++;
          continue;
        }

        if (row.cost_price === undefined || row.selling_price === undefined) {
          results.errors.push(`Row ${rowNum}: Cost price and selling price are required`);
          results.skipped++;
          continue;
        }

        // Handle category
        let categoryId: number | null = null;
        if (row.category) {
          if (categoryCache[row.category]) {
            categoryId = categoryCache[row.category];
          } else {
            // Check if category exists
            let category = await queryOne<{ id: number }>(
              'SELECT id FROM categories WHERE name = ?',
              [row.category]
            );

            if (!category) {
              // Create category
              const [result] = await connection.execute(
                'INSERT INTO categories (name) VALUES (?)',
                [row.category]
              );
              categoryId = (result as { insertId: number }).insertId;
            } else {
              categoryId = category.id;
            }
            categoryCache[row.category] = categoryId;
          }
        }

        // Handle barcode
        const barcode = row.barcode || generateBarcode();

        // Check if product exists
        const existing = await queryOne<{ id: number }>(
          'SELECT id FROM products WHERE barcode = ?',
          [barcode]
        );

        if (existing) {
          if (mode === 'skip') {
            results.skipped++;
            continue;
          } else if (mode === 'update') {
            await connection.execute(
              `UPDATE products SET 
               name = ?, description = ?, category_id = ?, 
               cost_price = ?, selling_price = ?, 
               stock_quantity = ?, min_stock_level = ?, unit = ?
               WHERE id = ?`,
              [
                row.name,
                row.description || null,
                categoryId,
                parseFloat(String(row.cost_price)),
                parseFloat(String(row.selling_price)),
                parseInt(String(row.stock_quantity)) || 0,
                parseInt(String(row.min_stock_level)) || 10,
                row.unit || 'piece',
                existing.id,
              ]
            );
            results.updated++;
            continue;
          }
        }

        // Insert new product
        await connection.execute(
          `INSERT INTO products 
           (barcode, name, description, category_id, cost_price, selling_price, 
            stock_quantity, min_stock_level, unit) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            barcode,
            row.name,
            row.description || null,
            categoryId,
            parseFloat(String(row.cost_price)),
            parseFloat(String(row.selling_price)),
            parseInt(String(row.stock_quantity)) || 0,
            parseInt(String(row.min_stock_level)) || 10,
            row.unit || 'piece',
          ]
        );
        results.imported++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Row ${rowNum}: ${message}`);
        results.skipped++;
      }
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    await connection.rollback();
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Import error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to import products' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
