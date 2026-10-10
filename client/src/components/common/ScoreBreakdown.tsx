import React from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { MatchData } from '../../types';

interface ScoreBreakdownProps {
  matchData: MatchData;
  className?: string;
}

export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ matchData, className = '' }) => {
  const { matchScore, componentScores, matchedSkills, missingSkills, explanations, warnings, distanceKm } = matchData;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-sky-700 bg-sky-50 border-sky-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-sky-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Explainable AI Compatibility</h4>
            <p className="text-xs text-slate-500">Transparent 5-factor scoring engine</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-xl border text-sm font-bold flex items-center gap-1.5 ${getScoreColor(matchScore)}`}>
          <span>{matchScore}%</span>
          <span className="text-xs font-medium uppercase tracking-wider opacity-80">Match</span>
        </div>
      </div>

      {/* Component Scores Bar Chart */}
      <div className="py-4 space-y-3">
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Skills Compatibility (30% weight)</span>
            <span>{componentScores.skills}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${getBarColor(componentScores.skills)}`} style={{ width: `${componentScores.skills}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Location & Distance (25% weight) {distanceKm !== null ? `(~${distanceKm} km)` : ''}</span>
            <span>{componentScores.location}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${getBarColor(componentScores.location)}`} style={{ width: `${componentScores.location}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Schedule & Availability (20% weight)</span>
            <span>{componentScores.availability}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${getBarColor(componentScores.availability)}`} style={{ width: `${componentScores.availability}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Pay Preference (15% weight)</span>
            <span>{componentScores.payment}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${getBarColor(componentScores.payment)}`} style={{ width: `${componentScores.payment}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
            <span>Category & Experience (10% weight)</span>
            <span>{componentScores.categoryExperience}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${getBarColor(componentScores.categoryExperience)}`} style={{ width: `${componentScores.categoryExperience}%` }} />
          </div>
        </div>
      </div>

      {/* Skills breakdown */}
      <div className="pt-3 pb-2 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-700 mb-2">Skills Evaluation:</div>
        <div className="flex flex-wrap gap-1.5">
          {matchedSkills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {s}
            </span>
          ))}
          {missingSkills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200">
              <Info className="w-3 h-3 text-slate-400" />
              {s} (missing)
            </span>
          ))}
        </div>
      </div>

      {/* Explanations */}
      {explanations && explanations.length > 0 && (
        <div className="pt-3 border-t border-slate-100 space-y-1.5">
          <div className="text-xs font-semibold text-slate-700">Detailed Explanations:</div>
          <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
            {explanations.map((exp, i) => (
              <li key={i}>{exp}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{warnings.join(' • ')}</div>
        </div>
      )}

      {/* Transparency Note */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        <span>WorkMatch AI informs human decisions; employers hire, workers voluntarily choose.</span>
      </div>
    </div>
  );
};
