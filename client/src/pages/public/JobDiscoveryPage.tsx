import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Map as MapIcon,
  List,
  Bookmark,
  Building2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Job, MixedMatchResults, MixedMatchCounts } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { JobMap } from '../../components/common/JobMap';
import { formatPayWithBasis } from '../../utils/currency';
import { buildJobSearchParams } from '../../utils/jobSearchParams.js';
import {
  resolveNlFilters,
  resolveNlFallbackFilters,
  JobFilterState
} from '../../utils/nlSearchUtils.js';

// Feature flag: set to true to restore the natural language AI conversational search banner
const SHOW_AI_SEARCH_BANNER = true;

export const JobDiscoveryPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [mixedResults, setMixedResults] = useState<MixedMatchResults | null>(null);
  const [matchCounts, setMatchCounts] = useState<MixedMatchCounts>({
    exact: 0,
    strong: 0,
    partial: 0,
    total: 0
  });
  const [showCloseMatches, setShowCloseMatches] = useState<boolean>(true);
  const [openSections, setOpenSections] = useState<{
    exact: boolean;
    strong: boolean;
    partial: boolean;
  }>({ exact: true, strong: true, partial: true });

  const [loading, setLoading] = useState<boolean>(true);
  const [searchError, setSearchError] = useState<string>('');
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

  const initialLocation = searchParams.get('location') || '';
  const initialLocality = searchParams.get('locality') || '';
  const initialPreset = LOCALITY_PRESETS.find(
    (preset) => preset.locality.toLowerCase() === (initialLocality || initialLocation).toLowerCase()
  );

  // Filter States
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [category, setCategory] = useState<string>(searchParams.get('category') || '');
  const [minPay, setMinPay] = useState<string>(searchParams.get('minPay') || '');
  const [workDate, setWorkDate] = useState<string>(searchParams.get('workDate') || '');
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>(searchParams.get('maxDistanceKm') || '');
  const [sort, setSort] = useState<string>(searchParams.get('sort') || 'recent');
  const [selectedLocality, setSelectedLocality] = useState<string>(initialPreset?.locality || initialLocality);
  const [locationQuery, setLocationQuery] = useState<string>(initialLocation && !initialPreset ? initialLocation : '');
  const [userCoords, setUserCoords] = useState<[number, number] | null>(initialPreset?.coords || null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [nlQuery, setNlQuery] = useState<string>('');
  const [isNlSearching, setIsNlSearching] = useState<boolean>(false);

  const lastFetchedParamsRef = React.useRef<string>('');

  const fetchJobs = async (filterOverrides?: Partial<JobFilterState>) => {
    setLoading(true);
    setSearchError('');
    try {
      const activeFilters: JobFilterState = {
        search: filterOverrides?.search !== undefined ? filterOverrides.search : search,
        category: filterOverrides?.category !== undefined ? filterOverrides.category : category,
        minPay: filterOverrides?.minPay !== undefined ? filterOverrides.minPay : minPay,
        workDate: filterOverrides?.workDate !== undefined ? filterOverrides.workDate : workDate,
        maxDistanceKm: filterOverrides?.maxDistanceKm !== undefined ? filterOverrides.maxDistanceKm : maxDistanceKm,
        sort: filterOverrides?.sort !== undefined ? filterOverrides.sort : sort,
        location: filterOverrides?.location !== undefined ? filterOverrides.location : locationQuery,
        locality: filterOverrides?.locality !== undefined ? filterOverrides.locality : selectedLocality,
        coordinates: filterOverrides?.coordinates !== undefined ? filterOverrides.coordinates : userCoords
      };

      const params = buildJobSearchParams({
        ...activeFilters,
        showCloseMatches: showCloseMatches ? 'true' : 'false'
      } as any);
      lastFetchedParamsRef.current = params.toString();

      const res = await api.get(`/jobs?${params.toString()}`);
      if (res.data?.success) {
        setJobs(res.data.jobs || []);
        if (res.data.results) {
          setMixedResults(res.data.results);
        }
        if (res.data.counts) {
          setMatchCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      setJobs([]);
      setMixedResults(null);
      setSearchError(err.message || 'Failed to load jobs. Please try again.');
      toastError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentParams = buildJobSearchParams({
      search,
      category,
      minPay,
      workDate,
      maxDistanceKm,
      sort,
      location: locationQuery,
      locality: selectedLocality,
      coordinates: userCoords,
      showCloseMatches: showCloseMatches ? 'true' : 'false'
    } as any).toString();

    // Prevent duplicate API requests if already fetched (e.g. by handleNlSearch)
    if (currentParams === lastFetchedParamsRef.current) {
      return;
    }

    fetchJobs();
  }, [category, minPay, workDate, maxDistanceKm, sort, selectedLocality, userCoords, showCloseMatches]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleNlSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = nlQuery.trim();
    if (!query) return;

    setIsNlSearching(true);
    let targetFilters: JobFilterState;

    try {
      const res = await api.post('/recommendations/nl-search', { query });
      if (res.data?.success && res.data?.parsed) {
        const parsed = res.data.parsed;
        targetFilters = resolveNlFilters(
          {
            search,
            category,
            minPay,
            workDate,
            maxDistanceKm,
            sort,
            location: locationQuery,
            locality: selectedLocality,
            coordinates: userCoords
          },
          parsed,
          LOCALITY_PRESETS
        );
        info(`Natural language query parsed via ${parsed.source || 'AI engine'}!`);
      } else {
        targetFilters = resolveNlFallbackFilters(
          {
            search,
            category,
            minPay,
            workDate,
            maxDistanceKm,
            sort,
            location: locationQuery,
            locality: selectedLocality,
            coordinates: userCoords
          },
          query
        );
      }
    } catch {
      targetFilters = resolveNlFallbackFilters(
        {
          search,
          category,
          minPay,
          workDate,
          maxDistanceKm,
          sort,
          location: locationQuery,
          locality: selectedLocality,
          coordinates: userCoords
        },
        query
      );
    } finally {
      setIsNlSearching(false);
    }

    // Apply resolved filters to state
    if (targetFilters.search !== undefined) setSearch(targetFilters.search);
    if (targetFilters.category !== undefined) setCategory(targetFilters.category);
    if (targetFilters.minPay !== undefined) setMinPay(targetFilters.minPay);
    if (targetFilters.maxDistanceKm !== undefined) setMaxDistanceKm(targetFilters.maxDistanceKm);
    if (targetFilters.locality !== undefined) setSelectedLocality(targetFilters.locality);
    if (targetFilters.location !== undefined) setLocationQuery(targetFilters.location);
    if (targetFilters.coordinates !== undefined) setUserCoords(targetFilters.coordinates);

    await fetchJobs(targetFilters);
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
        setLocationQuery('');
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
        if (mixedResults) {
          const updateGroup = (list: Job[]) =>
            list.map((j) => (j._id === jobId ? { ...j, isSaved: res.data.isSaved } : j));
          setMixedResults({
            exact: updateGroup(mixedResults.exact),
            strong: updateGroup(mixedResults.strong),
            partial: updateGroup(mixedResults.partial)
          });
        }
      }
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const toggleSection = (section: 'exact' | 'strong' | 'partial') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
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

  const renderJobCard = (job: Job) => (
    <Card key={job._id} hoverable className="p-5 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="emerald" size="sm">
              {job.category}
            </Badge>

            {/* Smart Matching Tier Badges */}
            {job.matchType === 'exact' && (
              <Badge variant="emerald" size="sm">
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                Exact Match
              </Badge>
            )}
            {job.matchType === 'strong' && (
              <Badge variant="blue" size="sm">
                <Sparkles className="w-3 h-3 inline mr-1" />
                Strong Match
              </Badge>
            )}
            {job.matchType === 'partial' && (
              <Badge variant="amber" size="sm">
                Partial Match
              </Badge>
            )}

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
                <Sparkles className="w-3 h-3 inline mr-1" />
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
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span
                className="font-medium text-slate-700 truncate max-w-[180px] sm:max-w-xs"
                title={job.employerProfile?.businessName || job.employer?.name}
              >
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

          {/* Preference differences disclosure for strong and partial matches */}
          {job.preferenceDifferences && job.preferenceDifferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {job.preferenceDifferences.map((diff, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 inline-flex items-center gap-1 font-medium"
                >
                  <span className="text-amber-500 font-bold">•</span>
                  {diff}
                </span>
              ))}
            </div>
          )}

          {/* Required skills tags */}
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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
              {formatPayWithBasis(job.grossPay, job.payBasis)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {job.openings - job.filledCount} of {job.openings} opening{job.openings === 1 ? '' : 's'} left
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === 'worker' && (
              <button
                onClick={() => handleToggleSave(job._id)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  job.isSaved
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
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Discover Open Shifts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mixed Smart Matching Engine: Browse exact matches, strong opportunities, and transparent partial matches.
          </p>
        </div>

        {/* Controls: Show close matches toggle & View Toggle */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={showCloseMatches}
              onChange={(e) => setShowCloseMatches(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
            />
            <span>Show close matches</span>
          </label>

          <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'map'
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
      {SHOW_AI_SEARCH_BANNER && (
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
                placeholder="Ask naturally: e.g., 'Find evening data entry jobs in Vijayawada within 10 km, paying ₹500 to ₹800 per day this weekend'"
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
      )}

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
                    setLocationQuery('');
                    setUserCoords(null);
                  }}
                  className="text-[11px] text-emerald-600 font-semibold hover:underline cursor-pointer"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Location Selector */}
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
                  setLocationQuery('');
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
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const normalizedLocation = locationQuery.trim().toLowerCase();
                  const matchingPreset = LOCALITY_PRESETS.find(
                    (preset) => preset.locality.toLowerCase() === normalizedLocation
                  );
                  if (matchingPreset) {
                    setSelectedLocality(matchingPreset.locality);
                    setUserCoords(matchingPreset.coords);
                  } else {
                    fetchJobs();
                  }
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(event) => {
                    setLocationQuery(event.target.value);
                    setSelectedLocality('');
                    setUserCoords(null);
                  }}
                  placeholder="Or enter a locality, city, or district"
                  aria-label="Search locality, city, or district"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Button type="submit" size="sm">Search</Button>
              </form>
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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Minimum Rate (₹)</label>
              <input
                type="number"
                min="0"
                value={minPay}
                onChange={(e) => setMinPay(e.target.value)}
                placeholder="e.g. 300"
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
            <span>
              Showing {jobs.length} open position{jobs.length === 1 ? '' : 's'}
              {mixedResults && (
                <span className="ml-2 font-medium text-slate-700">
                  ({matchCounts.exact} exact{showCloseMatches ? `, ${matchCounts.strong} strong, ${matchCounts.partial} partial` : ''})
                </span>
              )}
            </span>
            <span className="font-medium text-slate-700">Verified Openings Only</span>
          </div>

          {searchError && !loading && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {searchError}
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : searchError ? null : jobs.length === 0 ? (
            <EmptyState
              icon={Search}
              title={locationQuery || selectedLocality || userCoords ? 'No jobs found near this location' : 'No temporary jobs matching your current filters'}
              description={locationQuery || selectedLocality || userCoords
                ? 'No open shifts match this location and your selected filters. Check the spelling or choose another location.'
                : 'No open shifts found for the selected filters. Try expanding your search radius or selecting another locality.'}
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
            <div className="space-y-6">
              {/* Grouped Tiers Display when mixed smart results are available */}
              {mixedResults && (matchCounts.total > 0 || mixedResults.exact.length > 0 || mixedResults.strong.length > 0 || mixedResults.partial.length > 0) ? (
                <>
                  {/* Tier 1: Exact Matches */}
                  <div className="space-y-3">
                    <div
                      onClick={() => toggleSection('exact')}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 cursor-pointer hover:bg-emerald-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-bold text-emerald-950">Exact Matches</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                          {matchCounts.exact || mixedResults.exact.length}
                        </span>
                        <span className="text-xs text-emerald-700 hidden sm:inline">
                          – 100% hard requirements and profile preferences satisfied
                        </span>
                      </div>
                      <button type="button" className="text-emerald-700" aria-label="Toggle Exact Matches">
                        {openSections.exact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {openSections.exact && (
                      mixedResults.exact.length > 0 ? (
                        <div className="space-y-3 pl-1 sm:pl-2">
                          {mixedResults.exact.map(renderJobCard)}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic pl-3 py-1">
                          No exact matches for the current filters.
                        </p>
                      )
                    )}
                  </div>

                  {/* Tier 2: Strong Matches */}
                  {showCloseMatches && (
                    <div className="space-y-3">
                      <div
                        onClick={() => toggleSection('strong')}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-sky-50/80 border border-sky-200/80 cursor-pointer hover:bg-sky-100/60 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="text-sm font-bold text-sky-950">Strong Matches</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-200 text-sky-900 font-bold">
                            {matchCounts.strong || mixedResults.strong.length}
                          </span>
                          <span className="text-xs text-sky-700 hidden sm:inline">
                            – Meets all mandatory requirements with minor preference trade-offs
                          </span>
                        </div>
                        <button type="button" className="text-sky-700" aria-label="Toggle Strong Matches">
                          {openSections.strong ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {openSections.strong && (
                        mixedResults.strong.length > 0 ? (
                          <div className="space-y-3 pl-1 sm:pl-2">
                            {mixedResults.strong.map(renderJobCard)}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic pl-3 py-1">
                            No strong matches found.
                          </p>
                        )
                      )}
                    </div>
                  )}

                  {/* Tier 3: Partial Matches */}
                  {showCloseMatches && (
                    <div className="space-y-3">
                      <div
                        onClick={() => toggleSection('partial')}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 cursor-pointer hover:bg-amber-100/60 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-sm font-bold text-amber-950">Partial Matches</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                            {matchCounts.partial || mixedResults.partial.length}
                          </span>
                          <span className="text-xs text-amber-700 hidden sm:inline">
                            – Meets mandatory conditions with non-critical profile differences
                          </span>
                        </div>
                        <button type="button" className="text-amber-700" aria-label="Toggle Partial Matches">
                          {openSections.partial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {openSections.partial && (
                        mixedResults.partial.length > 0 ? (
                          <div className="space-y-3 pl-1 sm:pl-2">
                            {mixedResults.partial.map(renderJobCard)}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic pl-3 py-1">
                            No partial matches found.
                          </p>
                        )
                      )}
                    </div>
                  )}

                  {/* Message when close matches are disabled and exact matches are 0 */}
                  {!showCloseMatches && matchCounts.exact === 0 && (
                    <div className="p-6 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50 space-y-3">
                      <p className="text-sm text-slate-600 font-medium">
                        No exact matches found for your current criteria.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setShowCloseMatches(true)}>
                        Show Close Matches ({matchCounts.strong + matchCounts.partial} available)
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                /* Fallback to standard flat list */
                <div className="space-y-3.5">
                  {jobs.map(renderJobCard)}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
