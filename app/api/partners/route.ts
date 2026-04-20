import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createUser, hashPassword } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import type { User } from '@/lib/types';

export async function GET() {
  try {
    await requireAdmin();

    const partners = await query<User[]>(
      `SELECT id, username, email, role, full_name, phone, address, commission_rate, is_active, created_at 
       FROM users WHERE role = 'partner' ORDER BY created_at DESC`
    );

    return NextResponse.json({ success: true, partners });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get partners error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { username, email, password, full_name, phone, address, commission_rate } = body;

    if (!username || !email || !password || !full_name) {
      return NextResponse.json(
        { success: false, error: 'Required fields: username, email, password, full_name' },
        { status: 400 }
      );
    }

    const result = await createUser({
      username,
      email,
      password,
      role: 'partner',
      full_name,
      phone,
      address,
      commission_rate: parseFloat(commission_rate) || 0,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, partnerId: result.userId });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create partner error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create partner' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { id, username, email, password, full_name, phone, address, commission_rate, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Partner ID required' }, { status: 400 });
    }

    // Check if partner exists
    const existing = await queryOne<User>('SELECT * FROM users WHERE id = ? AND role = ?', [id, 'partner']);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 });
    }

    // Build update query
    let updateQuery = `UPDATE users SET 
      username = ?, email = ?, full_name = ?, phone = ?, address = ?, 
      commission_rate = ?, is_active = ?`;
    const params: (string | number | boolean | null)[] = [
      username || existing.username,
      email || existing.email,
      full_name || existing.full_name,
      phone || null,
      address || null,
      parseFloat(commission_rate) || existing.commission_rate,
      is_active !== undefined ? is_active : existing.is_active,
    ];

    // Only update password if provided
    if (password) {
      updateQuery += ', password_hash = ?';
      params.push(await hashPassword(password));
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await query(updateQuery, params);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update partner error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Partner ID required' }, { status: 400 });
    }

    // Soft delete - set is_active to false
    await query('UPDATE users SET is_active = FALSE WHERE id = ? AND role = ?', [id, 'partner']);

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'Unauthorized' || (error as Error).message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete partner error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete partner' }, { status: 500 });
  }
}
