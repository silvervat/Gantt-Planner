import React from 'react';

interface Props {
  viewMode: 'resources' | 'projects';
  onViewChange: (mode: 'resources' | 'projects') => void;
  dayWidth: number;
  onDayWidthChange: (w: number) => void;
}

export default function Toolbar({ viewMode, onViewChange, dayWidth, onDayWidthChange }: Props) {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-neutral-700 bg-neutral-950 text-[11px]">
      <button className={`px-2 py-1 rounded-md border ${viewMode === "resources" ? "bg-neutral-700" : "bg-neutral-900"}`} onClick={() => onViewChange("resources")}>
        Ressursid
      </button>
      <button className={`px-2 py-1 rounded-md border ${viewMode === "projects" ? "bg-neutral-700" : "bg-neutral-900"}`} onClick={() => onViewChange("projects")}>
        Projektid
      </button>
      <div className="text-neutral-400 ml-4">Lohista keskelt = nihuta | Servast = venita</div>
      <div className="ml-auto flex items-center gap-1">
        <span className="text-neutral-500">Päev</span>
        <button className="px-2 py-1 border rounded" onClick={() => onDayWidthChange(Math.max(24, dayWidth - 8))}>-</button>
        <button className="px-2 py-1 border rounded" onClick={() => onDayWidthChange(Math.min(160, dayWidth + 8))}>+</button>
      </div>
    </div>
  );
}
