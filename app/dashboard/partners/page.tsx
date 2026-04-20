'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
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
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import type { User } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PartnerFormData {
  id?: number;
  username: string;
  email: string;
  password: string;
  full_name: string;
  phone: string;
  address: string;
  commission_rate: string;
  is_active: boolean;
}

const emptyForm: PartnerFormData = {
  username: '',
  email: '',
  password: '',
  full_name: '',
  phone: '',
  address: '',
  commission_rate: '0',
  is_active: true,
};

export default function PartnersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; partners: User[] }>(
    '/api/partners',
    fetcher
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PartnerFormData>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const openAddDialog = () => {
    setFormData(emptyForm);
    setIsEditing(false);
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (partner: User) => {
    setFormData({
      id: partner.id,
      username: partner.username,
      email: partner.email,
      password: '',
      full_name: partner.full_name,
      phone: partner.phone || '',
      address: partner.address || '',
      commission_rate: partner.commission_rate.toString(),
      is_active: partner.is_active,
    });
    setIsEditing(true);
    setFormError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('/api/partners', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      setDialogOpen(false);
      mutate();
    } catch {
      setFormError('Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this partner?')) return;

    try {
      await fetch(`/api/partners?id=${id}`, { method: 'DELETE' });
      mutate();
    } catch (error) {
      console.error('Delete error:', error);
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
          <h1 className="text-2xl font-bold">Partners</h1>
          <p className="text-muted-foreground">Manage partner accounts and commissions</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Partner List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error || !data?.success ? (
            <p className="text-muted-foreground text-center py-8">
              Failed to load partners. Please check your database connection.
            </p>
          ) : data.partners.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No partners yet. Add your first partner to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.full_name}</TableCell>
                    <TableCell>{partner.username}</TableCell>
                    <TableCell>{partner.email}</TableCell>
                    <TableCell>{partner.phone || '-'}</TableCell>
                    <TableCell>{partner.commission_rate}%</TableCell>
                    <TableCell>
                      <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                        {partner.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(partner)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(partner.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Partner' : 'Add New Partner'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel>Full Name *</FieldLabel>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Username *</FieldLabel>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Email *</FieldLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>{isEditing ? 'New Password (leave blank to keep)' : 'Password *'}</FieldLabel>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!isEditing}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Phone</FieldLabel>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel>Commission Rate (%)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>Address</FieldLabel>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </Field>
            </FieldGroup>

            {formError && (
              <p className="text-sm text-destructive mt-4">{formError}</p>
            )}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                {isEditing ? 'Save Changes' : 'Add Partner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
