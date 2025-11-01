import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDataContext } from '../App';
import { Project } from '../types';

interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export default function ProjectTable() {
  const { projects, setProjects, assignments } = useDataContext();
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [copiedData, setCopiedData] = useState<Project | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Column definitions
  const columns = [
    { key: 'name', label: 'Nimi', editable: true, type: 'text' },
    { key: 'color', label: 'Värv', editable: true, type: 'color' },
    { key: 'status', label: 'Staatus', editable: true, type: 'select', options: ['active', 'on-hold', 'completed'] },
    { key: 'priority', label: 'Prioriteet', editable: true, type: 'select', options: ['low', 'medium', 'high'] },
    { key: 'assignments', label: 'Ülesanded', editable: false, type: 'count' }
  ];

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editingCell]);

  // Get cell value
  const getCellValue = (project: Project, colKey: string): any => {
    if (colKey === 'assignments') {
      return assignments.filter(a => a.projectId === project.id).length;
    }
    return (project as any)[colKey] || '';
  };

  // Set cell value
  const setCellValue = (rowIndex: number, colKey: string, value: any) => {
    setProjects(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [colKey]: value };
      return updated;
    });
  };

  // Handle double-click to edit
  const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
    const col = columns[colIndex];
    if (col.editable) {
      setEditingCell({ rowIndex, colIndex });
    }
  };

  // Handle cell click for selection
  const handleCellClick = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    setSelectedCell({ rowIndex, colIndex });

    if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(rowIndex)) {
          next.delete(rowIndex);
        } else {
          next.add(rowIndex);
        }
        return next;
      });
    } else if (e.shiftKey && selectedCell) {
      const start = Math.min(selectedCell.rowIndex, rowIndex);
      const end = Math.max(selectedCell.rowIndex, rowIndex);
      const range = new Set<number>();
      for (let i = start; i <= end; i++) {
        range.add(i);
      }
      setSelectedRows(range);
    } else {
      setSelectedRows(new Set([rowIndex]));
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editingCell) return;
    const col = columns[editingCell.colIndex];
    setCellValue(editingCell.rowIndex, col.key, e.target.value);
  };

  // Handle input blur
  const handleInputBlur = () => {
    setEditingCell(null);
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (editingCell) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setEditingCell(null);
        e.preventDefault();
      }
      return;
    }

    if (!selectedCell) return;

    const { rowIndex, colIndex } = selectedCell;

    // Arrow navigation
    if (e.key === 'ArrowUp' && rowIndex > 0) {
      setSelectedCell({ rowIndex: rowIndex - 1, colIndex });
      setSelectedRows(new Set([rowIndex - 1]));
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && rowIndex < projects.length - 1) {
      setSelectedCell({ rowIndex: rowIndex + 1, colIndex });
      setSelectedRows(new Set([rowIndex + 1]));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && colIndex > 0) {
      setSelectedCell({ rowIndex, colIndex: colIndex - 1 });
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && colIndex < columns.length - 1) {
      setSelectedCell({ rowIndex, colIndex: colIndex + 1 });
      e.preventDefault();
    }
    // Enter to edit
    else if (e.key === 'Enter' && columns[colIndex].editable) {
      setEditingCell({ rowIndex, colIndex });
      e.preventDefault();
    }
    // Delete selected rows
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedRows.size > 0) {
        setProjects(prev => prev.filter((_, i) => !selectedRows.has(i)));
        setSelectedRows(new Set());
        setSelectedCell(null);
        e.preventDefault();
      }
    }
    // Copy
    else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (selectedRows.size === 1) {
        const rowIndex = Array.from(selectedRows)[0];
        setCopiedData(projects[rowIndex]);
      }
      e.preventDefault();
    }
    // Paste
    else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (copiedData && selectedCell) {
        const newProject: Project = {
          ...copiedData,
          id: `p${Date.now()}`,
          name: copiedData.name + ' (copy)'
        };
        setProjects(prev => [...prev, newProject]);
      }
      e.preventDefault();
    }
    // Duplicate (Ctrl+D)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      if (selectedRows.size > 0) {
        const toDuplicate = Array.from(selectedRows).map(i => projects[i]);
        const duplicated = toDuplicate.map(p => ({
          ...p,
          id: `p${Date.now()}_${Math.random()}`,
          name: p.name + ' (copy)'
        }));
        setProjects(prev => [...prev, ...duplicated]);
      }
      e.preventDefault();
    }
    // Select all (Ctrl+A)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      setSelectedRows(new Set(projects.map((_, i) => i)));
      e.preventDefault();
    }
  }, [selectedCell, editingCell, projects, columns, selectedRows, copiedData, setProjects]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, rowIndex: number) => {
    setDraggedRow(rowIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    if (draggedRow === null || draggedRow === rowIndex) return;

    // Reorder
    setProjects(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(draggedRow, 1);
      updated.splice(rowIndex, 0, removed);
      return updated;
    });
    setDraggedRow(rowIndex);
  };

  const handleDragEnd = () => {
    setDraggedRow(null);
  };

  // Add new project
  const handleAddRow = () => {
    const newProject: Project = {
      id: `p${Date.now()}`,
      name: 'Uus projekt',
      color: '#10b981',
      status: 'active',
      priority: 'medium'
    };
    setProjects(prev => [...prev, newProject]);
  };

  // Delete selected rows
  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    setProjects(prev => prev.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
    setSelectedCell(null);
  };

  const statusLabels: Record<string, string> = {
    'active': 'Aktiivne',
    'on-hold': 'Ootel',
    'completed': 'Valmis'
  };

  const priorityLabels: Record<string, string> = {
    'low': 'Madal',
    'medium': 'Keskmine',
    'high': 'Kõrge'
  };

  return (
    <div className="p-4 bg-neutral-900 min-h-screen text-white">
      <div className="mb-4 flex gap-2 items-center">
        <h1 className="text-2xl font-bold">Projektid</h1>
        <button
          onClick={handleAddRow}
          className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
        >
          + Lisa projekt
        </button>
        {selectedRows.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
          >
            Kustuta valitud ({selectedRows.size})
          </button>
        )}
      </div>

      <div className="text-sm text-neutral-400 mb-2">
        Nõuanded: Topelt-klikk muutmiseks • Nooled liikumiseks • Ctrl+C/V kopeerimine • Ctrl+D dubleerimine • Delete kustutamine • Lohista ridu ümber
      </div>

      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <table ref={tableRef} className="w-full border-collapse bg-neutral-800">
          <thead className="sticky top-0 bg-neutral-700 z-10">
            <tr>
              <th className="border border-neutral-600 p-2 text-left w-8">#</th>
              {columns.map((col, i) => (
                <th key={i} className="border border-neutral-600 p-2 text-left">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project, rowIndex) => (
              <tr
                key={project.id}
                draggable
                onDragStart={(e) => handleDragStart(e, rowIndex)}
                onDragOver={(e) => handleDragOver(e, rowIndex)}
                onDragEnd={handleDragEnd}
                className={`
                  ${selectedRows.has(rowIndex) ? 'bg-green-900/50' : 'hover:bg-neutral-700/50'}
                  ${draggedRow === rowIndex ? 'opacity-50' : ''}
                  cursor-pointer transition-colors
                `}
              >
                <td className="border border-neutral-600 p-2 text-center text-neutral-400 cursor-move">
                  ⠿
                </td>
                {columns.map((col, colIndex) => {
                  const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
                  const isSelected = selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex;
                  const value = getCellValue(project, col.key);

                  return (
                    <td
                      key={colIndex}
                      className={`
                        border border-neutral-600 p-2
                        ${isSelected ? 'ring-2 ring-green-500 ring-inset' : ''}
                        ${!col.editable ? 'bg-neutral-700/30' : ''}
                      `}
                      onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                      onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                    >
                      {isEditing ? (
                        col.type === 'color' ? (
                          <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            type="color"
                            value={value}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            className="w-full h-8 bg-transparent border-none cursor-pointer"
                          />
                        ) : col.type === 'select' ? (
                          <select
                            ref={inputRef as React.RefObject<HTMLSelectElement>}
                            value={value}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            className="w-full bg-neutral-700 px-2 py-1 outline-none rounded"
                          >
                            <option value="">-</option>
                            {col.options?.map(opt => (
                              <option key={opt} value={opt}>
                                {col.key === 'status' ? statusLabels[opt] : priorityLabels[opt]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            type="text"
                            value={value}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            className="w-full bg-neutral-700 px-2 py-1 outline-none rounded"
                          />
                        )
                      ) : col.type === 'color' ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border border-neutral-600"
                            style={{ backgroundColor: value }}
                          />
                          <span className="text-sm text-neutral-400">{value}</span>
                        </div>
                      ) : col.type === 'select' ? (
                        <span className={`
                          px-2 py-1 rounded text-xs
                          ${col.key === 'status' && value === 'active' ? 'bg-green-900/50 text-green-300' : ''}
                          ${col.key === 'status' && value === 'on-hold' ? 'bg-yellow-900/50 text-yellow-300' : ''}
                          ${col.key === 'status' && value === 'completed' ? 'bg-blue-900/50 text-blue-300' : ''}
                          ${col.key === 'priority' && value === 'low' ? 'bg-neutral-700 text-neutral-300' : ''}
                          ${col.key === 'priority' && value === 'medium' ? 'bg-yellow-900/50 text-yellow-300' : ''}
                          ${col.key === 'priority' && value === 'high' ? 'bg-red-900/50 text-red-300' : ''}
                        `}>
                          {col.key === 'status' ? statusLabels[value] || '-' : priorityLabels[value] || '-'}
                        </span>
                      ) : col.type === 'count' ? (
                        <span className="text-neutral-400">{value}</span>
                      ) : (
                        <span>{value || '-'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
