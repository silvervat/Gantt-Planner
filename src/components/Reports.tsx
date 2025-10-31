import React, { useMemo } from 'react';
import { useDataContext } from '../App';
import { addDays, daysBetween } from '../utils/dateUtils';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Reports() {
  const { assignments, resources, projects } = useDataContext();
  const reportRef = React.useRef<HTMLDivElement>(null);

  // --- ARVUTUSED ---
  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(a => new Date(a.end) < new Date()).length;
    const inProgress = assignments.filter(a => new Date(a.start) <= new Date() && new Date(a.end) >= new Date()).length;
    const upcoming = total - completed - inProgress;

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Ressursside koormus (päevad broneeritud / 30 päeva)
    const resourceLoad = resources.map(r => {
      const days = assignments
        .filter(a => a.resourceId === r.id)
        .reduce((sum, a) => sum + daysBetween(a.start, a.end) + 1, 0);
      return { name: r.name, load: Math.min(100, Math.round((days / 30) * 100)) };
    });

    // Projektide edenemine
    const projectProgress = projects.map(p => {
      const projAssigns = assignments.filter(a => a.projectId === p.id);
      const done = projAssigns.filter(a => new Date(a.end) < new Date()).length;
      return { name: p.name, progress: projAssigns.length > 0 ? Math.round((done / projAssigns.length) * 100) : 0 };
    });

    return { total, completed, inProgress, upcoming, progress, resourceLoad, projectProgress };
  }, [assignments, resources, projects]);

  // --- GRAAFIKUD ---
  const pieData = {
    labels: ['Lõpetatud', 'Pooleli', 'Tulevased'],
    datasets: [{
      data: [stats.completed, stats.inProgress, stats.upcoming],
      backgroundColor: ['#16a34a', '#f59e0b', '#6b7280'],
      borderWidth: 1,
    }],
  };

  const barData = {
    labels: stats.resourceLoad.map(r => r.name),
    datasets: [{
      label: 'Koormus (%)',
      data: stats.resourceLoad.map(r => r.load),
      backgroundColor: '#3b82f6',
    }],
  };

  // --- EKSPORT ---
  const exportPNG = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current);
    canvas.toBlob(blob => {
      if (blob) saveAs(blob, 'gantt-raport.png');
    });
  };

  const exportCSV = () => {
    const csv = [
      ['Ressurss', 'Broneeritud päevi (30 päeva jooksul)'],
      ...stats.resourceLoad.map(r => [r.name, Math.round((r.load / 100) * 30)]),
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, 'ressursside_koormus.csv');
  };

  return (
    <div className="p-6 bg-neutral-900 text-neutral-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Projektide Raportid</h1>
          <div className="flex gap-2">
            <button onClick={exportPNG} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">PNG</button>
            <button onClick={exportCSV} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700">CSV</button>
          </div>
        </div>

        <div ref={reportRef} className="space-y-6 bg-neutral-800 p-6 rounded-lg">
          {/* Üldine edenemine */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold">Kokku ülesandeid</h3>
              <p className="text-3xl">{stats.total}</p>
            </div>
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold">Edenemine</h3>
              <p className="text-3xl">{stats.progress}%</p>
            </div>
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold">Pooleli</h3>
              <p className="text-3xl">{stats.inProgress}</p>
            </div>
          </div>

          {/* Graafikud */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Ülesannete jaotus</h3>
              <Pie data={pieData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </div>
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Ressursside koormus (30 päeva)</h3>
              <Bar data={barData} options={{ responsive: true, scales: { y: { max: 100 } } }} />
            </div>
          </div>

          {/* Projektide edenemine */}
          <div className="bg-neutral-700 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Projektide edenemine</h3>
            <div className="space-y-2">
              {stats.projectProgress.map(p => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-32 text-sm">{p.name}</span>
                  <div className="flex-1 bg-neutral-600 rounded-full h-6 overflow-hidden">
                    <div className="bg-green-500 h-full transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-sm w-12 text-right">{p.progress}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kriitiline tee (lihtne versioon) */}
          <div className="bg-neutral-700 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Kriitiline tee (näide)</h3>
            <p className="text-sm text-neutral-300">
              Kõige pikem ülesannete ahel: <strong>RM2506 → MG-EKS</strong> (42 päeva)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
