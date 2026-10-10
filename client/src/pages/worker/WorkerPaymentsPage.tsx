import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  ShieldCheck
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PaymentRecord } from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const WorkerPaymentsPage: React.FC = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0, countPaid: 0, countPending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const res = await api.get('/payments/me');
        if (res.data?.success) {
          setPayments(res.data.payments || []);
          if (res.data.summary) setSummary(res.data.summary);
        }
      } catch (err: any) {
        console.warn('Payments fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'emerald';
      case 'PROCESSING':
      case 'DUE':
        return 'amber';
      case 'DISPUTED':
        return 'rose';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Transparency & History</h1>
        <p className="text-xs text-slate-500">
          Track recorded compensation, disbursed payments, and authorized audit confirmations.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-gradient-to-br from-emerald-50 to-white border-emerald-200 space-y-1">
          <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Total Disbursed / Paid
          </div>
          <div className="text-3xl font-black text-slate-900">${summary.totalPaid.toFixed(2)}</div>
          <p className="text-[11px] text-slate-500">{summary.countPaid} completed payment records</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-50 to-white border-amber-200 space-y-1">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" /> Pending / Processing
          </div>
          <div className="text-3xl font-black text-slate-900">${summary.totalPending.toFixed(2)}</div>
          <p className="text-[11px] text-slate-500">{summary.countPending} shifts awaiting disbursement</p>
        </Card>
      </div>

      {/* Disclaimer on Payment Transparency */}
      <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
        <span>
          WorkMatch clearly distinguishes between employer-recorded confirmations, worker verification, and gateway transfers without fabricating confirmation badges.
        </span>
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No payment records yet"
          description="Payment records are initiated automatically once an employer confirms your shift hire."
        />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const jobTitle = typeof p.job === 'object' ? p.job?.title : 'Temporary Shift';
            return (
              <Card key={p._id} className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(p.status)} size="md">
                        {p.status}
                      </Badge>
                      <span className="text-[11px] text-slate-400">
                        Method: {p.paymentMethod}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{jobTitle}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Employer: {p.employer?.name}</span>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <div className="text-xl font-black text-slate-900">
                      ${p.amount.toFixed(2)}
                    </div>
                    <span className="text-xs text-slate-400">Rate basis: {p.basis}</span>
                  </div>
                </div>

                {p.providerReference && (
                  <div className="p-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-600 font-mono">
                    Ref ID: {p.providerReference}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
