import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Job, MixedMatchResults, MixedMatchCounts } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ScoreBreakdown } from '../../components/common/ScoreBreakdown';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { formatPayWithBasis } from '../../utils/currency';

export const WorkerRecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
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
  const [requiresProfileCompletion, setRequiresProfileCompletion] = useState<boolean>(false);

  // AI Explanation Modal
  const [explainingJob, setExplainingJob] = useState<Job | null>(null);
  const [aiText, setAiText] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Application Modal
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/recommendations/jobs?showCloseMatches=${showCloseMatches ? 'true' : 'false'}`);
      if (res.data?.success) {
        setJobs(res.data.recommendations || []);
        if (res.data.results) {
          setMixedResults(res.data.results);
        }
        if (res.data.counts) {
          setMatchCounts(res.data.counts);
        }
        setRequiresProfileCompletion(Boolean(res.data.requiresProfileCompletion));
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to fetch recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [showCloseMatches]);

  const handleExplainAI = async (job: Job) => {
    setExplainingJob(job);
    setAiText('');
    setIsAiLoading(true);

    try {
      const res = await api.post('/recommendations/explain', { jobId: job._id });
      if (res.data?.success && res.data?.aiExplanation) {
        setAiText(res.data.aiExplanation.explanation);
      }
    } catch {
      setAiText('Matches your listed competencies and preferred compensation range.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJob) return;

    setIsApplying(true);
    try {
      const res = await api.post(`/jobs/${applyingJob._id}/apply`, { message: applyMessage });
      if (res.data?.success) {
        success('Voluntary application submitted to employer!');
        setApplyingJob(null);
        setApplyMessage('');
        fetchRecommendations();
      }
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const toggleSection = (section: 'exact' | 'strong' | 'partial') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderRecommendationCard = (job: Job) => (
    <Card key={job._id} className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="emerald">{job.category}</Badge>

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
            {job.matchData && (
              <Badge
                variant={job.matchData.matchScore >= 80 ? 'emerald' : 'amber'}
                size="md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {job.matchData.matchScore}% Match Score
              </Badge>
            )}
          </div>

          <Link to={`/jobs/${job._id}`}>
            <h3 className="text-lg font-bold text-slate-900 hover:text-emerald-600 transition-colors">
              {job.title}
            </h3>
          </Link>

          <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span
              className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-md"
              title={job.employerProfile?.businessName || job.employer?.name}
            >
              {job.employerProfile?.businessName || job.employer?.name}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {job.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
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
        </div>

        {/* Right Pay & CTA Block */}
        <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
          <div>
            <div className="text-2xl font-black text-slate-900">
              {formatPayWithBasis(job.grossPay, job.payBasis)}
            </div>
            <span className="text-[11px] text-slate-400">
              {job.openings - job.filledCount} opening{job.openings === 1 ? '' : 's'} remaining
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExplainAI(job)}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
            >
              Why this match?
            </Button>

            <Button
              size="sm"
              onClick={() => setApplyingJob(job)}
              rightIcon={<Send className="w-3.5 h-3.5" />}
            >
              Apply Now
            </Button>
          </div>
        </div>
      </div>

      {/* Embedded Score Breakdown component */}
      {job.matchData && (
        <div className="pt-4 border-t border-slate-100">
          <ScoreBreakdown matchData={job.matchData} />
        </div>
      )}
    </Card>
  );

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Mixed Smart Matching Engine
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personalized Shift Recommendations</h1>
          <p className="text-xs text-slate-500">
            Categorized into Exact Matches, Strong Matches, and Partial Matches based on your verified skills, location, availability, and pay expectations.
          </p>
        </div>

        {/* Show close matches toggle */}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs hover:border-slate-300 transition-colors self-start sm:self-auto">
          <input
            type="checkbox"
            checked={showCloseMatches}
            onChange={(e) => setShowCloseMatches(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
          />
          <span>Show close matches</span>
        </label>
      </div>

      {jobs.length === 0 ? (
        requiresProfileCompletion ? (
          <EmptyState
            icon={Sparkles}
            title="Complete Your Profile to Get AI Matches"
            description="Add your skills and work preferences so WorkMatch can find relevant opportunities for you."
            actionText="Edit Worker Profile"
            onAction={() => navigate('/worker/profile')}
          />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No matching jobs found yet."
            description="Try updating your skills or preferences, or check again later."
            actionText="Update Skills & Preferences"
            onAction={() => navigate('/worker/profile')}
          />
        )
      ) : (
        <div className="space-y-6">
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
                      – 100% hard constraints and profile preferences satisfied
                    </span>
                  </div>
                  <button type="button" className="text-emerald-700" aria-label="Toggle Exact Matches">
                    {openSections.exact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {openSections.exact && (
                  mixedResults.exact.length > 0 ? (
                    <div className="space-y-4 pl-1 sm:pl-2">
                      {mixedResults.exact.map(renderRecommendationCard)}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic pl-3 py-1">
                      No exact matches at this moment.
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
                        – Mandatory requirements satisfied with minor preference differences
                      </span>
                    </div>
                    <button type="button" className="text-sky-700" aria-label="Toggle Strong Matches">
                      {openSections.strong ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {openSections.strong && (
                    mixedResults.strong.length > 0 ? (
                      <div className="space-y-4 pl-1 sm:pl-2">
                        {mixedResults.strong.map(renderRecommendationCard)}
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
                        – Meets mandatory requirements with non-critical profile trade-offs
                      </span>
                    </div>
                    <button type="button" className="text-amber-700" aria-label="Toggle Partial Matches">
                      {openSections.partial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {openSections.partial && (
                    mixedResults.partial.length > 0 ? (
                      <div className="space-y-4 pl-1 sm:pl-2">
                        {mixedResults.partial.map(renderRecommendationCard)}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic pl-3 py-1">
                        No partial matches found.
                      </p>
                    )
                  )}
                </div>
              )}
            </>
          ) : (
            /* Fallback to flat list */
            jobs.map(renderRecommendationCard)
          )}
        </div>
      )}

      {/* AI Explanation Modal */}
      {explainingJob && (
        <Modal
          isOpen={Boolean(explainingJob)}
          onClose={() => setExplainingJob(null)}
          title="AI Match Analysis"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Match Rating: {explainingJob.matchData?.matchScore}% ({explainingJob.matchType ? explainingJob.matchType.toUpperCase() + ' MATCH' : 'MATCH'})
              </div>
              {isAiLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  Generating personalized reasoning...
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                  {aiText}
                </p>
              )}
            </div>

            {explainingJob.matchData && (
              <ScoreBreakdown matchData={explainingJob.matchData} />
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setExplainingJob(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Apply Modal */}
      {applyingJob && (
        <Modal
          isOpen={Boolean(applyingJob)}
          onClose={() => setApplyingJob(null)}
          title={`Apply for ${applyingJob.title}`}
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Note to Employer (Optional)
              </label>
              <textarea
                value={applyMessage}
                onChange={(e) => setApplyMessage(e.target.value)}
                placeholder="Mention relevant experience or shift readiness..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setApplyingJob(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                isLoading={isApplying}
                rightIcon={<Send className="w-3.5 h-3.5" />}
              >
                Submit Application
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
