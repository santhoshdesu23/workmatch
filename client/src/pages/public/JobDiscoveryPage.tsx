import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Sparkles,
  Map as MapIcon,
  List,
  Bookmark,
  Building2,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Job } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { JobMap } from '../../components/common/JobMap';

export const JobDiscoveryPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Location & Presets
  const LOCALITY_PRESETS = [
    { label: 'All Locations / Any Distance', locality: '', coords: null },
    { label: 'Atigre (Center)', locality: 'Atigre', coords: [16.7410, 74.3720] as [number, number] },
    { label: 'Hatkanangale', locality: 'Hatkanangale', coords: [16.7445, 74.4442] as [number, number] },
    { label: 'Shiroli MIDC', locality: 'Shiroli MIDC', coords: [16.7482, 74.3015] as [number, number] },
    { label: 'Ichalkaranji', locality: 'Ichalkaranji', coords: [16.6960, 74.4620] as [number, number] },
    { label: 'Jaysingpur', locality: 'Jaysingpur', coords: [16.7820, 74.5580] as [number, number] },
    { label: 'Kolhapur City', locality: 'Kolhapur', coords: [16.7050, 74.2430] as [number, number] }
  ];

  // Filter States
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [category, setCategory] = useState<string>(searchParams.get('category') || '');
  const [minPay, setMinPay] = useState<string>(searchParams.get('minPay') || '');
  const [workDate, setWorkDate] = useState<string>(searchParams.get('workDate') || '');
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>(searchParams.get('maxDistanceKm') || '');
  const [sort, setSort] = useState<string>(searchParams.get('sort') || 'recent');
  const [selectedLocality, setSelectedLocality] = useState<string>(searchParams.get('locality') || '');
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [nlQuery, setNlQuery] = useState<string>('');
  const [isNlSearching, setIsNlSearching] = useState<boolean>(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (minPay) params.append('minPay', minPay);
      if (workDate) params.append('workDate', workDate);
      if (maxDistanceKm) params.append('maxDistanceKm', maxDistanceKm);
      if (sort) params.append('sort', sort);
      if (selectedLocality) params.append('locality', selectedLocality);
      if (userCoords) {
        params.append('lat', String(userCoords[0]));
        params.append('lng', String(userCoords[1]));
      }

      const res = await api.get(`/jobs?${params.toString()}`);
      if (res.data?.success) {
        setJobs(res.data.jobs || []);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [category, minPay, workDate, maxDistanceKm, sort, selectedLocality, userCoords]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleNlSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;

    setIsNlSearching(true);
    try {
      const res = await api.post('/recommendations/nl-search', { query: nlQuery });
      if (res.data?.success && res.data?.parsed) {
        const parsed = res.data.parsed;
        if (parsed.keyword) setSearch(parsed.keyword);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.minPay) setMinPay(String(parsed.minPay));
        if (parsed.maxDistanceKm) setMaxDistanceKm(String(parsed.maxDistanceKm));
        if (parsed.locality) {
          setSelectedLocality(parsed.locality);
          const found = LOCALITY_PRESETS.find(p => p.locality.toLowerCase() === parsed.locality.toLowerCase());
          if (found?.coords) setUserCoords(found.coords);
        }
        info(`Natural language query parsed via ${parsed.source || 'AI engine'}!`);
      }
    } catch (err: any) {
      // Fallback search
      setSearch(nlQuery);
    } finally {
      setIsNlSearching(false);
      fetchJobs();
    }
  };

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      toastError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserCoords([pos.coords.latitude, pos.coords.longitude]);
        setSelectedLocality('');
        info(`Location detected: ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
      },
      (err) => {
        setIsLocating(false);
        toastError(`Location permission denied or unavailable: ${err.message}`);
      }
    );
  };

  const handleToggleSave = async (jobId: string) => {
    if (!user || user.role !== 'worker') {
      info('Please log in as a worker to bookmark jobs.');
      return;
    }

    try {
      const res = await api.post(`/jobs/${jobId}/save`);
      if (res.data?.success) {
        success(res.data.message);
        setJobs((prev) =>
          prev.map((j) => (j._id === jobId ? { ...j, isSaved: res.data.isSaved } : j))
        );
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const categories = [
    'Event assistance',
    'Wedding and catering support',
    'Restaurant and hospitality',
    'Retail and store assistance',
    'Warehouse and packing',
    'Delivery and logistics',
    'Data entry and office assistance',
    'Cleaning and maintenance',
    'Tutoring and event staffing'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Discover Open Shifts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse legitimate temporary assignments near your location with verified pay and work hours.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${viewMode === 'list'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${viewMode === 'map'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map View
            </button>
          </div>
        </div>
      </div>

      {/* Natural Language AI Conversational Search Box */}
      <Card className="p-4 bg-gradient-to-r from-emerald-50/60 via-white to-slate-50 border-emerald-200/80">
        <form onSubmit={handleNlSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 w-full">
            <input
              type="text"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              placeholder="Ask naturally: e.g., 'Packing or warehouse jobs this weekend over $24/hr near Brooklyn'"
              className="w-full text-xs sm:text-sm bg-transparent placeholder-slate-400 focus:outline-none text-slate-900 font-medium"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            isLoading={isNlSearching}
            className="w-full sm:w-auto shrink-0"
          >
            Ask AI Search
          </Button>
        </form>
      </Card>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" /> Filters
              </span>
              {(search || category || minPay || workDate || maxDistanceKm || selectedLocality || userCoords) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setCategory('');
                    setMinPay('');
                    setWorkDate('');
                    setMaxDistanceKm('');
                    setSelectedLocality('');
                    setUserCoords(null);
                  }}
                  className="text-[11px] text-emerald-600 font-semibold hover:underline cursor-pointer"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Location Selector (Atigre, Kolhapur, etc.) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">Location / Area</label>
                <button
                  type="button"
                  onClick={handleUseDeviceLocation}
                  disabled={isLocating}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
                  title="Detect coordinates from browser GPS"
                >
                  <MapPin className="w-3 h-3" />
                  {isLocating ? 'Locating...' : 'My GPS'}
                </button>
              </div>
              <select
                value={selectedLocality}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLocality(val);
                  const preset = LOCALITY_PRESETS.find((p) => p.locality === val);
                  setUserCoords(preset?.coords || null);
                }}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none bg-white cursor-pointer"
              >
                {LOCALITY_PRESETS.map((p) => (
                  <option key={p.label} value={p.locality}>
                    {p.label}
                  </option>
                ))}
              </select>
              {userCoords && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Active point: {userCoords[0].toFixed(3)}, {userCoords[1].toFixed(3)}
                </p>
              )}
            </div>

            {/* Keyword Search */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Keyword</label>
              <form onSubmit={handleManualSearch} className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title or skill..."
                  className="w-full text-xs px-3 py-2 pr-8 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button type="submit" className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  <Search className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Job Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none bg-white cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Pay */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Minimum Rate ($/hr)</label>
              <input
                type="number"
                min="0"
                value={minPay}
                onChange={(e) => setMinPay(e.target.value)}
                placeholder="e.g. 20"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            {/* Shift Date */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Shift Date</label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
              />
            </div>

            {/* Max Distance */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Search Radius</label>
              <select
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none bg-white cursor-pointer"
              >
                <option value="">Any Distance</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="15">Within 15 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
              </select>
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Sort Order</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none bg-white cursor-pointer"
              >
                <option value="recent">Recently Posted</option>
                <option value="best_match">AI Best Match</option>
                <option value="highest_pay">Highest Pay</option>
                <option value="soonest">Soonest Shift Date</option>
                <option value="nearest">Nearest to You</option>
              </select>
            </div>
          </Card>
        </aside>

        {/* Results List / Map */}
        <section className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Showing {jobs.length} open temporary position{jobs.length === 1 ? '' : 's'}</span>
            <span className="font-medium text-slate-700">Verified Openings Only</span>
          </div>

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No temporary jobs matching your current filters"
              description="No open shifts found for the selected area and radius. Try expanding your search radius to 25 km or 50 km, or selecting another locality."
              actionText="Expand Radius (50 km)"
              onAction={() => {
                setMaxDistanceKm('50');
              }}
            />
          ) : viewMode === 'map' ? (
            <div className="space-y-4">
              <JobMap jobs={jobs} userLocation={userCoords || undefined} className="h-[500px]" />
              <p className="text-xs text-slate-400 text-center">
                Click on any map pin to view shift details, hourly/shift rate, and exact venue locality.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {jobs.map((job) => (
                <Card key={job._id} hoverable className="p-5 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="emerald" size="sm">
                          {job.category}
                        </Badge>
                        {job.isDemo && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            DEMO
                          </span>
                        )}
                        {job.employerProfile?.verificationStatus === 'verified' && (
                          <Badge variant="blue" size="sm">
                            <ShieldCheck className="w-3 h-3 text-sky-600" />
                            Verified Employer
                          </Badge>
                        )}
                        {job.matchData && (
                          <Badge
                            variant={job.matchData.matchScore >= 80 ? 'emerald' : 'amber'}
                            size="sm"
                          >
                            <Sparkles className="w-3 h-3" />
                            {job.matchData.matchScore}% Match
                          </Badge>
                        )}
                      </div>

                      <Link to={`/jobs/${job._id}`}>
                        <h3 className="text-base font-bold text-slate-900 hover:text-emerald-600 transition-colors">
                          {job.title}
                        </h3>
                      </Link>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {job.employerProfile?.businessName || job.employer?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{job.locality ? `${job.locality}, ${job.district || job.city || ''}` : job.locationName}</span>
                          {job.distanceKm !== null && job.distanceKm !== undefined && (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ~{job.distanceKm} km away
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(job.workDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{job.startTime} – {job.endTime} ({job.totalHours} hrs)</span>
                        </div>
                      </div>

                      {/* Required skills tags */}
                      {job.requiredSkills && job.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {job.requiredSkills.map((sk) => (
                            <span key={sk} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pay & Actions Right Block */}
                    <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div>
                        <div className="text-lg font-extrabold text-slate-900">
                          {job.currency === 'INR' ? '₹' : '$'}{job.grossPay}
                          <span className="text-xs font-normal text-slate-500"> / {job.payBasis}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {job.openings - job.filledCount} of {job.openings} opening{job.openings === 1 ? '' : 's'} left
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {user?.role === 'worker' && (
                          <button
                            onClick={() => handleToggleSave(job._id)}
                            className={`p-2 rounded-xl border transition-colors cursor-pointer ${job.isSaved
                                ? 'bg-amber-50 border-amber-200 text-amber-600'
                                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                              }`}
                            aria-label="Bookmark Job"
                          >
                            <Bookmark className={`w-4 h-4 ${job.isSaved ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}

                        <Link to={`/jobs/${job._id}`}>
                          <Button size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                            View Shift
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
