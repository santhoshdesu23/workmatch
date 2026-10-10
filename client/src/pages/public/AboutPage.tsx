import React from 'react';
import { Sparkles, Users, Target, ShieldCheck, Heart } from 'lucide-react';
import { Card } from '../../components/common/Card';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center space-y-4">
        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Our Mission & Architecture
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          About WorkMatch
        </h1>
        <p className="text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Built to solve the informal, fragmented temporary employment problem with location-aware technology, explainable AI, and transparent human-centric trust.
        </p>
      </div>

      <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
        <Card className="p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">The Problem We Solve</h2>
          <p>
            Students, part-time workers, and freelancers frequently struggle to find legitimate short-duration jobs near their homes. Opportunities are scattered across WhatsApp groups, informal chats, and unverified social media boards where payment is uncertain and work conditions are ambiguous.
          </p>
          <p>
            Employers—event organizers, catering companies, retailers, banquet halls, and warehouses—struggle to quickly find dependable local staff on short notice without paying exorbitant staffing agency markups.
          </p>
        </Card>

        <Card className="p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">The Explainable AI Difference</h2>
          <p>
            Rather than relying on opaque matching algorithms, WorkMatch employs a deterministic, transparent 5-factor scoring model that explicitly evaluates:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 pl-2">
            <li><strong>Skills compatibility (30% weight)</strong>: Matched prerequisite skills vs declared competencies.</li>
            <li><strong>Geographic proximity (25% weight)</strong>: Exact Haversine distance relative to worker travel preferences.</li>
            <li><strong>Schedule compatibility (20% weight)</strong>: Matching shift times against worker availability.</li>
            <li><strong>Pay alignment (15% weight)</strong>: Offered hourly rate relative to worker rate expectations.</li>
            <li><strong>Category & Experience (10% weight)</strong>: Role category preference alignment.</li>
          </ul>
        </Card>

        <Card className="p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Human Governance at the Core</h2>
          <p>
            AI recommendations assist people in discovering opportunities; they do not make autonomous decisions. Workers always decide voluntarily whether to apply, and employers always retain final hiring authority.
          </p>
        </Card>
      </div>
    </div>
  );
};
