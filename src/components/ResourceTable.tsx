import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDataContext } from '../App';
import { Resource } from '../types';

interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export default function ResourceTable() {
  const { resources, setResources, assignments } = useDataContext();
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [copiedData, setCopiedData] = useState<Resource | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Column definitions
  const columns = [
    { key: 'name', label: 'Nimi', editable: true, type: 'text' },
    { key: 'department', label: 'Osakond', editable: true, type: 'text' },
    { key: 'color', label: 'Värv', editable: true, type: 'color' },
    { key: 'availability', label: 'Kättesaadavus %', editable: true, type: 'number' },
    { key: 'skills', label: 'Oskused', editable: true, type: 'tags' },
    { key: 'assignments', label: 'Ülesanded', editable: false, type: 'count' }
  ];

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Get cell value
  const getCellValue = (resource: Resource, colKey: string): any => {
    if (colKey === 'assignments') {
      return assignments.filter(a => a.resourceId === resource.id).length;
    }
    if (colKey === 'skills') {
      return resource.skills?.join(', ') || '';
    }
    return (resource as any)[colKey] || '';
  };

  // Set cell value
  const setCellValue = (rowIndex: number, colKey: string, value: any) => {
    setResources(prev => {
      const updated = [...prev];
      if (colKey === 'skills') {
        updated[rowIndex] = {
          ...updated[rowIndex],
          skills: value.split(',').map((s: string) => s.trim()).filter(Boolean)
        };
      } else if (colKey === 'availability') {
        updated[rowIndex] = {
          ...updated[rowIndex],
          availability: Math.min(100, Math.max(0, parseInt(value) || 0))
        };
      } else {
        updated[rowIndex] = { ...updated[rowIndex], [colKey]: value };
      }
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } else if (e.key === 'ArrowDown' && rowIndex < resources.length - 1) {
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
        setResources(prev => prev.filter((_, i) => !selectedRows.has(i)));
        setSelectedRows(new Set());
        setSelectedCell(null);
        e.preventDefault();
      }
    }
    // Copy
    else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (selectedRows.size === 1) {
        const rowIndex = Array.from(selectedRows)[0];
        setCopiedData(resources[rowIndex]);
      }
      e.preventDefault();
    }
    // Paste
    else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (copiedData && selectedCell) {
        const newResource: Resource = {
          ...copiedData,
          id: `r${Date.now()}`,
          name: copiedData.name + ' (copy)'
        };
        setResources(prev => [...prev, newResource]);
      }
      e.preventDefault();
    }
    // Duplicate (Ctrl+D)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      if (selectedRows.size > 0) {
        const toDuplicate = Array.from(selectedRows).map(i => resources[i]);
        const duplicated = toDuplicate.map(r => ({
          ...r,
          id: `r${Date.now()}_${Math.random()}`,
          name: r.name + ' (copy)'
        }));
        setResources(prev => [...prev, ...duplicated]);
      }
      e.preventDefault();
    }
    // Select all (Ctrl+A)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      setSelectedRows(new Set(resources.map((_, i) => i)));
      e.preventDefault();
    }
  }, [selectedCell, editingCell, resources, columns, selectedRows, copiedData, setResources]);

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
    setResources(prev => {
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

  // Add new resource
  const handleAddRow = () => {
    const newResource: Resource = {
      id: `r${Date.now()}`,
      name: 'Uus ressurss',
      color: '#3b82f6',
      department: '',
      skills: [],
      availability: 100
    };
    setResources(prev => [...prev, newResource]);
  };

  // Delete selected rows
  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    setResources(prev => prev.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
    setSelectedCell(null);
  };

  return (
    <div className="p-4 bg-neutral-900 min-h-screen text-white">
      <div className="mb-4 flex gap-2 items-center">
        <h1 className="text-2xl font-bold">Ressursid</h1>
        <button
          onClick={handleAddRow}
          className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          + Lisa ressurss
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
            {resources.map((resource, rowIndex) => (
              <tr
                key={resource.id}
                draggable
                onDragStart={(e) => handleDragStart(e, rowIndex)}
                onDragOver={(e) => handleDragOver(e, rowIndex)}
                onDragEnd={handleDragEnd}
                className={`
                  ${selectedRows.has(rowIndex) ? 'bg-blue-900/50' : 'hover:bg-neutral-700/50'}
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
                  const value = getCellValue(resource, col.key);

                  return (
                    <td
                      key={colIndex}
                      className={`
                        border border-neutral-600 p-2
                        ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                        ${!col.editable ? 'bg-neutral-700/30' : ''}
                      `}
                      onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                      onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                    >
                      {isEditing ? (
                        col.type === 'color' ? (
                          <input
                            ref={inputRef}
                            type="color"
                            value={value}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            className="w-full h-8 bg-transparent border-none cursor-pointer"
                          />
                        ) : (
                          <input
                            ref={inputRef}
                            type={col.type === 'number' ? 'number' : 'text'}
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
