import React, { useState, useMemo } from 'react';
import { useDataContext } from '../App'; // Context import

export default function ResourceTable() {
  const { resources, assignments, addAssignment } = useDataContext();
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filteredResources = useMemo(() => {
    let filtered = resources.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()));
    if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'assignments') filtered.sort((a, b) => assignments.filter(a => a.resourceId === b.id).length - assignments.filter(a => a.resourceId === a.id).length);
    return filtered;
  }, [resources, assignments, filter, sortBy]);

  const handleAddAssignment = (resourceId: string, projectId: string) => {
    const newAssign = { id: `a${Date.now()}`, projectId, resourceId, start: '2025-11-01', end: '2025-11-03', note: 'Uus ülesanne' };
    addAssignment(newAssign);
  };

  return (
    <div className="p-4">
      <input 
        placeholder="Otsi ressurssi..." 
        value={filter} 
        onChange={e => setFilter(e.target.value)} 
        className="mb-2 p-2 border rounded"
      />
      <select onChange={e => setSortBy(e.target.value)} className="ml-2 p-2 border rounded">
        <option value="name">Sorteeri nime järgi</option>
        <option value="assignments">Sorteeri ülesannete järgi</option>
      </select>
      <table className="w-full border-collapse border border-neutral-600">
        <thead>
          <tr><th className="border p-2">Nimi</th><th className="border p-2">Värv</th><th className="border p-2">Ülesanded</th><th className="border p-2">Lisa projekt</th></tr>
        </thead>
        <tbody>
          {filteredResources.map(r => (
            <tr key={r.id}>
              <td className="border p-2">{r.name}</td>
              <td className="border p-2"><div className="w-4 h-4 rounded-full" style={{backgroundColor: r.color}} /></td>
              <td className="border p-2">{assignments.filter(a => a.resourceId === r.id).map(a => a.note).join(', ')}</td>
              <td className="border p-2">
                <select onChange={e => handleAddAssignment(r.id, e.target.value)}>
                  <option>Lisa...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
