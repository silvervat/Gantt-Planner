// Sarnane ResourceTable'iga, aga projects ja assignments.filter(a => a.projectId === p.id)
import React, { useState, useMemo } from 'react';
import { useDataContext } from '../App';

export default function ProjectTable() {
  const { projects, assignments, resources, addAssignment } = useDataContext();
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'assignments') filtered.sort((a, b) => assignments.filter(a => a.projectId === b.id).length - assignments.filter(a => a.projectId === a.id).length);
    return filtered;
  }, [projects, assignments, filter, sortBy]);

  const handleAddAssignment = (projectId: string, resourceId: string) => {
    const newAssign = { id: `a${Date.now()}`, projectId, resourceId, start: '2025-11-01', end: '2025-11-03', note: 'Uus ülesanne' };
    addAssignment(newAssign);
  };

  return (
    <div className="p-4">
      <input placeholder="Otsi projekti..." value={filter} onChange={e => setFilter(e.target.value)} className="mb-2 p-2 border rounded" />
      <select onChange={e => setSortBy(e.target.value)} className="ml-2 p-2 border rounded">
        <option value="name">Sorteeri nime järgi</option>
        <option value="assignments">Sorteeri ülesannete järgi</option>
      </select>
      <table className="w-full border-collapse border border-neutral-600">
        <thead>
          <tr><th className="border p-2">Nimi</th><th className="border p-2">Värv</th><th className="border p-2">Ülesanded</th><th className="border p-2">Lisa ressurss</th></tr>
        </thead>
        <tbody>
          {filteredProjects.map(p => (
            <tr key={p.id}>
              <td className="border p-2">{p.name}</td>
              <td className="border p-2"><div className="w-4 h-4 rounded-full" style={{backgroundColor: p.color}} /></td>
              <td className="border p-2">{assignments.filter(a => a.projectId === p.id).map(a => a.note).join(', ')}</td>
              <td className="border p-2">
                <select onChange={e => handleAddAssignment(p.id, e.target.value)}>
                  <option>Lisa...</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
