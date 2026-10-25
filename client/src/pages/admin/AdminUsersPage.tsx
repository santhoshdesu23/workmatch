import React, { useState, useEffect } from 'react';
import { Users, Search, ShieldCheck, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { User } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminUsersPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Status moderation modal
  const [modifyingUser, setModifyingUser] = useState<User | null>(null);
  const [targetStatus, setTargetStatus] = useState<'active' | 'suspended'>('suspended');
  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);

      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res.data?.success) {
        setUsers(res.data.users || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingUser) return;

    setIsUpdating(true);
    try {
      const res = await api.patch(`/admin/users/${modifyingUser.id || (modifyingUser as any)._id}/status`, {
        status: targetStatus,
        reason
      });
      if (res.data?.success) {
        success(`User marked as ${targetStatus}.`);
        setModifyingUser(null);
        setReason('');
        fetchUsers();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Account Moderation</h1>
          <p className="text-xs text-slate-500">
            Audit user records, verify status badges, and manage suspensions with logged reasons.
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            placeholder="Search name or email..."
            className="text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="worker">Worker</option>
            <option value="employer">Employer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Verification</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u: any) => (
                <tr key={u._id || u.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5 max-w-[220px]">
                    <span className="font-bold text-slate-900 block truncate" title={u.name}>{u.name}</span>
                    <span className="text-slate-400 block truncate" title={u.email}>{u.email}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={u.role === 'worker' ? 'emerald' : u.role === 'employer' ? 'blue' : 'amber'} size="sm">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 font-semibold capitalize ${u.verificationStatus === 'verified' ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {u.verificationStatus === 'verified' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      {u.verificationStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={u.accountStatus === 'active' ? 'emerald' : 'rose'} size="sm">
                      {u.accountStatus}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setModifyingUser(u);
                        setTargetStatus(u.accountStatus === 'active' ? 'suspended' : 'active');
                      }}
                    >
                      {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Moderation Modal */}
      <Modal
        isOpen={Boolean(modifyingUser)}
        onClose={() => setModifyingUser(null)}
        title="Modify Account Status"
        subtitle={modifyingUser ? `${modifyingUser.name} (${modifyingUser.email})` : ''}
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Action</label>
            <select
              value={targetStatus}
              onChange={(e: any) => setTargetStatus(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
            >
              <option value="active">Activate Account</option>
              <option value="suspended">Suspend Account</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Audit Reason</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Record explicit reason for audit log..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setModifyingUser(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isUpdating}>
              Submit Status Change
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
