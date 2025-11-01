import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDataContext } from '../App';
import ContextMenu from './ContextMenu';
import Toolbar from './Toolbar';
import { addDays, daysBetween, getMonthLabelEt, getIsoWeek, getWeekdayEtShort, sameMonthYear, sameIsoWeek, toISODate } from '../utils/dateUtils';
import { Assignment } from '../types';

export default function Planner() {
  const { assignments, setAssignments, resources, projects, viewMode, setViewMode } = useDataContext();
  const [timelineStart, setTimelineStart] = useState("2025-10-31");
  const [timelineDays, setTimelineDays] = useState(90);
  const [dayWidth, setDayWidth] = useState(96);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, id: string} | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);

  // Generate days array
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < timelineDays; i++) {
      arr.push(addDays(timelineStart, i));
    }
    return arr;
  }, [timelineStart, timelineDays]);

  // Month blocks for header
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

  // Week blocks for header
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

  // Rows data
  const rowItems = useMemo(() => {
    if (viewMode === 'resources') {
      return resources.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        assigns: assignments.filter(a => a.resourceId === r.id)
      }));
    } else {
      return projects.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        assigns: assignments.filter(a => a.projectId === p.id)
      }));
    }
  }, [viewMode, resources, projects, assignments]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const el = timelineRef.current;
      if (!el) return;
      const scrollLeft = el.scrollLeft;
      const clientWidth = el.clientWidth;
      const scrollWidth = el.scrollWidth;

      if (scrollLeft < 1000) {
        const newStart = addDays(timelineStart, -30);
        setTimelineStart(newStart);
        setTimelineDays(d => d + 30);
        setTimeout(() => {
          if (el) el.scrollLeft += 30 * dayWidth;
        }, 0);
      }
      if (scrollWidth - scrollLeft - clientWidth < 1000) {
        setTimelineDays(d => d + 30);
      }
    };
    timelineRef.current?.addEventListener('scroll', handleScroll);
    return () => timelineRef.current?.removeEventListener('scroll', handleScroll);
  }, [timelineStart, dayWidth]);

  // Hotkeys
  useHotkeys('delete', () => {
    if (selectedAssignment) {
      setAssignments(prev => prev.filter(a => a.id !== selectedAssignment));
      setSelectedAssignment(null);
    }
  }, { preventDefault: true });

  useHotkeys('escape', () => {
    setContextMenu(null);
    setSelectedAssignment(null);
  }, { preventDefault: true });

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  }, []);

  const closeMenu = () => setContextMenu(null);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, assign: Assignment, mode: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      id: assign.id,
      mode,
      startX: e.clientX,
      origStart: assign.start,
      origEnd: assign.end
    });
    setSelectedAssignment(assign.id);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;
    const deltaX = e.clientX - dragState.startX;
    const deltaDays = Math.round(deltaX / dayWidth);

    const assign = assignments.find(a => a.id === dragState.id);
    if (!assign) return;

    let newStart = dragState.origStart;
    let newEnd = dragState.origEnd;

    if (dragState.mode === 'move') {
      newStart = addDays(dragState.origStart, deltaDays);
      newEnd = addDays(dragState.origEnd, deltaDays);
    } else if (dragState.mode === 'resize-left') {
      newStart = addDays(dragState.origStart, deltaDays);
      if (daysBetween(newStart, newEnd) < 0) newStart = newEnd;
    } else if (dragState.mode === 'resize-right') {
      newEnd = addDays(dragState.origEnd, deltaDays);
      if (daysBetween(newStart, newEnd) < 0) newEnd = newStart;
    }

    setAssignments(prev => prev.map(a =>
      a.id === dragState.id ? { ...a, start: newStart, end: newEnd } : a
    ));
  }, [dragState, dayWidth, assignments, setAssignments]);

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

  // Today marker
  const todayOffset = useMemo(() => {
    const today = toISODate(new Date());
    return daysBetween(timelineStart, today) * dayWidth;
  }, [timelineStart, dayWidth]);

  return (
    <div className="w-full h-screen bg-neutral-900 flex flex-col overflow-hidden">
      <Toolbar viewMode={viewMode} onViewChange={setViewMode} dayWidth={dayWidth} onDayWidthChange={setDayWidth} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar with names */}
        <div className="w-48 bg-neutral-950 border-r border-neutral-700 flex-shrink-0 overflow-y-auto">
          <div className="h-20 border-b border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-400">
            {viewMode === 'resources' ? 'RESSURSID' : 'PROJEKTID'}
          </div>
          {rowItems.map(row => (
            <div key={row.id} className="h-12 border-b border-neutral-800 flex items-center px-3 text-sm">
              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: row.color }} />
              {row.name}
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div ref={timelineRef} className="flex-1 overflow-auto relative">
          <div style={{ width: days.length * dayWidth, minHeight: '100%' }}>
            {/* Month header */}
            <div className="h-8 bg-neutral-950 border-b border-neutral-700 flex text-[10px] font-bold text-neutral-300">
              {monthBlocks.map((block, i) => (
                <div key={i} className="border-r border-neutral-700 flex items-center justify-center" style={{ width: block.count * dayWidth }}>
                  {block.label}
                </div>
              ))}
            </div>

            {/* Week header */}
            <div className="h-6 bg-neutral-900 border-b border-neutral-700 flex text-[9px] text-neutral-400">
              {weekBlocks.map((block, i) => (
                <div key={i} className="border-r border-neutral-800 flex items-center justify-center" style={{ width: block.count * dayWidth }}>
                  {block.label}
                </div>
              ))}
            </div>

            {/* Day header */}
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
              {/* Vertical grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
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

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset <= days.length * dayWidth && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
                  style={{ left: todayOffset }}
                />
              )}

              {/* Rows with assignments */}
              {rowItems.map((row, rowIdx) => (
                <div key={row.id} className="h-12 border-b border-neutral-800 relative">
                  {row.assigns.map(assign => {
                    const pos = getBarPosition(assign.start, assign.end);
                    const isSelected = selectedAssignment === assign.id;
                    return (
                      <div
                        key={assign.id}
                        className={`absolute h-8 top-2 rounded cursor-move transition-all ${isSelected ? 'ring-2 ring-blue-400 z-10' : 'z-0'}`}
                        style={{
                          left: pos.left,
                          width: pos.width,
                          backgroundColor: row.color,
                          opacity: 0.85
                        }}
                        onMouseDown={(e) => handleMouseDown(e, assign, 'move')}
                        onContextMenu={(e) => handleContextMenu(e, assign.id)}
                        onClick={() => setSelectedAssignment(assign.id)}
                      >
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
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onEdit={() => {
              console.log('Muuda', contextMenu.id);
              closeMenu();
            }}
            onDelete={() => {
              setAssignments(prev => prev.filter(a => a.id !== contextMenu.id));
              closeMenu();
            }}
            onClose={closeMenu}
          />
        </>
      )}
    </div>
  );
}
