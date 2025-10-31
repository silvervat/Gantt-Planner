import React, { useMemo, useRef } from 'react';
import { useDataContext } from '../App';
import { daysBetween } from '../utils/dateUtils';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function Reports() {
  const { assignments, resources, projects } = useDataContext();
  const reportRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const total = assignments.length;

    // Ressursside koormus (päevad broneeritud viimase 30 päeva jooksul)
    const now = new Date();
    const start30 = new Date(now);
    start30.setDate(now.getDate() - 30);
    const end30 = new Date(now);
    end30.setDate(now.getDate() + 30);

    const resourceLoad = resources.map(r => {
      const days = assignments
        .filter(a => a.resourceId === r.id)
        .reduce((sum, a) => {
          const start = new Date(a.start);
          const end = new Date(a.end);
          const overlapStart = new Date(Math.max(start.getTime(), start30.getTime()));
          const overlapEnd = new Date(Math.min(end.getTime(), end30.getTime()));
          if (overlapStart <= overlapEnd) {
            return sum + daysBetween(overlapStart.toISOString().slice(0,10), overlapEnd.toISOString().slice(0,10)) + 1;
          }
          return sum;
        }, 0);
      return { name: r.name, days, load: Math.min(100, Math.round((days / 60) * 100)) };
    });

    // Projektide ülesannete arv
    const projectTasks = projects.map(p => {
      const count = assignments.filter(a => a.projectId === p.id).length;
      return { name: p.name, count };
    });

    return { total, resourceLoad, projectTasks };
  }, [assignments, resources, projects]);

  const barData = {
    labels: stats.resourceLoad.map(r => r.name),
    datasets: [{
      label: 'Broneeritud päevi (60 päeva)',
      data: stats.resourceLoad.map(r => r.days),
      backgroundColor: '#3b82f6',
    }],
  };

  const exportPNG = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current);
    canvas.toBlob(blob => {
      if (blob) saveAs(blob, 'ressursside-raport.png');
    });
  };

  const exportCSV = () => {
    const csv = [
      ['Ressurss', 'Broneeritud päevi (60 päeva)'],
      ...stats.resourceLoad.map(r => [r.name, r.days]),
    ].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, 'ressursside_koormus.csv');
  };

  return (
    <div className="p-6 bg-neutral-900 text-neutral-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Ressursside Raportid</h1>
          <div className="flex gap-2">
            <button onClick={exportPNG} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">PNG</button>
            <button onClick={exportCSV} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700">CSV</button>
          </div>
        </div>

        <div ref={reportRef} className="space-y-6 bg-neutral-800 p-6 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold">Kokku ülesandeid</h3>
              <p className="text-3xl">{stats.total}</p>
            </div>
            <div className="bg-neutral-700 p-4 rounded">
              <h3 className="text-lg font-semibold">Aktiivseid ressursse</h3>
              <p className="text-3xl">{resources.length}</p>
            </div>
          </div>

          <div className="bg-neutral-700 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Ressursside koormus (60 päeva)</h3>
            <Bar data={barData} options={{ responsive: true }} />
          </div>

          <div className="bg-neutral-700 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Projektide ülesannete arv</h3>
            <div className="space-y-2">
              {stats.projectTasks.map(p => (
                <div key={p.name} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-mono">{p.count} ülesannet</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
