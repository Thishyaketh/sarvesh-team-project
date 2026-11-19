"use client";

import { useEffect, useRef } from "react";
import type LType from "leaflet";
import type { Report } from "@/lib/types";

interface CivicMapProps {
  reports?: Report[];
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
  selectedPosition?: [number, number] | null;
  onSelectPosition?: (lat: number, lng: number) => void;
}

function categoryColor(category: string): string {
  switch (category) {
    case "Overflowing garbage bin":
      return "#b45309"; // amber-700
    case "Water leakage":
      return "#0284c7"; // sky-600
    case "Damaged footpath / road":
      return "#475569"; // slate-600
    case "Streetlight problem":
      return "#7c3aed"; // violet-600
    default:
      return "#dc2626"; // red-600 for Other / Not sure
  }
}

export default function CivicMap({
  reports = [],
  center = [13.0373, 80.2123],
  zoom = 15,
  heightClass = "h-80",
  selectedPosition = null,
  onSelectPosition,
}: CivicMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerGroupRef = useRef<LType.LayerGroup | null>(null);

  useEffect(() => {
    let active = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      if (!active || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center,
        zoom,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const group = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerGroupRef.current = group;

      if (onSelectPosition) {
        map.on("click", (e: LType.LeafletMouseEvent) => {
          const lat = Number(e.latlng.lat.toFixed(4));
          const lng = Number(e.latlng.lng.toFixed(4));
          onSelectPosition(lat, lng);
        });
      }
    }

    initMap();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function renderMarkers() {
      if (!mapRef.current || !layerGroupRef.current) return;
      const L = (await import("leaflet")).default;
      const group = layerGroupRef.current;
      group.clearLayers();

      for (const r of reports) {
        const color = categoryColor(r.category);
        const marker = L.circleMarker([r.approx_lat, r.approx_lng], {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        });
        const badge = r.is_sample ? "[Sample]" : "[Live]";
        marker.bindPopup(
          `<div style="min-width:190px;font-family:sans-serif;font-size:12px;">
            <div style="font-weight:700;color:#132a46;margin-bottom:4px;">${r.category}</div>
            <div style="color:#475569;margin-bottom:4px;">${r.location_label}</div>
            <div style="margin-bottom:6px;">${r.description}</div>
            <div style="font-size:11px;color:#64748b;">
              Status: <strong>${r.status}</strong> &middot; Priority: <strong>${r.priority_band} (${r.priority_score})</strong> &middot; ${badge}
            </div>
          </div>`
        );
        marker.addTo(group);
      }

      if (selectedPosition) {
        L.circleMarker(selectedPosition, {
          radius: 10,
          color: "#132a46",
          weight: 3,
          fillColor: "#d4a843",
          fillOpacity: 0.9,
        })
          .bindPopup("Approximate selected location")
          .addTo(group);
      }
    }

    renderMarkers();
  }, [reports, selectedPosition]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-xl border border-slate-200 overflow-hidden z-0`}
    />
  );
}
