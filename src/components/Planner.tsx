import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDataContext } from '../App';
import ContextMenu from './ContextMenu';
import Toolbar from './Toolbar';
import { addDays, daysBetween, getMonthLabelEt, getIsoWeek, getWeekdayEtShort, sameMonthYear, toISODate } from '../utils/dateUtils';
import { Assignment, Dependency } from '../types';

type TimescaleType = 'hours' | 'days' | 'weeks' | 'months';

export default function Planner() {
  const { assignments, setAssignments, resources, projects, viewMode, setViewMode } = useDataContext();
  const [timelineStart, setTimelineStart] = useState("2025-10-31");
  const [timelineDays, setTimelineDays] = useState(90);
  const [dayWidth, setDayWidth] = useState(96);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, ids: string[]} | null>(null);
  const [showBaselines, setShowBaselines] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showUtilization, setShowUtilization] = useState(true);
  const [timescale, setTimescale] = useState<TimescaleType>('days');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const [dragState, setDragState] = useState<{
    ids: string[];
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origPositions: Map<string, { start: string; end: string }>;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(80); // Adjustable row height
  const [showAssignDialog, setShowAssignDialog] = useState<{ rowId: string; rowType: 'resource' | 'project' } | null>(null);

  // Generate days array
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < timelineDays; i++) {
      arr.push(addDays(timelineStart, i));
    }
    return arr;
  }, [timelineStart, timelineDays]);

  // Note: Critical path and dependency arrows removed as per requirements

  // Calculate resource utilization
  const resourceUtilization = useMemo(() => {
    const util = new Map<string, number>();

    resources.forEach(resource => {
      const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
      let totalDays = 0;

      resourceAssignments.forEach(assign => {
        totalDays += daysBetween(assign.start, assign.end) + 1;
      });

      // Calculate utilization % (assuming 30 days window)
      const utilizationPercent = Math.round((totalDays / 30) * 100);
      util.set(resource.id, utilizationPercent);
    });

    return util;
  }, [assignments, resources]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(assign => {
      // Search query
      if (searchQuery && !assign.note?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(assign.status || 'not-started')) {
        return false;
      }

      // Priority filter
      if (priorityFilter.length > 0 && !priorityFilter.includes(assign.priority || 'medium')) {
        return false;
      }

      return true;
    });
  }, [assignments, searchQuery, statusFilter, priorityFilter]);

  // Build row items - ONE row per resource/project, all tasks on same row
  const rowItems = useMemo(() => {
    if (viewMode === 'resources') {
      return resources.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        type: 'resource' as const,
        assigns: filteredAssignments.filter(a => a.resourceId === r.id)
      }));
    } else {
      return projects.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        type: 'project' as const,
        assigns: filteredAssignments.filter(a => a.projectId === p.id)
      }));
    }
  }, [viewMode, resources, projects, filteredAssignments]);

  // Month/week blocks
  const monthBlocks = useMemo(() => {
    const blocks: { label: string; count: number }[] = [];
    let current = days[0];
    let count = 0;
    for (const d of days) {
      if (sameMonthYear(current, d)) {
        count++;
      } else {
        blocks.push({ label: getMonthLabelEt(current), count });
        current = d;
        count = 1;
      }
    }
    if (count > 0) blocks.push({ label: getMonthLabelEt(current), count });
    return blocks;
  }, [days]);

  const weekBlocks = useMemo(() => {
    const blocks: { label: string; count: number }[] = [];
    let currentWeek = getIsoWeek(days[0]);
    let count = 0;
    for (const d of days) {
      const w = getIsoWeek(d);
      if (w === currentWeek) {
        count++;
      } else {
        blocks.push({ label: `N${currentWeek}`, count });
        currentWeek = w;
        count = 1;
      }
    }
    if (count > 0) blocks.push({ label: `N${currentWeek}`, count });
    return blocks;
  }, [days]);

  // Infinite timeline scrolling - extends infinitely to past and future
  useEffect(() => {
    const handleScroll = () => {
      const el = timelineRef.current;
      if (!el) return;
      const scrollLeft = el.scrollLeft;
      const clientWidth = el.clientWidth;
      const scrollWidth = el.scrollWidth;

      // Extend timeline to the past (left) when scrolling backwards
      if (scrollLeft < 3000) {
        const daysToAdd = 180; // Add 6 months at a time
        const newStart = addDays(timelineStart, -daysToAdd);
        setTimelineStart(newStart);
        setTimelineDays(d => d + daysToAdd);
        setTimeout(() => {
          if (el) el.scrollLeft += daysToAdd * dayWidth;
        }, 0);
      }

      // Extend timeline to the future (right) when scrolling forwards
      if (scrollWidth - scrollLeft - clientWidth < 3000) {
        setTimelineDays(d => d + 180); // Add 6 months to the future
      }
    };

    timelineRef.current?.addEventListener('scroll', handleScroll);
    return () => timelineRef.current?.removeEventListener('scroll', handleScroll);
  }, [timelineStart, dayWidth]);

  // Keyboard shortcuts
  useHotkeys('delete, backspace', () => {
    if (selectedAssignments.size > 0) {
      setAssignments(prev => prev.filter(a => !selectedAssignments.has(a.id)));
      setSelectedAssignments(new Set());
    }
  }, { preventDefault: true });

  useHotkeys('escape', () => {
    setContextMenu(null);
    setSelectedAssignments(new Set());
  }, { preventDefault: true });

  useHotkeys('ctrl+a, meta+a', () => {
    setSelectedAssignments(new Set(filteredAssignments.map(a => a.id)));
  }, { preventDefault: true });

  useHotkeys('ctrl+d, meta+d', () => {
    // Duplicate selected
    if (selectedAssignments.size > 0) {
      const toDuplicate = assignments.filter(a => selectedAssignments.has(a.id));
      const duplicated = toDuplicate.map(a => ({
        ...a,
        id: `a${Date.now()}_${Math.random()}`,
        start: addDays(a.start, 7),
        end: addDays(a.end, 7)
      }));
      setAssignments(prev => [...prev, ...duplicated]);
    }
  }, { preventDefault: true });

  useHotkeys('ctrl+z, meta+z', () => {
    console.log('Undo (not implemented yet)');
  }, { preventDefault: true });

  useHotkeys('ctrl+y, meta+y', () => {
    console.log('Redo (not implemented yet)');
  }, { preventDefault: true });

  useHotkeys('b', () => setShowBaselines(!showBaselines));
  useHotkeys('u', () => setShowUtilization(!showUtilization));

  useHotkeys('1', () => setTimescale('hours'));
  useHotkeys('2', () => setTimescale('days'));
  useHotkeys('3', () => setTimescale('weeks'));
  useHotkeys('4', () => setTimescale('months'));

  useHotkeys('/', () => {
    document.getElementById('search-input')?.focus();
  }, { preventDefault: true });

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    let ids: string[];
    if (selectedAssignments.has(id)) {
      ids = Array.from(selectedAssignments);
    } else {
      ids = [id];
      setSelectedAssignments(new Set([id]));
    }

    setContextMenu({ x: e.clientX, y: e.clientY, ids });
  }, [selectedAssignments]);

  const closeMenu = () => setContextMenu(null);

  // Click handlers
  const handleTaskClick = (e: React.MouseEvent, assignId: string) => {
    if (e.ctrlKey || e.metaKey) {
      // Add to selection
      setSelectedAssignments(prev => {
        const next = new Set(prev);
        if (next.has(assignId)) {
          next.delete(assignId);
        } else {
          next.add(assignId);
        }
        return next;
      });
    } else if (e.shiftKey && selectedAssignments.size > 0) {
      // Range selection
      const allIds = filteredAssignments.map(a => a.id);
      const lastSelected = Array.from(selectedAssignments)[selectedAssignments.size - 1];
      const lastIdx = allIds.indexOf(lastSelected);
      const currentIdx = allIds.indexOf(assignId);

      const start = Math.min(lastIdx, currentIdx);
      const end = Math.max(lastIdx, currentIdx);
      const range = allIds.slice(start, end + 1);

      setSelectedAssignments(new Set([...Array.from(selectedAssignments), ...range]));
    } else {
      setSelectedAssignments(new Set([assignId]));
    }
  };

  const handleTaskDoubleClick = (assignId: string) => {
    // Open edit modal (placeholder)
    console.log('Edit task:', assignId);
    alert(`Edit task: ${assignments.find(a => a.id === assignId)?.note}`);
  };

  const handleRowDoubleClick = (rowId: string, rowType: 'resource' | 'project') => {
    setShowAssignDialog({ rowId, rowType });
  };

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, assign: Assignment, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();

    const ids = selectedAssignments.has(assign.id)
      ? Array.from(selectedAssignments)
      : [assign.id];

    if (!selectedAssignments.has(assign.id)) {
      setSelectedAssignments(new Set([assign.id]));
    }

    const origPositions = new Map<string, { start: string; end: string }>();
    ids.forEach(id => {
      const a = assignments.find(a => a.id === id);
      if (a) {
        origPositions.set(id, { start: a.start, end: a.end });
      }
    });

    setDragState({
      ids,
      mode,
      startX: e.clientX,
      origPositions
    });
  }, [selectedAssignments, assignments]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaDays = Math.round(deltaX / dayWidth);

    setAssignments(prev => prev.map(a => {
      if (!dragState.ids.includes(a.id)) return a;

      const orig = dragState.origPositions.get(a.id);
      if (!orig) return a;

      let newStart = orig.start;
      let newEnd = orig.end;

      if (dragState.mode === 'move') {
        newStart = addDays(orig.start, deltaDays);
        newEnd = addDays(orig.end, deltaDays);
      } else if (dragState.mode === 'resize-left') {
        newStart = addDays(orig.start, deltaDays);
        if (daysBetween(newStart, newEnd) < 0) newStart = newEnd;
      } else if (dragState.mode === 'resize-right') {
        newEnd = addDays(orig.end, deltaDays);
        if (daysBetween(newStart, newEnd) < 0) newEnd = newStart;
      }

      return { ...a, start: newStart, end: newEnd };
    }));
  }, [dragState, dayWidth, setAssignments]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Position calculator
  const getBarPosition = (start: string, end: string) => {
    const startOffset = daysBetween(timelineStart, start);
    const duration = daysBetween(start, end) + 1;
    return {
      left: startOffset * dayWidth,
      width: duration * dayWidth
    };
  };

  // Note: Dependency arrows removed as per requirements

  // Today marker
  const todayOffset = useMemo(() => {
    const today = toISODate(new Date());
    return daysBetween(timelineStart, today) * dayWidth;
  }, [timelineStart, dayWidth]);

  // Status color
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in-progress': return '#3b82f6';
      case 'blocked': return '#ef4444';
      case 'on-hold': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Export functions
  const exportToPNG = async () => {
    const { default: html2canvas } = await import('html2canvas');
    const element = timelineRef.current;
    if (!element) return;

    const canvas = await html2canvas(element);
    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gantt-${Date.now()}.png`;
        a.click();
      }
    });
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Task', 'Resource', 'Project', 'Start', 'End', 'Progress', 'Status', 'Priority'];
    const rows = assignments.map(a => [
      a.id,
      a.note || '',
      resources.find(r => r.id === a.resourceId)?.name || '',
      projects.find(p => p.id === a.projectId)?.name || '',
      a.start,
      a.end,
      a.progress || 0,
      a.status || '',
      a.priority || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantt-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="w-full h-screen bg-neutral-900 flex flex-col overflow-hidden">
      {/* Top toolbar */}
      <div className="bg-neutral-950 border-b border-neutral-700 p-2 flex items-center gap-4 text-xs">
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded ${viewMode === 'resources' ? 'bg-blue-600' : 'bg-neutral-800'}`}
            onClick={() => setViewMode('resources')}
          >
            Ressursid
          </button>
          <button
            className={`px-3 py-1 rounded ${viewMode === 'projects' ? 'bg-blue-600' : 'bg-neutral-800'}`}
            onClick={() => setViewMode('projects')}
          >
            Projektid
          </button>
        </div>

        <div className="border-l border-neutral-700 pl-4 flex gap-2">
          <button
            className={`px-2 py-1 rounded ${showBaselines ? 'bg-green-700' : 'bg-neutral-800'}`}
            onClick={() => setShowBaselines(!showBaselines)}
            title="Toggle Baselines (B)"
          >
            Baseline
          </button>
          <button
            className={`px-2 py-1 rounded ${showUtilization ? 'bg-purple-700' : 'bg-neutral-800'}`}
            onClick={() => setShowUtilization(!showUtilization)}
            title="Toggle Utilization (U)"
          >
            Utilization
          </button>
        </div>

        <div className="border-l border-neutral-700 pl-4 flex gap-1">
          {(['hours', 'days', 'weeks', 'months'] as TimescaleType[]).map((scale, idx) => (
            <button
              key={scale}
              className={`px-2 py-1 rounded text-[10px] ${timescale === scale ? 'bg-blue-600' : 'bg-neutral-800'}`}
              onClick={() => setTimescale(scale)}
              title={`Switch to ${scale} (${idx + 1})`}
            >
              {scale[0].toUpperCase()}
            </button>
          ))}
        </div>

        <div className="border-l border-neutral-700 pl-4 flex gap-1">
          <button
            className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
            onClick={() => setDayWidth(Math.max(24, dayWidth - 8))}
            title="Zoom out timeline"
          >
            -
          </button>
          <span className="px-2">{dayWidth}px</span>
          <button
            className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
            onClick={() => setDayWidth(Math.min(200, dayWidth + 8))}
            title="Zoom in timeline"
          >
            +
          </button>
        </div>

        <div className="border-l border-neutral-700 pl-4 flex gap-1">
          <button
            className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
            onClick={() => setRowHeight(Math.max(40, rowHeight - 10))}
            title="Decrease row height"
          >
            ↕-
          </button>
          <span className="px-2">{rowHeight}px</span>
          <button
            className="px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
            onClick={() => setRowHeight(Math.min(150, rowHeight + 10))}
            title="Increase row height"
          >
            ↕+
          </button>
        </div>

        <div className="border-l border-neutral-700 pl-4 flex-1">
          <input
            id="search-input"
            type="text"
            placeholder="Otsi... (vajuta /)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-64 px-2 py-1 bg-neutral-800 rounded border border-neutral-700 text-xs"
          />
        </div>

        <div className="border-l border-neutral-700 pl-4 flex gap-2">
          <button
            onClick={exportToPNG}
            className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700"
          >
            PNG
          </button>
          <button
            onClick={exportToCSV}
            className="px-3 py-1 bg-green-600 rounded hover:bg-green-700"
          >
            CSV
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 bg-neutral-950 border-r border-neutral-700 flex-shrink-0 overflow-y-auto">
          <div className="h-20 border-b border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-400">
            {viewMode === 'resources' ? 'RESSURSID' : 'PROJEKTID'}
          </div>
          {rowItems.map(row => (
            <div
              key={row.id}
              className="border-b border-neutral-800 flex items-center px-3 text-sm"
              style={{ height: rowHeight }}
            >
              <div className="flex-1">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: row.color }} />
                  <span className="font-medium">{row.name}</span>
                </div>
                {showUtilization && viewMode === 'resources' && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400">
                    <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${(resourceUtilization.get(row.id) || 0) > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min((resourceUtilization.get(row.id) || 0), 150)}%` }}
                      />
                    </div>
                    <span>{resourceUtilization.get(row.id) || 0}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div ref={timelineRef} className="flex-1 overflow-auto relative">
          <div style={{ width: days.length * dayWidth, minHeight: '100%' }}>
            {/* Headers */}
            <div className="h-8 bg-neutral-950 border-b border-neutral-700 flex text-[10px] font-bold text-neutral-300">
              {monthBlocks.map((block, i) => (
                <div key={i} className="border-r border-neutral-700 flex items-center justify-center" style={{ width: block.count * dayWidth }}>
                  {block.label}
                </div>
              ))}
            </div>

            <div className="h-6 bg-neutral-900 border-b border-neutral-700 flex text-[9px] text-neutral-400">
              {weekBlocks.map((block, i) => (
                <div key={i} className="border-r border-neutral-800 flex items-center justify-center" style={{ width: block.count * dayWidth }}>
                  {block.label}
                </div>
              ))}
            </div>

            <div className="h-6 bg-neutral-900 border-b border-neutral-700 flex text-[9px] text-neutral-500">
              {days.map((day, i) => {
                const dayNum = new Date(day + "T00:00:00").getDate();
                const weekday = getWeekdayEtShort(day);
                const isWeekend = weekday === 'L' || weekday === 'P';
                return (
                  <div
                    key={i}
                    className={`border-r border-neutral-800 flex flex-col items-center justify-center ${isWeekend ? 'bg-neutral-800' : ''}`}
                    style={{ width: dayWidth }}
                  >
                    <div className={isWeekend ? 'text-red-400' : ''}>{weekday}</div>
                    <div>{dayNum}</div>
                  </div>
                );
              })}
            </div>

            {/* Grid and rows */}
            <div className="relative">
              <div className="absolute inset-0 flex pointer-events-none" style={{ zIndex: 1 }}>
                {days.map((day, i) => {
                  const weekday = getWeekdayEtShort(day);
                  const isWeekend = weekday === 'L' || weekday === 'P';
                  return (
                    <div
                      key={i}
                      className={`border-r ${isWeekend ? 'bg-neutral-900 border-neutral-800' : 'border-neutral-850'}`}
                      style={{ width: dayWidth }}
                    />
                  );
                })}
              </div>

              {todayOffset >= 0 && todayOffset <= days.length * dayWidth && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                  style={{ left: todayOffset, zIndex: 20 }}
                />
              )}

              {/* Rows - ONE row per resource/project, tasks overlay */}
              {rowItems.map((row, rowIdx) => (
                <div
                  key={row.id}
                  className="border-b border-neutral-800 relative cursor-pointer hover:bg-neutral-800/30"
                  style={{ height: rowHeight, zIndex: 10 }}
                  onDoubleClick={() => handleRowDoubleClick(row.id, row.type)}
                >
                  {/* All assignments on same row */}
                  {row.assigns.map((assign, assignIdx) => {
                    const pos = getBarPosition(assign.start, assign.end);
                    const isSelected = selectedAssignments.has(assign.id);
                    const isHovered = hoveredTask === assign.id;

                    // Vertical offset for overlapping tasks
                    const verticalOffset = (assignIdx % 4) * 18; // Stack up to 4 tasks

                    if (assign.milestone) {
                      return (
                        <div
                          key={assign.id}
                          className={`absolute cursor-pointer ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                          style={{
                            left: pos.left,
                            top: rowHeight / 2 - 10 + verticalOffset,
                            width: 20,
                            height: 20,
                            transform: 'rotate(45deg)',
                            backgroundColor: row.color,
                            zIndex: 15
                          }}
                          onClick={(e) => handleTaskClick(e, assign.id)}
                          onDoubleClick={() => handleTaskDoubleClick(assign.id)}
                          onContextMenu={(e) => handleContextMenu(e, assign.id)}
                          onMouseEnter={() => setHoveredTask(assign.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                        />
                      );
                    }

                    return (
                      <div
                        key={assign.id}
                        className={`absolute h-8 rounded cursor-move transition-all ${isSelected ? 'ring-2 ring-blue-400 z-10' : 'z-0'}`}
                        style={{
                          left: pos.left,
                          top: 10 + verticalOffset,
                          width: pos.width,
                          backgroundColor: row.color,
                          opacity: isHovered ? 1 : 0.85,
                          borderLeft: `3px solid ${getStatusColor(assign.status)}`
                        }}
                        onMouseDown={(e) => handleMouseDown(e, assign, 'move')}
                        onClick={(e) => handleTaskClick(e, assign.id)}
                        onDoubleClick={() => handleTaskDoubleClick(assign.id)}
                        onContextMenu={(e) => handleContextMenu(e, assign.id)}
                        onMouseEnter={() => setHoveredTask(assign.id)}
                        onMouseLeave={() => setHoveredTask(null)}
                      >
                        {/* Baseline shadow */}
                        {showBaselines && assign.baseline && (
                          <div
                            className="absolute top-0 h-full bg-neutral-600 rounded opacity-30"
                            style={{
                              left: daysBetween(assign.start, assign.baseline.start) * dayWidth,
                              width: (daysBetween(assign.baseline.start, assign.baseline.end) + 1) * dayWidth
                            }}
                          />
                        )}

                        {/* Progress */}
                        {assign.progress !== undefined && assign.progress > 0 && (
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-white/20 rounded-l"
                            style={{ width: `${assign.progress}%` }}
                          />
                        )}

                        {/* Resize handles */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, assign, 'resize-left'); }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, assign, 'resize-right'); }}
                        />

                        {/* Label */}
                        <div className="absolute inset-0 flex items-center px-2 text-[10px] text-white font-medium truncate pointer-events-none">
                          {assign.note || 'Ülesanne'}
                        </div>

                        {/* Priority indicator */}
                        {assign.priority === 'critical' && (
                          <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                        {assign.priority === 'high' && (
                          <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full" />
                        )}

                        {/* Hover tooltip */}
                        {isHovered && (
                          <div className="absolute bottom-full left-0 mb-2 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-[10px] whitespace-nowrap z-50">
                            <div>{assign.note}</div>
                            <div className="text-neutral-400">{assign.start} - {assign.end}</div>
                            <div className="text-neutral-400">Progress: {assign.progress || 0}%</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div onClick={closeMenu} className="fixed inset-0 z-40" />
          <div
            className="fixed bg-neutral-800 border border-neutral-600 rounded-md shadow-lg p-1 z-50 text-xs"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => { console.log('Edit', contextMenu.ids); closeMenu(); }}
              className="block w-full text-left px-3 py-2 hover:bg-neutral-700 rounded"
            >
              Muuda ({contextMenu.ids.length})
            </button>
            <button
              onClick={() => {
                const toDuplicate = assignments.filter(a => contextMenu.ids.includes(a.id));
                const duplicated = toDuplicate.map(a => ({
                  ...a,
                  id: `a${Date.now()}_${Math.random()}`,
                  start: addDays(a.start, 7),
                  end: addDays(a.end, 7)
                }));
                setAssignments(prev => [...prev, ...duplicated]);
                closeMenu();
              }}
              className="block w-full text-left px-3 py-2 hover:bg-neutral-700 rounded"
            >
              Dubleeri
            </button>
            <div className="border-t border-neutral-700 my-1" />
            <button
              onClick={() => {
                setAssignments(prev => prev.filter(a => !contextMenu.ids.includes(a.id)));
                closeMenu();
              }}
              className="block w-full text-left px-3 py-2 hover:bg-neutral-700 text-red-400 rounded"
            >
              Kustuta
            </button>
          </div>
        </>
      )}

      {/* Assignment Dialog */}
      {showAssignDialog && (
        <AssignmentDialog
          viewMode={viewMode}
          rowId={showAssignDialog.rowId}
          rowType={showAssignDialog.rowType}
          resources={resources}
          projects={projects}
          onClose={() => setShowAssignDialog(null)}
          onSave={(newAssignment) => {
            setAssignments(prev => [...prev, newAssignment]);
            setShowAssignDialog(null);
          }}
        />
      )}

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 right-4 bg-neutral-950/90 border border-neutral-700 rounded-lg p-3 text-[10px] text-neutral-400 max-w-xs">
        <div className="font-bold text-neutral-200 mb-2">Klaviatuuri otseteed:</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>Delete/Backspace</div><div>Kustuta</div>
          <div>Ctrl+A</div><div>Vali kõik</div>
          <div>Ctrl+D</div><div>Dubleeri</div>
          <div>Ctrl+Z/Y</div><div>Undo/Redo</div>
          <div>B/U</div><div>Toggle views</div>
          <div>1/2/3/4</div><div>Timescale</div>
          <div>/</div><div>Search</div>
          <div>Esc</div><div>Cancel</div>
          <div>Double-click row</div><div>Lisa ülesanne</div>
        </div>
      </div>
    </div>
  );
}

// Assignment Dialog Component
function AssignmentDialog({
  viewMode,
  rowId,
  rowType,
  resources,
  projects,
  onClose,
  onSave
}: {
  viewMode: 'resources' | 'projects';
  rowId: string;
  rowType: 'resource' | 'project';
  resources: any[];
  projects: any[];
  onClose: () => void;
  onSave: (assignment: any) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const today = new Date();
  const [startDate, setStartDate] = useState(toISODate(today));
  const endDateInit = new Date(today);
  endDateInit.setDate(endDateInit.getDate() + 3);
  const [endDate, setEndDate] = useState(toISODate(endDateInit));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newAssignment = {
      id: `a${Date.now()}`,
      resourceId: viewMode === 'resources' ? rowId : selectedId,
      projectId: viewMode === 'projects' ? rowId : selectedId,
      start: startDate,
      end: endDate,
      note: note || 'Uus ülesanne',
      progress: 0,
      status: 'not-started' as const
    };

    onSave(newAssignment);
  };

  const selectOptions = viewMode === 'resources' ? projects : resources;
  const selectLabel = viewMode === 'resources' ? 'Projekt' : 'Ressurss';

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-40" />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-6 z-50 w-96">
        <h2 className="text-xl font-bold text-white mb-4">Lisa uus ülesanne</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1">{selectLabel}</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
              className="w-full bg-neutral-700 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Vali {selectLabel.toLowerCase()}...</option>
              {selectOptions.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Kommentaar / Kirjeldus</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lisa kommentaar või lisainfo..."
              className="w-full bg-neutral-700 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Alguskuupäev</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-neutral-700 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Lõppkuupäev</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-neutral-700 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded"
            >
              Tühista
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            >
              Lisa ülesanne
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
