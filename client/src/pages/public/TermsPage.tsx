import React from 'react';
import { Card } from '../../components/common/Card';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
        <p className="text-xs text-slate-500 mt-1">Last updated: October 2026</p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">1. Voluntary Application & Hiring Freedom</h2>
          <p>
            WorkMatch is a marketplace connecting independent temporary workers with employers. Workers always retain full voluntary discretion to apply or decline listings. Employers make all final candidate selection and hiring decisions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">2. Transparent Job Terms & Payment</h2>
          <p>
            Employers agree to accurately disclose hourly compensation rates, schedule start and end times, meal break allowances, dress codes, and work locations prior to receiving applications.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">3. Cancellation Guidelines</h2>
          <p>
            Both employers and workers must abide by stated cancellation terms. Unwarranted cancellations or unnotified no-shows result in account review and potential suspension.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">4. Genuine Reviews & Completion Integrity</h2>
          <p>
            Reviews and ratings may only be submitted following an eligible completed shift. Fabricating ratings or submitting deceptive reviews is strictly prohibited.
          </p>
        </section>
      </Card>
    </div>
  );
};
