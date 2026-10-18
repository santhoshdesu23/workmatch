import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Building2,
  ArrowRight,
  Send,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Job } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ScoreBreakdown } from '../../components/common/ScoreBreakdown';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const WorkerRecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError, info } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [requiresProfileCompletion, setRequiresProfileCompletion] = useState<boolean>(false);

  // AI Explanation Modal
  const [explainingJob, setExplainingJob] = useState<Job | null>(null);
  const [aiText, setAiText] = useState<string>('');
  const [aiSource, setAiSource] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Application Modal
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/recommendations/jobs');
      if (res.data?.success) {
        setJobs(res.data.recommendations || []);
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
  }, []);

  const handleExplainAI = async (job: Job) => {
    setExplainingJob(job);
    setAiText('');
    setIsAiLoading(true);

    try {
      const res = await api.post('/recommendations/explain', { jobId: job._id });
      if (res.data?.success && res.data?.aiExplanation) {
        setAiText(res.data.aiExplanation.explanation);
        setAiSource(res.data.aiExplanation.source);
      }
    } catch (err: any) {
      setAiText('Matches your listed competencies and preferred compensation range.');
      setAiSource('fallback-engine');
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

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          Explainable AI Match Engine
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personalized Shift Recommendations</h1>
        <p className="text-xs text-slate-500">
          Ranked using our 5-factor compatibility formula: Skills (30%), Location (25%), Schedule (20%), Pay (15%), and Category (10%).
        </p>
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
          {jobs.map((job) => (
            <Card key={job._id} className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="emerald">{job.category}</Badge>
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

                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-800">
                      {job.employerProfile?.businessName || job.employer?.name}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.locationName}</span>
                      {job.distanceKm !== null && (
                        <span className="text-emerald-700 font-semibold">(~{job.distanceKm} km away)</span>
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
                </div>

                {/* Right Pay & CTA Block */}
                <div className="sm:text-right shrink-0 flex flex-col justify-between sm:items-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
                  <div>
                    <div className="text-2xl font-black text-slate-900">
                      ${job.grossPay}
                      <span className="text-xs font-normal text-slate-500"> / {job.payBasis}</span>
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
                      AI Summary
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setApplyingJob(job)}
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Apply Now
                    </Button>
                  </div>
                </div>
              </div>

              {/* Explainable AI Score Breakdown Embed */}
              {job.matchData && (
                <div className="pt-2">
                  <ScoreBreakdown matchData={job.matchData} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* AI Explanation Modal */}
      <Modal
        isOpen={Boolean(explainingJob)}
        onClose={() => setExplainingJob(null)}
        title="AI Match Insights"
        subtitle={explainingJob ? explainingJob.title : ''}
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-emerald-900">Conversational Match Summary</span>
              {aiSource && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ml-auto font-medium">
                  {aiSource}
                </span>
              )}
            </div>

            {isAiLoading ? (
              <p className="text-xs text-slate-500 italic">Synthesizing match factors...</p>
            ) : (
              <p className="text-xs text-slate-800 leading-relaxed">{aiText}</p>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            * Generated dynamically by the WorkMatch AI layer using declared skills and shift requirements.
          </p>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setExplainingJob(null)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Voluntary Application Modal */}
      <Modal
        isOpen={Boolean(applyingJob)}
        onClose={() => setApplyingJob(null)}
        title="Voluntary Shift Application"
        subtitle={applyingJob ? applyingJob.title : ''}
      >
        <form onSubmit={handleApplySubmit} className="space-y-4">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
            You are voluntarily applying for this opening. The employer will review your profile and match score before confirming.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Personal Message to Employer (Optional)
            </label>
            <textarea
              rows={4}
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Highlight any relevant skills, arrival punctuality, or why you'd be a great fit..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setApplyingJob(null)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isApplying} leftIcon={<Send className="w-3.5 h-3.5" />}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
