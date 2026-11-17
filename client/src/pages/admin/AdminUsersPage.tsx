import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Mail,
  Calendar,
  Briefcase,
  Star,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Building2
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const AdminUsersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const { success, error: toastError } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [verificationFilter, setVerificationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({ totalPages: 1, totalCount: 0 });

  // Detail Modal state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Moderation / Suspension Modal state
  const [modifyingUser, setModifyingUser] = useState<any | null>(null);
  const [targetStatus, setTargetStatus] = useState<'active' | 'suspended'>('suspended');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync statusFilter if URL search params change
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus && urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', '12');
      if (search.trim()) params.append('search', search.trim());
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (verificationFilter) params.append('verificationStatus', verificationFilter);

      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res.data?.success) {
        setUsers(res.data.users || []);
        setPagination(res.data.pagination || { totalPages: 1, totalCount: 0 });
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter, verificationFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleOpenDetails = async (u: any) => {
    setSelectedUser(u);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/admin/users/${u._id || u.id}`);
      if (res.data?.success) {
        setUserDetails(res.data);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch user details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingUser) return;
    if (!reason.trim()) {
      toastError('Please provide a mandatory justification reason.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userId = modifyingUser._id || modifyingUser.id;
      const res = await api.patch(`/admin/users/${userId}/status`, {
        status: targetStatus,
        reason: reason.trim()
      });
      if (res.data?.success) {
        success(`User status changed to ${targetStatus}.`);
        setModifyingUser(null);
        setReason('');
        fetchUsers();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update user status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            User Account Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit user profiles, dual-role credentials, verification badges, and account moderation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="slate">
            Total Users: {pagination.totalCount}
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user name or email address..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="worker">Worker</option>
              <option value="employer">Employer</option>
              <option value="admin">Administrator</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Account Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="">All Verification</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="pending">Pending Review</option>
            </select>

            <Button type="submit" size="sm" className="text-xs">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Users Table */}
      <Card className="bg-white border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No users found</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Roles & Workspace</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => {
                  const isDualRole = (u.roles && u.roles.length > 1) || (u.hasWorkerProfile && u.hasEmployerProfile);

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{u.email}</span>
                          {u.emailVerified && (
                            <span title="Email Verified">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Roles & Dual-Role Badges */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="capitalize font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {u.activeRole || u.role}
                          </span>
                          {isDualRole && (
                            <span className="bg-primary-50 text-primary-700 border border-primary-200/60 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              Dual-Role
                            </span>
                          )}
                        </div>
                        {u.businessName && (
                          <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[150px]">
                            🏢 {u.businessName}
                          </span>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.verificationStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : u.verificationStatus === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span className="capitalize">{u.verificationStatus || 'Unverified'}</span>
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.accountStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : u.accountStatus === 'suspended'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <span className="capitalize">{u.accountStatus || 'active'}</span>
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetails(u)}
                          className="text-xs px-2.5 py-1"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
                        </Button>

                        {u.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant={u.accountStatus === 'suspended' ? 'outline' : 'danger'}
                            onClick={() => {
                              setModifyingUser(u);
                              setTargetStatus(u.accountStatus === 'suspended' ? 'active' : 'suspended');
                            }}
                            className="text-xs px-2.5 py-1"
                          >
                            {u.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} users)
            </span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* User Details Modal */}
      {selectedUser && (
        <Modal
          isOpen={Boolean(selectedUser)}
          onClose={() => {
            setSelectedUser(null);
            setUserDetails(null);
          }}
          title={`User Profile: ${selectedUser.name}`}
          maxWidth="lg"
        >
          {loadingDetails ? (
            <LoadingSkeleton rows={4} />
          ) : userDetails ? (
            <div className="space-y-4 text-xs">
              {/* Core Credentials Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                    <span className="font-semibold text-slate-900">{userDetails.user?.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Role</span>
                    <span className="capitalize font-semibold text-slate-900">{userDetails.user?.activeRole || userDetails.user?.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Account Status</span>
                    <span className="capitalize font-semibold text-slate-900">{userDetails.user?.accountStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email Verified</span>
                    <span className="font-semibold text-slate-900">{userDetails.user?.emailVerified ? 'Yes (Verified)' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Worker Profile Section */}
              {userDetails.workerProfile && (
                <div className="p-3.5 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-primary-600" />
                    <span>Worker Profile Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>Location: {userDetails.workerProfile.preferredLocationName || 'N/A'}</div>
                    <div>Completed Jobs: {userDetails.workerProfile.completedJobsCount || 0}</div>
                    <div>Rating: {userDetails.workerProfile.rating?.average || 5.0} / 5.0</div>
                    <div>Travel Radius: {userDetails.workerProfile.travelRadiusKm || 25} km</div>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-400 block text-[10px] uppercase">Skills</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {userDetails.workerProfile.skills?.map((s: string) => (
                        <span key={s} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Employer Profile Section */}
              {userDetails.employerProfile && (
                <div className="p-3.5 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Employer Profile Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <div>Business Name: {userDetails.employerProfile.businessName}</div>
                    <div>Category: {userDetails.employerProfile.businessCategory || 'General'}</div>
                    <div>Address: {userDetails.employerProfile.businessAddress || 'N/A'}</div>
                    <div>Jobs Posted: {userDetails.stats?.totalJobsPosted || 0}</div>
                  </div>
                </div>
              )}

              {/* Reports Against User */}
              {userDetails.reportsAgainst && userDetails.reportsAgainst.length > 0 && (
                <div className="p-3.5 border border-rose-200 bg-rose-50/50 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reports & Complaints Filed Against User ({userDetails.reportsAgainst.length})</span>
                  </div>
                  <div className="space-y-1">
                    {userDetails.reportsAgainst.map((r: any) => (
                      <div key={r._id} className="text-[11px] text-rose-900 bg-white p-2 rounded border border-rose-100">
                        <span className="font-semibold capitalize">{r.category.replace(/_/g, ' ')}</span>: {r.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}

      {/* Moderation Action Modal */}
      {modifyingUser && (
        <Modal
          isOpen={Boolean(modifyingUser)}
          onClose={() => setModifyingUser(null)}
          title={`${targetStatus === 'suspended' ? 'Suspend' : 'Reactivate'} Account: ${modifyingUser.name}`}
        >
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Account Moderation Invariant</p>
                <p className="mt-0.5">
                  {targetStatus === 'suspended'
                    ? 'Suspending an account temporarily revokes login and active shift participation. All actions are recorded in the immutable Admin Activity Log.'
                    : 'Reactivating will restore account access.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Justification Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State the regulatory or safety reason for this moderation action..."
                rows={3}
                required
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setModifyingUser(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={targetStatus === 'suspended' ? 'danger' : 'primary'}
                size="sm"
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting ? 'Recording...' : `Confirm ${targetStatus === 'suspended' ? 'Suspension' : 'Reactivation'}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
