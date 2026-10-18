import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Job } from '../../types';

interface JobMapProps {
  jobs: Job[];
  userLocation?: [number, number]; // [lat, lng]
  onSelectJob?: (job: Job) => void;
  className?: string;
  zoom?: number;
}

export const JobMap: React.FC<JobMapProps> = ({
  jobs,
  userLocation,
  onSelectJob,
  className = 'h-96 w-full',
  zoom = 12
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center coordinates: user location, or first job with valid coordinates, or Atigre/Kolhapur default [16.7410, 74.3720]
    let centerLat = 16.7410;
    let centerLng = 74.3720;

    if (userLocation && userLocation[0] !== 0 && userLocation[1] !== 0) {
      centerLat = userLocation[0];
      centerLng = userLocation[1];
    } else {
      const firstValidJob = jobs.find(
        (j) =>
          j.location?.coordinates &&
          (j.location.coordinates[0] !== 0 || j.location.coordinates[1] !== 0)
      );
      if (firstValidJob?.location?.coordinates) {
        centerLat = firstValidJob.location.coordinates[1];
        centerLng = firstValidJob.location.coordinates[0];
      }
    }

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([centerLat, centerLng], zoom);
    }

    const map = mapInstanceRef.current;

    // Clear previous markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Custom job icon
    const jobIcon = L.divIcon({
      className: 'custom-job-marker',
      html: `<div style="background-color: #059669; color: white; border-radius: 9999px; padding: 4px 8px; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); white-space: nowrap;">💼 Job</div>`,
      iconSize: [40, 24],
      iconAnchor: [20, 12]
    });

    // User location marker
    if (userLocation && userLocation[0] !== 0 && userLocation[1] !== 0) {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div style="background-color: #2563eb; color: white; border-radius: 9999px; padding: 4px 8px; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); white-space: nowrap;">📍 You</div>`,
        iconSize: [36, 24],
        iconAnchor: [18, 12]
      });

      L.marker([userLocation[0], userLocation[1]], { icon: userIcon })
        .addTo(map)
        .bindPopup('<b>Your Location</b>');
    }

    // Add markers for jobs
    jobs.forEach((job) => {
      if (
        job.location?.coordinates &&
        (job.location.coordinates[0] !== 0 || job.location.coordinates[1] !== 0)
      ) {
        const [lng, lat] = job.location.coordinates;
        const marker = L.marker([lat, lng], { icon: jobIcon }).addTo(map);

        const currSym = job.currency === 'INR' ? '₹' : '$';
        const demoTag = job.isDemo ? '<span style="background: #f1f5f9; color: #475569; font-size: 10px; padding: 1px 5px; border-radius: 4px; font-weight: 600; border: 1px solid #cbd5e1; margin-left: 4px;">DEMO</span>' : '';

        const popupContent = `
          <div style="min-width: 180px; font-family: sans-serif;">
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${job.title} ${demoTag}</div>
            <div style="font-size: 11px; color: #059669; font-weight: 600; margin-bottom: 4px;">${currSym}${job.grossPay} / ${job.payBasis}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${job.locationName}</div>
            <a href="/jobs/${job._id}" style="display: inline-block; font-size: 11px; color: #059669; font-weight: 600; text-decoration: underline;">View Details &rarr;</a>
          </div>
        `;

        marker.bindPopup(popupContent);
        if (onSelectJob) {
          marker.on('click', () => onSelectJob(job));
        }
      }
    });

    return () => {
      // Cleanup on unmount handled by ref check
    };
  }, [jobs, userLocation, zoom, onSelectJob]);

  return <div ref={mapContainerRef} className={`rounded-2xl border border-slate-200 overflow-hidden shadow-xs ${className}`} />;
};
