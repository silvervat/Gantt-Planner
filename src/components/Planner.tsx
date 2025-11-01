import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDataContext } from '../App';
import ContextMenu from './ContextMenu';
import Toolbar from './Toolbar';
import { addDays, daysBetween, getMonthLabelEt, getIsoWeek, getWeekdayEtShort, sameMonthYear, toISODate } from '../utils/dateUtils';
import { Assignment, Dependency } from '../types';

export default function Planner() {
  const { assignments, setAssignments, resources, projects, viewMode, setViewMode } = useDataContext();
  const [timelineStart, setTimelineStart] = useState("2025-10-31");
  const [timelineDays, setTimelineDays] = useState(90);
  const [dayWidth, setDayWidth] = useState(96);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, id: string} | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<{
    id: string;
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Filter and organize assignments with hierarchy
  const rowItems = useMemo(() => {
    const baseItems = viewMode === 'resources'
      ? resources.map(r => ({
          id: r.id,
          name: r.name,
          color: r.color,
          type: 'resource' as const
        }))
      : projects.map(p => ({
          id: p.id,
          name: p.name,
          color: p.color,
          type: 'project' as const
        }));

    return baseItems.map(item => {
      const itemAssignments = assignments.filter(a =>
        viewMode === 'resources' ? a.resourceId === item.id : a.projectId === item.id
      );

      // Build hierarchy: separate parents and children
      const parents = itemAssignments.filter(a => !a.parent);
      const childrenMap = new Map<string, Assignment[]>();

      itemAssignments.forEach(a => {
        if (a.parent) {
          if (!childrenMap.has(a.parent)) childrenMap.set(a.parent, []);
          childrenMap.get(a.parent)!.push(a);
        }
      });

      // Flatten with hierarchy (parent → children)
      const flattened: (Assignment & { level: number; hasChildren: boolean })[] = [];
      parents.forEach(parent => {
        const children = childrenMap.get(parent.id) || [];
        const isCollapsed = collapsedParents.has(parent.id);

        flattened.push({ ...parent, level: 0, hasChildren: children.length > 0 });

        if (!isCollapsed && children.length > 0) {
          children.forEach(child => {
            flattened.push({ ...child, level: 1, hasChildren: false });
          });
        }
      });

      return {
        ...item,
        assigns: flattened
      };
    });
  }, [viewMode, resources, projects, assignments, collapsedParents]);

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

  // Toggle hierarchy collapse
  const toggleCollapse = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

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

  // Get assignment absolute position for dependency arrows
  const getAssignmentCenter = (assignId: string): { x: number; y: number; rowIndex: number } | null => {
    let rowIndex = 0;
    let assignIndex = 0;

    for (const row of rowItems) {
      for (let i = 0; i < row.assigns.length; i++) {
        if (row.assigns[i].id === assignId) {
          const assign = row.assigns[i];
          const pos = getBarPosition(assign.start, assign.end);

          return {
            x: pos.left + pos.width / 2,
            y: (rowIndex + assignIndex) * 48 + 24 + 20, // header height + half row height
            rowIndex: rowIndex + assignIndex
          };
        }
      }
      assignIndex += row.assigns.length;
      rowIndex += row.assigns.length;
    }
    return null;
  };

  // Draw dependency arrows on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.scrollWidth;
      canvas.height = container.scrollHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw arrows for all dependencies
    assignments.forEach(assign => {
      if (!assign.dependencies || assign.dependencies.length === 0) return;

      assign.dependencies.forEach(dep => {
        const fromPos = getAssignmentCenter(dep.from);
        const toPos = getAssignmentCenter(dep.to);

        if (!fromPos || !toPos) return;

        ctx.strokeStyle = '#60a5fa';
        ctx.fillStyle = '#60a5fa';
        ctx.lineWidth = 2;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);

        // Bezier curve for nicer appearance
        const midX = (fromPos.x + toPos.x) / 2;
        ctx.bezierCurveTo(
          midX, fromPos.y,
          midX, toPos.y,
          toPos.x, toPos.y
        );
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(toPos.x - arrowSize * Math.cos(angle - Math.PI / 6), toPos.y - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toPos.x, toPos.y);
        ctx.lineTo(toPos.x - arrowSize * Math.cos(angle + Math.PI / 6), toPos.y - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.fill();
      });
    });
  }, [assignments, rowItems, timelineStart, dayWidth, days]);

  // Today marker
  const todayOffset = useMemo(() => {
    const today = toISODate(new Date());
    return daysBetween(timelineStart, today) * dayWidth;
  }, [timelineStart, dayWidth]);

  // Status color helper
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in-progress': return '#3b82f6';
      case 'blocked': return '#ef4444';
      case 'on-hold': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className="w-full h-screen bg-neutral-900 flex flex-col overflow-hidden">
      <Toolbar viewMode={viewMode} onViewChange={setViewMode} dayWidth={dayWidth} onDayWidthChange={setDayWidth} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar with names */}
        <div className="w-64 bg-neutral-950 border-r border-neutral-700 flex-shrink-0 overflow-y-auto">
          <div className="h-20 border-b border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-400">
            {viewMode === 'resources' ? 'RESSURSID' : 'PROJEKTID'}
          </div>
          {rowItems.map(row => (
            <div key={row.id}>
              {/* Main row header */}
              <div className="h-12 border-b border-neutral-800 flex items-center px-3 text-sm font-medium bg-neutral-900">
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: row.color }} />
                {row.name}
              </div>
              {/* Assignment sub-rows */}
              {row.assigns.map((assign) => (
                <div
                  key={assign.id}
                  className="h-12 border-b border-neutral-850 flex items-center px-3 text-xs text-neutral-300"
                  style={{ paddingLeft: `${12 + assign.level * 20}px` }}
                >
                  {assign.hasChildren && (
                    <button
                      onClick={() => toggleCollapse(assign.id)}
                      className="mr-2 w-4 h-4 flex items-center justify-center hover:bg-neutral-700 rounded"
                    >
                      {collapsedParents.has(assign.id) ? '▶' : '▼'}
                    </button>
                  )}
                  {assign.milestone ? (
                    <span className="text-yellow-400 mr-2">◆</span>
                  ) : null}
                  <span className="truncate">{assign.note || 'Ülesanne'}</span>
                  {assign.progress !== undefined && (
                    <span className="ml-auto text-[10px] text-neutral-500">{assign.progress}%</span>
                  )}
                </div>
              ))}
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
              {/* Canvas for dependency arrows */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 5 }}
              />

              {/* Vertical grid lines */}
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

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset <= days.length * dayWidth && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                  style={{ left: todayOffset, zIndex: 20 }}
                />
              )}

              {/* Rows with assignments */}
              {rowItems.map((row) => (
                <div key={row.id}>
                  {/* Main row (empty, just for spacing) */}
                  <div className="h-12 border-b border-neutral-800 relative" />

                  {/* Assignment rows */}
                  {row.assigns.map((assign) => (
                    <div key={assign.id} className="h-12 border-b border-neutral-850 relative" style={{ zIndex: 10 }}>
                      {assign.milestone ? (
                        // Milestone marker (diamond)
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 cursor-pointer ${selectedAssignment === assign.id ? 'ring-2 ring-blue-400' : ''}`}
                          style={{
                            left: getBarPosition(assign.start, assign.end).left,
                            width: 20,
                            height: 20,
                            transform: 'rotate(45deg) translateY(-50%)',
                            backgroundColor: row.color,
                            zIndex: 15
                          }}
                          onClick={() => setSelectedAssignment(assign.id)}
                          onContextMenu={(e) => handleContextMenu(e, assign.id)}
                        />
                      ) : (
                        // Regular task bar
                        <div
                          className={`absolute h-8 top-2 rounded cursor-move transition-all ${selectedAssignment === assign.id ? 'ring-2 ring-blue-400 z-10' : 'z-0'}`}
                          style={{
                            left: getBarPosition(assign.start, assign.end).left,
                            width: getBarPosition(assign.start, assign.end).width,
                            backgroundColor: row.color,
                            opacity: 0.85,
                            borderLeft: `3px solid ${getStatusColor(assign.status)}`
                          }}
                          onMouseDown={(e) => handleMouseDown(e, assign, 'move')}
                          onContextMenu={(e) => handleContextMenu(e, assign.id)}
                          onClick={() => setSelectedAssignment(assign.id)}
                        >
                          {/* Progress bar inside */}
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
                        </div>
                      )}
                    </div>
                  ))}
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
