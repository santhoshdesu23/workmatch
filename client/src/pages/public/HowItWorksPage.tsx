import React from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  Sparkles,
  HeartHandshake,
  ShieldCheck,
  Building2,
  UserCheck,
  CheckCircle2,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Transparent Operations
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          How WorkMatch Works
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          A location-aware marketplace built on fairness, voluntary decisions, explainable AI, and transparent payment tracking.
        </p>
      </div>

      {/* For Workers Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">For Temporary Workers</h2>
            <p className="text-xs text-slate-500">How you discover shifts, apply voluntarily, and get paid</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-900">Discover Opportunities</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Explore one-day and short-duration assignments near your location. Filter by distance radius, hourly compensation rate, categories, and calendar days.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h3 className="text-sm font-bold text-slate-900">Explainable AI Recommendations</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              View clear compatibility scores showing how your skills, availability, and target compensation align with each shift. No hidden algorithm ranking.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h3 className="text-sm font-bold text-slate-900">Voluntary Application & Pay</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You choose when and where to apply. Confirm shift completion alongside the employer to record verified shift logs and payment release.
            </p>
          </Card>
        </div>
      </div>

      {/* For Employers Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">For Employers & Event Organizers</h2>
            <p className="text-xs text-slate-500">How you post shifts, review applicants, and confirm staff</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-900">Publish Clear Shift Details</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Set requirements, exact schedule, location, required openings, and guaranteed pay. Verified employer badges increase candidate trust.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h3 className="text-sm font-bold text-slate-900">Review Candidate Profiles</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Evaluate applicant profiles, verified ratings, and AI compatibility notes. Shortlist, send formal offers, or confirm hiring.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h3 className="text-sm font-bold text-slate-900">Manage Attendance & Completion</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Verify attendance upon shift conclusion. Record payments with audit tracking and submit reviews based on completed assignments.
            </p>
          </Card>
        </div>
      </div>

      {/* Non-Negotiable Marketplace Principles */}
      <Card className="p-8 bg-slate-900 text-white space-y-6">
        <div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Core Guarantees</span>
          <h2 className="text-2xl font-bold tracking-tight mt-1">Our Non-Negotiable Principles</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Workers always retain complete freedom to apply or decline any job.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Employers always make the final human hiring decision.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Notifications never automatically submit applications or book shifts.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Pay, hours, location, and requirements must be disclosed upfront.</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
