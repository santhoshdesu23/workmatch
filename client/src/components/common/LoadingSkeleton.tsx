import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className = ''
}) => {
  return (
    <div className={`space-y-4 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-16"></div>
          </div>
          <div className="h-3 bg-slate-100 rounded w-2/3"></div>
          <div className="flex gap-2 pt-2">
            <div className="h-6 bg-slate-100 rounded-md w-20"></div>
            <div className="h-6 bg-slate-100 rounded-md w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
