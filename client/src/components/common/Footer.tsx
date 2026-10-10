import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ShieldCheck, HeartHandshake, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16 text-slate-600 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">WorkMatch</span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed">
              AI-Powered Location-Based Temporary Employment Marketplace. Empowering flexible workers and reliable employers with transparent pay, verified profiles, and voluntary applications.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>Location-Aware Shift Discovery</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Discovery</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/jobs" className="hover:text-emerald-600 transition-colors">Browse All Jobs</Link></li>
              <li><Link to="/jobs?category=Event assistance" className="hover:text-emerald-600 transition-colors">Event & Catering Support</Link></li>
              <li><Link to="/jobs?category=Warehouse and packing" className="hover:text-emerald-600 transition-colors">Warehouse & Logistics</Link></li>
              <li><Link to="/jobs?category=Retail and store assistance" className="hover:text-emerald-600 transition-colors">Retail & Hospitality</Link></li>
              <li><Link to="/how-it-works" className="hover:text-emerald-600 transition-colors">How WorkMatch Works</Link></li>
            </ul>
          </div>

          {/* Trust & Safety */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Trust & Safety</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/safety" className="hover:text-emerald-600 transition-colors">Trust & Safety Overview</Link></li>
              <li><Link to="/safety#verified" className="hover:text-emerald-600 transition-colors">Verified Profiles Standard</Link></li>
              <li><Link to="/safety#reporting" className="hover:text-emerald-600 transition-colors">Incident & Scam Reporting</Link></li>
              <li><Link to="/safety#payments" className="hover:text-emerald-600 transition-colors">Payment Transparency</Link></li>
              <li><Link to="/about" className="hover:text-emerald-600 transition-colors">Core AI Ethics Policy</Link></li>
            </ul>
          </div>

          {/* Legal & Compliance */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Legal & Governance</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/terms" className="hover:text-emerald-600 transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-emerald-600 transition-colors">Privacy & Data Protection</Link></li>
              <li><span className="text-slate-400">Zero Autonomous Hiring Policy</span></li>
              <li><span className="text-slate-400">GDPR & Consumer Rights</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} WorkMatch Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" /> Human-Governed AI Matching
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <HeartHandshake className="w-3.5 h-3.5" /> Voluntary Applications
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
