import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
  CreditCard
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

export const EmployerPaymentsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [recordingPayment, setRecordingPayment] = useState<PaymentRecord | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PROCESSING' | 'DISPUTED'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState('Direct Bank Transfer');
  const [providerReference, setProviderReference] = useState('');
  const [note, setNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/me');
      if (res.data?.success) {
        setPayments(res.data.payments || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingPayment) return;

    setIsUpdating(true);
    try {
      const res = await api.patch(`/payments/${recordingPayment._id}/status`, {
        status: paymentStatus,
        paymentMethod,
        providerReference,
        note
      });
      if (res.data?.success) {
        success(`Payment recorded as ${paymentStatus}. Worker has been notified.`);
        setRecordingPayment(null);
        fetchPayments();
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Compensation & Disbursements</h1>
        <p className="text-xs text-slate-500">
          Record disbursed wages, add bank payment references, and maintain audit transparency.
        </p>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No pending or recorded payments"
          description="Payment records generate automatically upon confirmed worker hiring."
        />
      ) : (
        <div className="space-y-4">
          {payments.map((p) => {
            const jobTitle = typeof p.job === 'object' ? p.job?.title : 'Shift';
            return (
              <Card key={p._id} className="p-6 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={p.status === 'PAID' ? 'emerald' : 'amber'} className="shrink-0">
                        {p.status}
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs" title={p.worker?.name}>
                        Worker: <span className="font-semibold text-slate-800">{p.worker?.name}</span>
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{jobTitle}</h3>
                    <div className="text-xs text-slate-500">
                      Method: {p.paymentMethod || 'Direct Recorded'} • Created: {new Date(p.createdAt).toLocaleDateString()}
                    </div>

                    {p.providerReference && (
                      <div className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded inline-block mt-1">
                        Ref: {p.providerReference}
                      </div>
                    )}
                  </div>

                  <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div>
                      <div className="text-2xl font-black text-slate-900">
                        ${p.amount.toFixed(2)}
                      </div>
                      <span className="text-xs text-slate-400">Basis: {p.basis}</span>
                    </div>

                    <Button
                      size="sm"
                      variant={p.status === 'PAID' ? 'outline' : 'primary'}
                      onClick={() => {
                        setRecordingPayment(p);
                        setPaymentStatus(p.status === 'PAID' ? 'PAID' : 'PAID');
                        setPaymentMethod(p.paymentMethod || 'Direct Bank Transfer');
                        setProviderReference(p.providerReference || '');
                      }}
                      leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                    >
                      {p.status === 'PAID' ? 'Update Details' : 'Record as Paid'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={Boolean(recordingPayment)}
        onClose={() => setRecordingPayment(null)}
        title="Record Payment Status"
        subtitle={recordingPayment ? `Worker: ${recordingPayment.worker?.name} ($${recordingPayment.amount})` : ''}
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e: any) => setPaymentStatus(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
            >
              <option value="PAID">PAID (Disbursed to worker)</option>
              <option value="PROCESSING">PROCESSING (Initiated via bank/payroll)</option>
              <option value="DISPUTED">DISPUTED (Incident/Attendance under review)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Disbursement Method</label>
            <input
              type="text"
              required
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. ACH Direct Transfer, Venmo/Zelle, Payroll Check"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Bank / Transfer Reference Code</label>
            <input
              type="text"
              value={providerReference}
              onChange={(e) => setProviderReference(e.target.value)}
              placeholder="e.g. TXN-89412-ACH or Check #1042"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes to Worker</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Direct deposit initiated for completed shift at Javits Center..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setRecordingPayment(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isUpdating}>
              Save Payment Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
