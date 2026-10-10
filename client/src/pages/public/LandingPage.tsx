import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  DollarSign,
  UtensilsCrossed,
  Package,
  Store,
  PartyPopper,
  Truck,
  FileSpreadsheet,
  Building2,
  Lock,
  ThumbsUp
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workDate, setWorkDate] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory) params.append('category', selectedCategory);
    if (workDate) params.append('workDate', workDate);
    navigate(`/jobs?${params.toString()}`);
  };

  const categories = [
    { title: 'Event assistance', icon: PartyPopper, desc: 'Conferences, festivals, check-in ushers, and hosts' },
    { title: 'Wedding and catering support', icon: UtensilsCrossed, desc: 'Banquet servers, table bussers, and barbacks' },
    { title: 'Restaurant and hospitality', icon: UtensilsCrossed, desc: 'Prep cooks, baristas, and counter associates' },
    { title: 'Retail and store assistance', icon: Store, desc: 'Pop-up stores, floor support, and inventory replenishment' },
    { title: 'Warehouse and packing', icon: Package, desc: 'E-commerce fulfillment, barcode scanning, and box packing' },
    { title: 'Delivery and logistics', icon: Truck, desc: 'Local courier, parcel sorting, and loading assistance' },
    { title: 'Data entry and office assistance', icon: FileSpreadsheet, desc: 'Registration rosters, digitizing files, and clerical tasks' }
  ];

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden border-b border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>AI-Powered Location-Based Temporary Employment</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-tight sm:leading-tight">
            Find Work When You Need It.
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Local opportunities. Flexible shifts. Trusted connections. Connect directly with vetted businesses for one-day and short-duration assignments with full pay transparency.
          </p>

          {/* Quick CTA Buttons */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
            <Link to="/jobs">
              <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Find Work Now
              </Button>
            </Link>
            <Link to="/register?role=employer">
              <Button variant="outline" size="lg" leftIcon={<Building2 className="w-4 h-4" />}>
                Hire Workers
              </Button>
            </Link>
          </div>

          {/* Search Card */}
          <div className="mt-12 max-w-4xl mx-auto">
            <form
              onSubmit={handleSearchSubmit}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/40 grid grid-cols-1 sm:grid-cols-4 gap-3 text-left"
            >
              <div className="sm:col-span-1 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role or Skill</label>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Usher, Packing"
                    className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-1 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full text-sm font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.title} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-1 border-b sm:border-b-0 border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Shift Date</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="sm:col-span-1 flex items-end">
                <Button type="submit" className="w-full h-11" leftIcon={<Search className="w-4 h-4" />}>
                  Search Shifts
                </Button>
              </div>
            </form>
          </div>

          {/* Trust Guarantees Bar */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-6 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Transparent Upfront Pay
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Voluntary Worker Applications
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Real Verified Completion Records
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero Dark Patterns
            </span>
          </div>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Popular Shift Categories</h2>
          <p className="mt-2 text-sm text-slate-600">Discover lawful, short-duration roles matching your skill set and schedule.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link key={cat.title} to={`/jobs?category=${encodeURIComponent(cat.title)}`}>
                <Card hoverable className="h-full flex items-start gap-4 p-5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 mb-1">{cat.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{cat.desc}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How WorkMatch Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-14 shadow-xs">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Simple & Transparent</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">How WorkMatch Works</h2>
            <p className="mt-2 text-sm text-slate-600">A human-controlled marketplace that protects workers and reliable employers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                01
              </div>
              <h3 className="text-base font-semibold text-slate-900">1. Publish Clear Shift</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Employers specify open roles, verified address, required skills, work hours, and guaranteed compensation amount.
              </p>
            </div>

            <div className="text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                02
              </div>
              <h3 className="text-base font-semibold text-slate-900">2. Explainable Matching</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our 5-factor scoring engine calculates location distance, skill fit, schedule compatibility, and pay preferences.
              </p>
            </div>

            <div className="text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm">
                03
              </div>
              <h3 className="text-base font-semibold text-slate-900">3. Voluntary Decision</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Workers review transparent shift details and choose voluntarily whether to apply. Employers make the final hiring choice.
              </p>
            </div>

            <div className="text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                04
              </div>
              <h3 className="text-base font-semibold text-slate-900">4. Completion & Pay</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dual confirmation logs verified shift completion. Payment records are tracked with status updates and eligible reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Transparency & Ethical Guarantees */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Ethical AI Architecture</span>
            </div>

            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              Explainable AI That Informs, Never Dictates.
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              Unlike black-box algorithms, WorkMatch provides transparent 0–100 compatibility scores with detailed component breakdowns. You will always know why a job was recommended.
            </p>

            <ul className="space-y-3 text-xs text-slate-700">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>No Autonomous Hiring:</strong> The AI never automatically accepts jobs or rejects candidates without human review.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>No Protected Characteristic Profiling:</strong> We do not infer or use gender, religion, caste, or disability in matching.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Deterministic Local Fallback:</strong> Core recommendations operate continuously even without external cloud AI availability.</span>
              </li>
            </ul>

            <div className="pt-2">
              <Link to="/about">
                <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Read Our AI Ethics Specification
                </Button>
              </Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">Sample Explainability Output</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                92% Fit
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-medium text-slate-600">
                <span>Skills Compatibility (30%)</span>
                <span className="font-bold text-slate-900">100% (2 of 2 matched)</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-full" />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-medium text-slate-600">
                <span>Distance within Radius (25%)</span>
                <span className="font-bold text-slate-900">95% (~6.7 km away)</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[95%]" />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Human-Readable Explanation:</p>
              <p>“Matches your Guest Registration skills; shift is scheduled on your available Saturday; pay rate ($26/hr) exceeds your target rate.”</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-14 text-white text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Ready to find flexible local work?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Join vetted workers and employers on WorkMatch today. No hidden agency cuts. No fabricated metrics. Real local opportunities.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link to="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                Create Free Account
              </Button>
            </Link>
            <Link to="/jobs">
              <Button variant="outline" size="lg" className="border-slate-700 text-white hover:bg-slate-800">
                Explore Open Shifts
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
