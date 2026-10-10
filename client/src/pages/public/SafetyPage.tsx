import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  CreditCard,
  Lock,
  Flag,
  UserCheck,
  HelpCircle
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Link } from 'react-router-dom';

export const SafetyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Trust, Safety & Governance
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Trust & Safety at WorkMatch
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          We protect our marketplace participants with rigorous verification standards, transparent records, scam prevention, and rapid human dispute moderation.
        </p>
      </div>

      {/* Safety Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Verified Profiles</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            We never fabricate verification badges. Profiles are marked verified only when actual identity or legitimate business incorporation documents have been reviewed and approved.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Payment Transparency</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            All pay amounts, payment timing, and methods must be declared before applications are accepted. Shift completion requires dual confirmation logs.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Flag className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Immediate Incident Reporting</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Workers and employers can report suspicious listings, fee demands, harassment, or unpaid wages at any time directly into our administrative moderation queue.
          </p>
        </Card>
      </div>

      {/* Prohibited Job Policy */}
      <Card className="p-8 border-rose-100 bg-rose-50/30 space-y-4">
        <div className="flex items-center gap-2.5 text-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <h2 className="text-base font-bold">Strictly Prohibited Listings & Activities</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          WorkMatch prohibits any listing or arrangement involving:
        </p>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
          <li>Upfront application fees, training fees, or required equipment purchase schemes.</li>
          <li>Misleading wage descriptions, multi-level marketing (MLM), or commission-only work masquerading as guaranteed temporary pay.</li>
          <li>Unlawful discrimination based on race, gender, religion, national origin, or disability.</li>
          <li>Hazardous, unlicensed, or unlawful physical environments without verified safety protocols.</li>
        </ul>
      </Card>

      {/* How to Report */}
      <Card className="p-8 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">How to Report an Incident or Account</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Every job page features a "Report this listing" button. In your dashboard, you can also report any employer or worker who violates terms. Reports are reviewed by human administrators with recorded action audits.
        </p>
        <div className="pt-2">
          <Link to="/jobs">
            <Button size="sm">Explore Verified Shifts</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
