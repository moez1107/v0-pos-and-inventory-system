import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'partner';
  full_name: string;
  phone?: string;
  address?: string;
  commission_rate: number;
  is_active: boolean;
}

interface UserRow extends User {
  password_hash: string;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-in-production');
const COOKIE_NAME = 'pos_auth_token';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(user: User): Promise<string> {
  return new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as User;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await queryOne<UserRow>(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE',
      [username, username]
    );

    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    const token = await createToken(user);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    const { password_hash: _, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload) return null;

    const user = await queryOne<UserRow>(
      'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
      [payload.id]
    );

    if (!user) return null;

    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'partner';
  full_name: string;
  phone?: string;
  address?: string;
  commission_rate?: number;
}): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    const password_hash = await hashPassword(data.password);
    
    const result = await query<{ insertId: number }>(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, address, commission_rate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.username,
        data.email,
        password_hash,
        data.role,
        data.full_name,
        data.phone || null,
        data.address || null,
        data.commission_rate || 0,
      ]
    );

    return { success: true, userId: (result as unknown as { insertId: number }).insertId };
  } catch (error) {
    console.error('Create user error:', error);
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { success: false, error: 'Username or email already exists' };
    }
    return { success: false, error: 'Failed to create user' };
  }
}
