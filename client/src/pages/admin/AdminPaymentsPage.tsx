import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  User,
  Calendar,
  IndianRupee,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PaymentRecord } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { formatINR } from '../../utils/currency';
import { PaymentProofViewer } from '../../components/common/PaymentProofViewer';

export const AdminPaymentsPage: React.FC = () => {
  const { error: toastError } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [hasProofFilter, setHasProofFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected payment for viewing evidence
  const [inspectingPayment, setInspectingPayment] = useState<PaymentRecord | null>(null);

  const fetchAdminPayments = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(targetPage));
      params.append('limit', String(pagination.limit));
      if (statusFilter) params.append('status', statusFilter);
      if (hasProofFilter) params.append('hasProof', hasProofFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/admin/payments?${params.toString()}`);
      if (res.data?.success) {
        setPayments(res.data.payments || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch platform payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminPayments(1);
  }, [statusFilter, hasProofFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAdminPayments(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="emerald">PAID</Badge>;
      case 'PROCESSING':
        return <Badge variant="amber">PROCESSING</Badge>;
      case 'DUE':
        return <Badge variant="slate">DUE</Badge>;
      case 'DISPUTED':
        return <Badge variant="rose">DISPUTED</Badge>;
      case 'CANCELLED':
        return <Badge variant="slate">CANCELLED</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments & Proof Evidence Review</h1>
        <p className="text-xs text-slate-500">
          Centralized marketplace audit of all wage disbursements, bank UTR references, and MongoDB GridFS payment proof attachments.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by UTR, payment method, or notes..."
              className="w-full pl-9 pr-3 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="DUE">DUE</option>
              <option value="DISPUTED">DISPUTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <select
              value={hasProofFilter}
              onChange={(e) => setHasProofFilter(e.target.value)}
              className="text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none"
            >
              <option value="">All Evidence</option>
              <option value="true">With Attached Proof</option>
              <option value="false">No Proof Attached</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white focus:outline-none"
              title="Start Date"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white focus:outline-none"
              title="End Date"
            />

            <Button type="submit" size="sm" variant="primary">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Data Table */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment records found"
          description="Try broadening your search or clearing date and status filters."
        />
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Shift / Job</th>
                  <th className="p-3">Worker (Payee)</th>
                  <th className="p-3">Employer</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Method & UTR</th>
                  <th className="p-3">Evidence</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const jobTitle = typeof p.job === 'object' ? p.job?.title : 'Shift Job';
                  const proofsCount = p.proofs?.length || 0;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-medium text-slate-900 max-w-[180px]">
                        <div className="truncate font-semibold" title={jobTitle}>
                          {jobTitle}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{p.worker?.name || 'Worker'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{p.worker?.email}</div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{p.employer?.name || 'Employer'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{p.employer?.email}</div>
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {formatINR(p.amount)}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {p.basis === 'shift' ? 'Per Shift' : 'Hourly'}
                        </span>
                      </td>

                      <td className="p-3">{getStatusBadge(p.status)}</td>

                      <td className="p-3">
                        <div className="font-medium text-slate-700">{p.paymentMethod || 'Direct'}</div>
                        {p.providerReference && (
                          <div className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]" title={p.providerReference}>
                            Ref: {p.providerReference}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {proofsCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setInspectingPayment(p)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Paperclip className="w-3 h-3 text-emerald-600" />
                            <span>{proofsCount} proof{proofsCount > 1 ? 's' : ''}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">None</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {proofsCount > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInspectingPayment(p)}
                          >
                            Inspect
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center text-xs text-slate-500 px-1">
            <span>
              Showing {payments.length} of {pagination.total} payment records
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchAdminPayments(pagination.page - 1)}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <span className="font-medium text-slate-700">
                Page {pagination.page} of {pagination.pages || 1}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchAdminPayments(pagination.page + 1)}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Proof Inspection Modal */}
      {inspectingPayment && (
        <Modal
          isOpen={Boolean(inspectingPayment)}
          onClose={() => setInspectingPayment(null)}
          title={`Administrative Payment Evidence Review`}
          subtitle={`${typeof inspectingPayment.job === 'object' ? inspectingPayment.job?.title : 'Shift'} • ${formatINR(inspectingPayment.amount)} • Status: ${inspectingPayment.status}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span>Employer: <strong>{inspectingPayment.employer?.name}</strong></span>
                <span>Payee Worker: <strong>{inspectingPayment.worker?.name}</strong></span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Disbursement Method: <strong>{inspectingPayment.paymentMethod}</strong></span>
                <span>Transaction Ref: <strong>{inspectingPayment.providerReference || 'None'}</strong></span>
              </div>
              {inspectingPayment.notes && (
                <p className="text-[11px] text-slate-600 italic pt-1 border-t border-slate-200">
                  Notes: "{inspectingPayment.notes}"
                </p>
              )}
            </div>

            <PaymentProofViewer
              paymentId={inspectingPayment._id}
              proofs={inspectingPayment.proofs || []}
              allowDelete={false}
              title="Verified GridFS Proof Attachments"
            />

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setInspectingPayment(null)}>
                Close Audit View
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
