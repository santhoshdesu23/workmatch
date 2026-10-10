import React from 'react';
import { Card } from '../../components/common/Card';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-slate-500 mt-1">Last updated: October 2026</p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">1. Information We Collect</h2>
          <p>
            We collect personal information necessary to deliver marketplace functionality, including: name, email, role, declared skills, preferred categories, travel radius, and approximate location coordinates explicitly provided by the user.
          </p>
          <p>
            We do not infer or record sensitive personal attributes such as caste, religion, political beliefs, or health conditions for matching purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">2. How Location Coordinates Are Handled</h2>
          <p>
            Location information is strictly used to evaluate geographic distance between workers and open shift sites. We never broadcast precise private home coordinates to other users without authorization.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">3. AI Service Boundary & Data Minimization</h2>
          <p>
            When utilizing AI language features, we never transmit passwords, contact phone numbers, banking details, or government identification to external model providers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">4. Your Data Rights</h2>
          <p>
            Users may view, edit, or delete their profile information at any time via the account settings panel.
          </p>
        </section>
      </Card>
    </div>
  );
};
