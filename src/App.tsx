import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Planner from './components/Planner';
import ResourceTable from './components/ResourceTable';
import ProjectTable from './components/ProjectTable';
import { loadData, saveData } from './utils/storage';
import { Resource, Project, Assignment } from './types'; // Lisa types.ts vajadusel

interface DataContextType {
  resources: Resource[];
  projects: Project[];
  assignments: Assignment[];
  viewMode: 'resources' | 'projects';
  setViewMode: (mode: 'resources' | 'projects') => void;
  addAssignment: (assign: Assignment) => void;
  setAssignments: (assigns: Assignment[]) => void;
}

export const DataContext = createContext<DataContextType | null>(null);

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useDataContext peab olema DataProvider sees');
  return context;
}

export default function App() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [viewMode, setViewMode] = useState<'resources' | 'projects'>('resources');

  useEffect(() => {
    loadData().then(data => {
      setResources(data.resources);
      setProjects(data.projects);
      setAssignments(data.assignments);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (resources.length && projects.length && assignments.length) {
      saveData({ resources, projects, assignments }).catch(console.error);
    }
  }, [resources, projects, assignments]);

  const addAssignment = (newAssign: Assignment) => {
    setAssignments(prev => [...prev, newAssign]);
  };

  return (
    <DataContext.Provider value={{ resources, projects, assignments, viewMode, setViewMode, addAssignment, setAssignments }}>
      <Router>
        <nav className="bg-neutral-800 p-2 flex gap-4">
          <Link to="/" className="text-blue-400">Timeline</Link>
          <Link to="/resources" className="text-blue-400">Ressursid</Link>
          <Link to="/projects" className="text-blue-400">Projektid</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Planner />} />
          <Route path="/resources" element={<ResourceTable />} />
          <Route path="/projects" element={<ProjectTable />} />
        </Routes>
      </Router>
    </DataContext.Provider>
  );
}
