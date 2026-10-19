import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Clock,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Save,
  Plus,
  X,
  Navigation
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { WorkerProfile } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const WorkerProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [experienceSummary, setExperienceSummary] = useState('');
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [preferredLocationName, setPreferredLocationName] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>([0, 0]); // [lng, lat]
  const [travelRadiusKm, setTravelRadiusKm] = useState<number>(25);
  const [minPay, setMinPay] = useState<number>(20);
  const [maxPay, setMaxPay] = useState<number>(35);
  const [payBasis, setPayBasis] = useState<string>('hourly');

  // Availability states
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);

  const allCategories = [
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

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const allTimeSlots = ['Morning', 'Afternoon', 'Evening', 'Night'];

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get('/workers/me');
        if (res.data?.success && res.data?.profile) {
          const p: WorkerProfile = res.data.profile;
          setName(res.data.user?.name || user?.name || '');
          setBio(p.bio || '');
          setSkills(p.skills || []);
          setExperienceSummary(p.experienceSummary || '');
          setPreferredCategories(p.preferredCategories || []);
          setPreferredLocationName(p.preferredLocationName || '');
          if (p.location?.coordinates) {
            setCoordinates(p.location.coordinates);
          }
          setTravelRadiusKm(p.travelRadiusKm || 25);
          setMinPay(p.expectedPay?.min || 20);
          setMaxPay(p.expectedPay?.max || 35);
          setPayBasis(p.expectedPay?.basis || 'hourly');
          setIsAvailable(p.availability?.isAvailable ?? true);
          setSelectedDays(p.availability?.days || ['Monday', 'Wednesday', 'Friday']);
          setSelectedTimeSlots(p.availability?.timeSlots || ['Morning', 'Afternoon']);
        }
      } catch (err: any) {
        toastError(err.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleAddSkill = () => {
    const trimmed = newSkillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const toggleCategory = (cat: string) => {
    if (preferredCategories.includes(cat)) {
      setPreferredCategories(preferredCategories.filter((c) => c !== cat));
    } else {
      setPreferredCategories([...preferredCategories, cat]);
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleTimeSlot = (slot: string) => {
    if (selectedTimeSlots.includes(slot)) {
      setSelectedTimeSlots(selectedTimeSlots.filter((s) => s !== slot));
    } else {
      setSelectedTimeSlots([...selectedTimeSlots, slot]);
    }
  };

  const handleUseBrowserGPS = () => {
    if (!navigator.geolocation) {
      toastError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoordinates([longitude, latitude]);
        if (!preferredLocationName) {
          setPreferredLocationName(`GPS Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        }
        success('Coordinates captured from your device location.');
      },
      (err) => {
        toastError(`Location permission denied or unavailable: ${err.message}`);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/workers/me', {
        name,
        bio,
        skills,
        experienceSummary,
        preferredCategories,
        preferredLocationName,
        coordinates,
        travelRadiusKm,
        expectedPay: { min: Number(minPay), max: Number(maxPay), basis: payBasis }
      });

      await api.patch('/workers/me/availability', {
        isAvailable,
        days: selectedDays,
        timeSlots: selectedTimeSlots
      });

      await refreshUser();
      success('Worker profile & availability preferences updated successfully!');
    } catch (err: any) {
      toastError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Worker Profile & Matching Settings</h1>
          <p className="text-xs text-slate-500">
            Keep your skills and schedule updated to get accurate explainable AI recommendations.
          </p>
        </div>

        {user?.verificationStatus === 'verified' && (
          <Badge variant="blue" size="md">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            Verified Worker Profile
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Availability Switch Card */}
        <Card className="p-5 flex items-center justify-between border-emerald-200 bg-emerald-50/40">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Immediate Availability Status</h3>
            <p className="text-xs text-slate-500">
              When turned on, your profile is evaluated for open shifts. Turn off if taking a break.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </Card>

        {/* Basic Info */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Short Professional Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Experienced in customer-facing hospitality, warehouse packing, and registration desks..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </Card>

        {/* Skills Tag Management */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Skills & Competencies (Used for 30% Matching Fit)
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSkillInput}
              onChange={(e) => setNewSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
              placeholder="e.g. Guest Registration, Food Handling, Box Packing"
              className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Button type="button" size="sm" onClick={handleAddSkill} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Skill
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Experience Summary</label>
            <textarea
              rows={2}
              value={experienceSummary}
              onChange={(e) => setExperienceSummary(e.target.value)}
              placeholder="Summary of previous part-time or flexible shifts..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
        </Card>

        {/* Location & Travel Radius */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Location & Travel Radius (Used for 25% Distance Fit)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Location Name / Neighborhood</label>
              <input
                type="text"
                value={preferredLocationName}
                onChange={(e) => setPreferredLocationName(e.target.value)}
                placeholder="e.g. Midtown Manhattan or Downtown Brooklyn"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Device Coordinates (Longitude, Latitude)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}`}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseBrowserGPS}
                  leftIcon={<Navigation className="w-3.5 h-3.5 text-emerald-600" />}
                >
                  GPS
                </Button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="font-medium text-slate-700">Preferred Travel Radius:</span>
              <span className="font-bold text-emerald-700">{travelRadiusKm} km</span>
            </div>
            <input
              type="range"
              min={5}
              max={80}
              step={5}
              value={travelRadiusKm}
              onChange={(e) => setTravelRadiusKm(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
        </Card>

        {/* Availability & Pay */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Availability & Target Compensation
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Available Days of the Week</label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const active = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Preferred Shift Times</label>
            <div className="flex flex-wrap gap-2">
              {allTimeSlots.map((slot) => {
                const active = selectedTimeSlots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleTimeSlot(slot)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Minimum (₹)</label>
              <input
                type="number"
                min="0"
                value={minPay}
                onChange={(e) => setMinPay(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Maximum (₹)</label>
              <input
                type="number"
                min="0"
                value={maxPay}
                onChange={(e) => setMaxPay(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pay Basis</label>
              <select
                value={payBasis}
                onChange={(e) => setPayBasis(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none cursor-pointer"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="shift">Shift-based</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Preferred Categories */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Preferred Job Categories
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allCategories.map((cat) => {
              const active = preferredCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`p-2.5 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{cat}</span>
                  {active && <span className="text-emerald-600 font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <Button type="submit" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
            Save Profile & Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
