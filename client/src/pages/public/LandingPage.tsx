import React, { useState, useEffect } from 'react';
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
  UtensilsCrossed,
  Package,
  Store,
  PartyPopper,
  Truck,
  FileSpreadsheet,
  Building2,
  History,
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Coffee,
  Users,
  Briefcase
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { formatPayWithBasis, formatINR } from '../../utils/currency';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { Job } from '../../types';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Search Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workDate, setWorkDate] = useState('');

  // Live Featured Shifts State
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    api.get('/jobs?limit=4&sort=recent')
      .then((res) => {
        if (isMounted && res.data?.success) {
          setFeaturedJobs(res.data.jobs || []);
        }
      })
      .catch(() => {
        if (isMounted) setFeaturedJobs([]);
      })
      .finally(() => {
        if (isMounted) setJobsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    if (locationQuery.trim()) params.append('location', locationQuery.trim());
    if (selectedCategory) params.append('category', selectedCategory);
    if (workDate) params.append('workDate', workDate);
    navigate(`/jobs?${params.toString()}`);
  };

  const handleTagClick = (tag: string) => {
    navigate(`/jobs?search=${encodeURIComponent(tag)}`);
  };

  const categories = [
    { title: 'Event assistance', icon: PartyPopper, desc: 'Conferences, festivals, check-in ushers, and hosts', count: 'High demand' },
    { title: 'Wedding and catering support', icon: UtensilsCrossed, desc: 'Banquet servers, table bussers, and barbacks', count: 'Weekend shifts' },
    { title: 'Restaurant and hospitality', icon: Coffee, desc: 'Prep cooks, baristas, and counter associates', count: 'Flexible hours' },
    { title: 'Retail and store assistance', icon: Store, desc: 'Pop-up stores, floor support, and inventory replenishment', count: 'Daily shifts' },
    { title: 'Warehouse and packing', icon: Package, desc: 'E-commerce fulfillment, barcode scanning, and box packing', count: 'Fast checkout' },
    { title: 'Delivery and logistics', icon: Truck, desc: 'Local courier, parcel sorting, and loading assistance', count: 'Active roles' },
    { title: 'Data entry and office assistance', icon: FileSpreadsheet, desc: 'Registration rosters, digitizing files, and clerical tasks', count: 'Daytime shifts' }
  ];

  const popularTags = [
    'Banquet Server',
    'Event Usher',
    'Warehouse Packing',
    'Barista',
    'Prep Cook',
    'Counter Associate'
  ];

  return (
    <div className="space-y-20 pb-20">
      {/* ======================================================== */}
      {/* 1. HERO SECTION: Fintech-Grade Typography & Clear Copy */}
      {/* ======================================================== */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-emerald-50/20 to-slate-50/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* TrustTrack Announcement Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold mb-6 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Location-Aware Temporary Marketplace</span>
            <span className="text-emerald-300">|</span>
            <span className="text-emerald-700 font-bold">TrustTrack™ Certified</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.1] sm:leading-[1.1]">
            Find work. When you.{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
              Need it.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Connect directly with verified local businesses for one-day and short-duration assignments.
            Every important job detail is transparent, every change is traceable, and applications are 100% voluntary.
          </p>

          {/* Quick Action CTAs */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-3.5">
            {user ? (
              user.role === 'worker' ? (
                <>
                  <Link to="/jobs">
                    <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Explore Open Shifts
                    </Button>
                  </Link>
                  <Link to="/worker/hub">
                    <Button variant="outline" size="lg" leftIcon={<Sparkles className="w-4 h-4 text-emerald-600" />}>
                      Go to Worker Hub
                    </Button>
                  </Link>
                </>
              ) : user.role === 'employer' ? (
                <>
                  <Link to="/employer/jobs/create">
                    <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Post a New Shift
                    </Button>
                  </Link>
                  <Link to="/employer/dashboard">
                    <Button variant="outline" size="lg" leftIcon={<Building2 className="w-4 h-4" />}>
                      Employer Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/admin/dashboard">
                    <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Admin Dashboard
                    </Button>
                  </Link>
                  <Link to="/admin/reports">
                    <Button variant="outline" size="lg">
                      Review Reports
                    </Button>
                  </Link>
                </>
              )
            ) : (
              <>
                <Link to="/jobs">
                  <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Find Local Work
                  </Button>
                </Link>
                <Link to="/register?role=employer">
                  <Button variant="outline" size="lg" leftIcon={<Building2 className="w-4 h-4 text-slate-600" />}>
                    Hire Workers
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Core Trust Pillars Strip */}
          <div className="mt-10 pt-8 border-t border-slate-200/60 flex flex-wrap justify-center items-center gap-y-3 gap-x-8 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Upfront Guaranteed Pay
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Confirmed Shift Hours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero Agency Wage Skimming
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No Autonomous AI Hiring
            </span>
          </div>

          {/* ======================================================== */}
          {/* 2. SEARCH EXPERIENCE: Elevated, Accessible & Robust      */}
          {/* ======================================================== */}
          <div className="mt-12 max-w-5xl mx-auto">
            <form
              onSubmit={handleSearchSubmit}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-left"
              aria-label="Shift search filters"
            >
              {/* Role / Skill Input */}
              <div className="border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label htmlFor="search-input" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Role or Skill
                </label>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Usher, Server"
                    className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Location Input */}
              <div className="border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label htmlFor="location-input" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Location
                </label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="location-input"
                    type="text"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    placeholder="e.g. Atigre, Kolhapur, Shiroli"
                    className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label htmlFor="category-select" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="category-select"
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

              {/* Shift Date Input */}
              <div className="border-b sm:border-b-0 lg:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
                <label htmlFor="date-input" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Shift Date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="date-input"
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                <Button type="submit" className="w-full h-11" leftIcon={<Search className="w-4 h-4" />}>
                  Find Shifts
                </Button>
              </div>
            </form>

            {/* Popular Search Tags */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-400 mr-1">Popular searches:</span>
              {popularTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/30 transition-colors cursor-pointer text-[11px] font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. FEATURED LIVE SHIFTS: Real Persisted Data             */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Live Marketplace Opportunities
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Featured Open Shifts
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Confirmed listings with upfront compensation, verified schedules, and voluntary applications.
            </p>
          </div>

          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <span>Explore all shifts</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {jobsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <LoadingSkeleton rows={3} />
            <LoadingSkeleton rows={3} />
          </div>
        ) : featuredJobs.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center border-dashed border-slate-300">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Open Shifts Right Now</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Check back shortly or post a new shift opportunity as a verified local employer.
            </p>
            <Link to="/employer/jobs/create">
              <Button size="sm" variant="outline">
                Post an Opportunity
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {featuredJobs.map((job) => {
              const formattedDate = new Date(job.workDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              });
              const estimatedTotal = (Number(job.grossPay || 0) * Number(job.totalHours || 1)).toFixed(2);
              const spotsLeft = Math.max(0, (job.openings || 1) - (job.filledCount || 0));

              return (
                <Card
                  key={job._id}
                  hoverable
                  onClick={() => navigate(`/jobs/${job._id}`)}
                  className="p-5 sm:p-6 space-y-4 border-slate-200/90 hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Category + TrustTrack Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="emerald" size="sm">
                          {job.category}
                        </Badge>
                        {job.isDemo && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            DEMO
                          </span>
                        )}
                        {job.detailsConfirmed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Confirmed Listing
                          </span>
                        )}
                      </div>

                      {/* Pay Badge */}
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900">
                          {formatPayWithBasis(job.grossPay, job.payBasis)}
                        </span>
                      </div>
                    </div>

                    {/* Job Title */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">
                          {job.employerProfile?.businessName || job.employer?.name || 'Local Employer'}
                        </span>
                        {job.employerProfile?.verificationStatus === 'verified' && (
                          <span className="inline-flex items-center text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 font-semibold">
                            <BadgeCheck className="w-3 h-3 text-sky-600 mr-0.5" /> Verified Business
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{job.startTime} – {job.endTime} ({job.totalHours} hrs)</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {job.locality ? `${job.locality}, ${job.district || job.city || ''} (${job.locationName})` : job.locationName}
                        </span>
                        {job.distanceKm !== null && job.distanceKm !== undefined && (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] shrink-0">
                            ~{job.distanceKm} km
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Skills Tags */}
                    {job.requiredSkills && job.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {job.requiredSkills.slice(0, 3).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.requiredSkills.length > 3 && (
                          <span className="text-[11px] text-slate-400 px-1 py-0.5">
                            +{job.requiredSkills.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Spots & CTA */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      Est. Total: <strong className="text-slate-800">{formatINR(estimatedTotal)}</strong> • {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${job._id}`);
                      }}
                    >
                      View Shift
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* 4. TRUSTTRACK FEATURE SHOWCASE: Concrete Evidence Grid   */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 rounded-3xl p-8 sm:p-14 text-white shadow-xl space-y-10">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              WorkMatch TrustTrack™ System
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              A Marketplace Where Transparency Is Enforced by Code.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Every important job detail is transparent, every material change is traceable, and every reliability metric is backed by actual platform records.
            </p>
          </div>

          {/* 5 Core Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Pillar 1 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 backdrop-blur-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">1. Confirmed Commitments</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Employers must explicitly verify shift start/end hours, break policies, and guaranteed payment rates before publishing.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 backdrop-blur-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">2. Auditable Revision Ledger</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Material changes to pay, dates, or venues are permanently recorded in an immutable change history showing previous and new values.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 backdrop-blur-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">3. Applicant Protection & Alerts</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                If an employer updates shift terms, affected applicants receive instant notifications with rights to reconfirm or withdraw cleanly.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 backdrop-blur-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">4. Discrepancy Reporting</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Workers with an active relationship can report pay or schedule mismatches. Submissions undergo formal administrator review.
              </p>
            </div>

            {/* Pillar 5 */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 backdrop-blur-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">5. Evidence-Based Reliability</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Completion rates and reviews are calculated strictly from persisted shift checkout records, never from unverified ratings.
              </p>
            </div>

            {/* Governance Callout */}
            <div className="p-5 rounded-2xl bg-emerald-900/40 border border-emerald-500/30 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                  Governance Principle
                </span>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  No black-box scores. No unearned trust badges. No hidden agency cuts.
                </p>
              </div>
              <Link to="/safety">
                <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
                  Read Trust Standards
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. POPULAR SHIFT CATEGORIES: Compact & Consistent       */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Verified Opportunities
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Popular Shift Categories
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500">
            Browse short-duration roles matching your skill set and schedule.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link key={cat.title} to={`/jobs?category=${encodeURIComponent(cat.title)}`}>
                <Card hoverable className="h-full flex items-start gap-4 p-5 border-slate-200/90 hover:border-emerald-300">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{cat.title}</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{cat.desc}</p>
                    <span className="text-[11px] font-semibold text-emerald-600 inline-block pt-1">
                      {cat.count} &rarr;
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. HOW WORKMATCH WORKS: 4-Step Transparent Marketplace  */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-14 shadow-xs">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Transparent Execution
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              How WorkMatch Works
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500">
              A transparent, human-controlled marketplace protecting workers and reliable employers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900">1. Publish Clear Shift</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Employers specify open roles, verified venue address, required skills, work hours, and guaranteed compensation amount.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900">2. Explainable Matching</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our 5-factor scoring engine calculates location distance, skill fit, schedule compatibility, and pay preferences transparently.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900">3. Voluntary Decision</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Workers review transparent shift details and choose voluntarily whether to apply. Employers make final hiring decisions.
              </p>
            </div>

            {/* Step 4 */}
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                04
              </div>
              <h3 className="text-base font-bold text-slate-900">4. Completion & Records</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dual checkout logs verified shift completion. Payment records are tracked with status updates and eligible reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. ETHICAL AI SPECIFICATION: Informs, Never Dictates     */}
      {/* ======================================================== */}
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

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-md space-y-4">
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
              <p>“Matches your Guest Registration skills; shift is scheduled on your available Saturday; pay rate ($28/hr) exceeds your target rate.”</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 8. CLOSING CTA: High-Contrast Navy Section (Auth-Aware) */}
      {/* ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-14 text-white text-center space-y-6 shadow-xl">
          {user ? (
            user.role === 'worker' ? (
              <>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight break-words max-w-2xl mx-auto">
                  <span className="sm:hidden">
                    Welcome back, {user.firstName || user.name.split(' ')[0]}!
                  </span>
                  <span className="hidden sm:inline">
                    Welcome back, {user.name}!
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                  Explore new shifts matching your skills, manage your applications, and track your active shift schedules.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <Link to="/worker/hub">
                    <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                      Go to Worker Hub
                    </Button>
                  </Link>
                  <Link to="/jobs">
                    <Button variant="outline" size="lg" className="!bg-slate-800 !border-slate-700 !text-white hover:!bg-slate-700">
                      Explore Open Shifts
                    </Button>
                  </Link>
                </div>
              </>
            ) : user.role === 'employer' ? (
              <>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Ready to post your next shift?
                </h2>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                  Publish transparent job details with TrustTrack verification and connect with vetted local workers in minutes.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <Link to="/employer/jobs/create">
                    <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                      Post a New Shift
                    </Button>
                  </Link>
                  <Link to="/employer/dashboard">
                    <Button variant="outline" size="lg" className="!bg-slate-800 !border-slate-700 !text-white hover:!bg-slate-700">
                      Employer Dashboard
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  WorkMatch Platform Administration
                </h2>
                <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                  Manage marketplace trust, resolve worker discrepancy reports, and review immutable audit logs.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-2">
                  <Link to="/admin/dashboard">
                    <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                      Admin Dashboard
                    </Button>
                  </Link>
                  <Link to="/admin/reports">
                    <Button variant="outline" size="lg" className="!bg-slate-800 !border-slate-700 !text-white hover:!bg-slate-700">
                      Review Reports
                    </Button>
                  </Link>
                </div>
              </>
            )
          ) : (
            <>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
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
                  <Button variant="outline" size="lg" className="!bg-slate-800 !border-slate-700 !text-white hover:!bg-slate-700">
                    Explore Open Shifts
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
