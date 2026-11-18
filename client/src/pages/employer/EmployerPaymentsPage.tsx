import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  FileCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  IndianRupee,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PaymentRecord, PaymentProof } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { formatINR } from '../../utils/currency';
import { PaymentProofUploader } from '../../components/common/PaymentProofUploader';
import { PaymentProofViewer } from '../../components/common/PaymentProofViewer';

export const EmployerPaymentsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for recording / updating payment
  const [recordingPayment, setRecordingPayment] = useState<PaymentRecord | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PROCESSING' | 'DUE' | 'DISPUTED' | 'CANCELLED'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Bank Transfer' | 'Cash' | 'Other'>('UPI');
  const [providerReference, setProviderReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmedDisbursed, setConfirmedDisbursed] = useState(false);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Separate viewing modal for quick evidence inspection from list
  const [inspectingPayment, setInspectingPayment] = useState<PaymentRecord | null>(null);

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

  const openRecordModal = (p: PaymentRecord) => {
    setRecordingPayment(p);
    setPaymentStatus(p.status === 'PAID' ? 'PAID' : 'PAID');
    // Normalize payment method
    let method: 'UPI' | 'Bank Transfer' | 'Cash' | 'Other' = 'UPI';
    const m = (p.paymentMethod || '').toLowerCase();
    if (m.includes('cash')) method = 'Cash';
    else if (m.includes('bank') || m.includes('neft') || m.includes('transfer')) method = 'Bank Transfer';
    else if (m.includes('other')) method = 'Other';
    setPaymentMethod(method);

    setProviderReference(p.providerReference || '');
    setNote(p.notes || '');
    setConfirmedDisbursed(p.status === 'PAID');
    setProofFiles([]);
  };

  const handleDeleteExistingProof = async (fileId: string) => {
    if (!recordingPayment) return;
    try {
      const res = await api.delete(`/api/payments/${recordingPayment._id}/proofs/${fileId}`);
      if (res.data?.success) {
        success('Payment proof removed successfully.');
        const updatedProofs = (recordingPayment.proofs || []).filter(
          (pr) => (pr.fileId || pr._id) !== fileId
        );
        setRecordingPayment({
          ...recordingPayment,
          proofs: updatedProofs
        });
        fetchPayments();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to remove proof.');
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingPayment) return;

    // Frontend validation rules matching prompt
    const existingProofCount = recordingPayment.proofs?.length || 0;
    const totalProofs = existingProofCount + proofFiles.length;

    if (paymentStatus === 'PAID') {
      if ((paymentMethod === 'UPI' || paymentMethod === 'Bank Transfer') && !providerReference.trim()) {
        toastError(`Please enter a valid Transaction / UTR reference for ${paymentMethod} payment.`);
        return;
      }

      if ((paymentMethod === 'UPI' || paymentMethod === 'Bank Transfer') && totalProofs === 0) {
        toastError(`Please upload a screenshot or receipt as proof of ${paymentMethod} payment.`);
        return;
      }

      if (paymentMethod === 'Other' && (!note.trim() || note.trim().length < 5)) {
        toastError('Please provide an explanatory note when choosing "Other" payment method.');
        return;
      }

      if (!confirmedDisbursed) {
        toastError('Please confirm that the wage payment was actually disbursed to the worker.');
        return;
      }
    }

    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append('status', paymentStatus);
      formData.append('paymentMethod', paymentMethod);
      formData.append('providerReference', providerReference.trim());
      formData.append('note', note.trim());
      formData.append('confirmedDisbursed', String(confirmedDisbursed));

      proofFiles.forEach((file) => {
        formData.append('proofs', file);
      });

      const res = await api.patch(`/payments/${recordingPayment._id}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        success(`Payment recorded as ${paymentStatus}. Worker has been notified.`);
        setRecordingPayment(null);
        setProofFiles([]);
        fetchPayments();
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to update payment record.');
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
          Record disbursed wages in Indian Rupees (₹), attach verified payment screenshots, and maintain audit transparency.
        </p>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No pending or recorded payments"
          description="Payment records generate automatically upon confirmed worker hiring and shift completion."
        />
      ) : (
        <div className="space-y-4">
          {payments.map((p) => {
            const jobTitle = typeof p.job === 'object' ? p.job?.title : 'Shift';
            const proofsCount = p.proofs?.length || 0;

            return (
              <Card key={p._id} className="p-6 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={p.status === 'PAID' ? 'emerald' : p.status === 'PROCESSING' ? 'amber' : 'slate'} className="shrink-0">
                        {p.status}
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs" title={p.worker?.name}>
                        Worker: <span className="font-semibold text-slate-800">{p.worker?.name}</span>
                      </span>
                      {p.workerConfirmedReceipt && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Worker Confirmed Receipt
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{jobTitle}</h3>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Method: <strong className="text-slate-700">{p.paymentMethod || 'Direct Recorded'}</strong></span>
                      <span>•</span>
                      <span>Recorded: {new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>

                    {p.providerReference && (
                      <div className="text-[11px] text-slate-600 font-mono bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg inline-block">
                        Ref / UTR: <strong className="text-slate-800">{p.providerReference}</strong>
                      </div>
                    )}

                    {/* Proof badge & button */}
                    {proofsCount > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setInspectingPayment(p)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{proofsCount} Payment Proof{proofsCount > 1 ? 's' : ''} Attached</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div>
                      <div className="text-2xl font-black text-slate-900 tracking-tight">
                        {formatINR(p.amount)}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Basis: {p.basis === 'shift' ? 'Per Shift Flat' : 'Hourly Rate'}
                      </span>
                    </div>

                    <div className="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant={p.status === 'PAID' ? 'outline' : 'primary'}
                        onClick={() => openRecordModal(p)}
                        leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                      >
                        {p.status === 'PAID' ? 'Update Details & Proof' : 'Record as Paid'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Record Payment Status Modal */}
      <Modal
        isOpen={Boolean(recordingPayment)}
        onClose={() => {
          setRecordingPayment(null);
          setProofFiles([]);
        }}
        title="Record Payment Status"
        subtitle={
          recordingPayment
            ? `Worker: ${recordingPayment.worker?.name} • Amount: ${formatINR(recordingPayment.amount)}`
            : ''
        }
      >
        {recordingPayment && (
          <form onSubmit={handleRecordSubmit} className="space-y-4">
            {/* Shift Context Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between items-center text-slate-700 font-semibold">
                <span>{typeof recordingPayment.job === 'object' ? recordingPayment.job?.title : 'Shift Job'}</span>
                <span className="text-emerald-700 font-bold text-sm">{formatINR(recordingPayment.amount)}</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Worker: {recordingPayment.worker?.name} ({recordingPayment.worker?.email})
              </p>
              <div className="text-[10px] text-slate-400">
                Agreed Basis: {recordingPayment.basis === 'shift' ? 'Per Shift Flat Payment' : 'Hourly Rate'}
              </div>
            </div>

            {/* Read-Only Amount Display */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Disbursement Amount (Read-Only)
              </label>
              <div className="w-full text-sm font-bold p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900">
                {formatINR(recordingPayment.amount)}
              </div>
            </div>

            {/* Status Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e: any) => setPaymentStatus(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
              >
                <option value="PAID">PAID (Wages fully disbursed to worker)</option>
                <option value="PROCESSING">PROCESSING (Initiated via bank / in progress)</option>
                <option value="DUE">DUE (Shift completed, payment pending)</option>
                <option value="DISPUTED">DISPUTED (Attendance / hours under verification)</option>
                <option value="CANCELLED">CANCELLED (Shift voided / cancelled)</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e: any) => setPaymentMethod(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
              >
                <option value="UPI">UPI (Google Pay, PhonePe, Paytm, BHIM)</option>
                <option value="Bank Transfer">Bank Transfer (NEFT, IMPS, RTGS)</option>
                <option value="Cash">Cash (In-person cash handover)</option>
                <option value="Other">Other (Specify in notes)</option>
              </select>
            </div>

            {/* Transaction Reference (Mandatory for UPI and Bank Transfer) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Reference / UTR Number{' '}
                {(paymentMethod === 'UPI' || paymentMethod === 'Bank Transfer') && (
                  <span className="text-rose-500">*</span>
                )}
              </label>
              <input
                type="text"
                required={paymentStatus === 'PAID' && (paymentMethod === 'UPI' || paymentMethod === 'Bank Transfer')}
                value={providerReference}
                onChange={(e) => setProviderReference(e.target.value)}
                placeholder={
                  paymentMethod === 'UPI'
                    ? 'e.g. 12-digit UPI Ref / UTR (e.g. 403819284729)'
                    : paymentMethod === 'Bank Transfer'
                    ? 'e.g. Bank IMPS / NEFT Ref (e.g. SBIN00049281)'
                    : 'e.g. Cash Voucher # or Memo (optional)'
                }
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Existing Proofs */}
            {recordingPayment.proofs && recordingPayment.proofs.length > 0 && (
              <PaymentProofViewer
                paymentId={recordingPayment._id}
                proofs={recordingPayment.proofs}
                allowDelete={true}
                onDeleteProof={handleDeleteExistingProof}
                title="Previously Uploaded Evidence"
              />
            )}

            {/* Payment Proof Uploader */}
            <PaymentProofUploader
              files={proofFiles}
              onFilesChange={setProofFiles}
              maxFiles={3}
              existingCount={recordingPayment.proofs?.length || 0}
              isUploading={isUpdating}
            />

            {/* Notes to Worker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes to Worker {paymentMethod === 'Other' && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={2}
                required={paymentMethod === 'Other'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Payment sent via Google Pay to 98234-XXXXX. Thank you for your punctual work!"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Mandatory Confirmation Checkbox when marking PAID */}
            {paymentStatus === 'PAID' && (
              <label className="flex items-start gap-2.5 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={confirmedDisbursed}
                  onChange={(e) => setConfirmedDisbursed(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-emerald-900 leading-snug">
                  I explicitly confirm that <strong>{formatINR(recordingPayment.amount)}</strong> has actually been disbursed to{' '}
                  <strong>{recordingPayment.worker?.name}</strong>. I understand that false payment records violate platform trust invariants.
                </span>
              </label>
            )}

            {/* Submit / Cancel Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setRecordingPayment(null);
                  setProofFiles([]);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" type="submit" isLoading={isUpdating}>
                Save Payment Record
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Inspect Proof Modal */}
      {inspectingPayment && (
        <Modal
          isOpen={Boolean(inspectingPayment)}
          onClose={() => setInspectingPayment(null)}
          title={`Payment Evidence: ${inspectingPayment.worker?.name}`}
          subtitle={`${typeof inspectingPayment.job === 'object' ? inspectingPayment.job?.title : 'Shift'} • ${formatINR(inspectingPayment.amount)}`}
        >
          <div className="space-y-4">
            <PaymentProofViewer
              paymentId={inspectingPayment._id}
              proofs={inspectingPayment.proofs || []}
              allowDelete={false}
              title="Verified Payment Screenshots & Vouchers"
            />
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectingPayment(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
