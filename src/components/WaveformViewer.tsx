import React, { useEffect, useRef, useState, useMemo } from 'react';
import { VCDData, VCDSignal } from '../utils/vcdParser';
import { ZoomIn, ZoomOut, Maximize, GripVertical, Settings2, Eye, EyeOff, Activity, Box, Hash, HelpCircle, ChevronRight, ChevronLeft, Filter, Search, Magnet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const TypeIcon = ({ type }: { type?: string }) => {
  switch (type) {
    case 'reg':
      return <span title="Register"><Box className="w-3 h-3 text-orange-400 shrink-0" /></span>;
    case 'wire':
      return <span title="Wire"><Activity className="w-3 h-3 text-cyan-400 shrink-0" /></span>;
    case 'integer':
    case 'real':
    case 'realtime':
    case 'time':
      return <span title={type}><Hash className="w-3 h-3 text-purple-400 shrink-0" /></span>;
    default:
      return <span title={type || 'Unknown'}><HelpCircle className="w-3 h-3 text-slate-500 shrink-0" /></span>;
  }
};

export interface WaveformViewerViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
  tracks: TrackConfig[];
  selectedModule?: string;
}

interface WaveformViewerProps {
  vcd: VCDData;
  viewState?: WaveformViewerViewState;
  onViewStateChange?: (state: WaveformViewerViewState) => void;
}

const ROW_HEIGHT = 40;
const MIN_PIXELS_PER_TICK = 0.0001;
const MAX_PIXELS_PER_TICK = 1000;

export interface TrackConfig {
  uniqueId: string;
  signal: VCDSignal;
  format: 'hex' | 'bin' | 'dec';
  isHidden: boolean;
}

export function WaveformViewer({ vcd, viewState, onViewStateChange }: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(viewState?.scale || 10);
  const [offsetX, setOffsetX] = useState(viewState?.offsetX || 0);
  const [offsetY, setOffsetY] = useState(viewState?.offsetY || 0);
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);

  const [tracks, setTracks] = useState<TrackConfig[]>(viewState?.tracks || []);
  
  const modules = useMemo(() => {
    const mods = new Set<string>();
    vcd.signals.forEach(s => {
      if (s.module) mods.add(s.module);
    });
    return Array.from(mods);
  }, [vcd]);
  
  const [selectedModule, setSelectedModule] = useState<string>(viewState?.selectedModule || 'all');
  const [filterMode, setFilterMode] = useState<'all' | 'clean'>('all');
  
  const [cursorTime, setCursorTime] = useState<number>(0);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  
  const [jumpOnPosedge, setJumpOnPosedge] = useState(true);
  const [jumpOnNegedge, setJumpOnNegedge] = useState(true);
  const [stickyCursor, setStickyCursor] = useState(false);
  
  // Persist state to parent when it changes
  const onViewStateChangeRef = useRef(onViewStateChange);
  useEffect(() => {
    onViewStateChangeRef.current = onViewStateChange;
  }, [onViewStateChange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onViewStateChangeRef.current) {
        onViewStateChangeRef.current({ scale, offsetX, offsetY, tracks, selectedModule });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [scale, offsetX, offsetY, tracks, selectedModule]);
  
  useEffect(() => {
    const finalTracks: TrackConfig[] = [];
    const prevTracksMap = new Map<string, TrackConfig>();
    
    (viewState?.tracks || tracks).forEach(t => {
       const coreId = t.uniqueId.replace(/_\d+$/, ''); 
       prevTracksMap.set(coreId, t);
    });

    const newSignalsSet = new Set(vcd.signals.map(s => `${s.id}_${s.name}_${s.module}`));

    (viewState?.tracks || tracks).forEach(t => {
       const coreId = t.uniqueId.replace(/_\d+$/, '');
       if (newSignalsSet.has(coreId)) {
           const newSig = vcd.signals.find(s => `${s.id}_${s.name}_${s.module}` === coreId);
           if (newSig) finalTracks.push({ ...t, uniqueId: coreId, signal: newSig });
       }
    });

    vcd.signals.forEach(s => {
       const coreId = `${s.id}_${s.name}_${s.module}`;
       if (!prevTracksMap.has(coreId)) {
           const newTrack = {
              uniqueId: coreId,
              signal: s,
              format: s.width > 1 ? 'hex' as const : 'bin' as const,
              isHidden: false
           };
           finalTracks.push(newTrack);
           prevTracksMap.set(coreId, newTrack);
       }
    });

    setTracks(finalTracks);

    if ((!viewState?.scale || viewState.scale === 10) && canvasWrapperRef.current && vcd.maxTime > 0) {
      const initialScale = Math.max(MIN_PIXELS_PER_TICK, Math.min(MAX_PIXELS_PER_TICK, canvasWrapperRef.current.clientWidth / Math.max(1, vcd.maxTime)));
      setScale(initialScale);
    }
  }, [vcd]);

  const moduleTracks = useMemo(() => tracks.filter(t => selectedModule === 'all' || t.signal.module === selectedModule), [tracks, selectedModule]);
  
  const filteredModuleTracks = useMemo(() => {
    if (filterMode === 'clean') {
      return moduleTracks.filter(t => {
        const n = t.signal.name;
        // Clean Names heuristic: ignore nets starting with _, $, or containing . (auto-generated instances/wires)
        if (n.startsWith('_') || n.includes('$') || n.includes('.')) return false;
        return true;
      });
    }
    return moduleTracks;
  }, [moduleTracks, filterMode]);

  const visibleTracks = useMemo(() => filteredModuleTracks.filter(t => !t.isHidden), [filteredModuleTracks]);

  const stateRef = useRef({ scale, offsetX, offsetY });
  useEffect(() => {
    stateRef.current = { scale, offsetX, offsetY };
  }, [scale, offsetX, offsetY]);

  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        let newScale = stateRef.current.scale * zoomFactor;
        if (newScale < MIN_PIXELS_PER_TICK) newScale = MIN_PIXELS_PER_TICK;
        if (newScale > MAX_PIXELS_PER_TICK) newScale = MAX_PIXELS_PER_TICK;
        
        const canvasX = e.clientX - el.getBoundingClientRect().left;
        const timeAtMouse = (stateRef.current.offsetX + canvasX) / stateRef.current.scale;
        const newOffsetX = timeAtMouse * newScale - canvasX;
        setOffsetX(Math.max(0, newOffsetX));
        setScale(newScale);
      } else {
        if (e.shiftKey) {
          setOffsetY(o => Math.max(0, o + e.deltaY));
        } else {
          setOffsetX(o => Math.max(0, o + (e.deltaX !== 0 ? e.deltaX : e.deltaY)));
        }
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [resizeStartWidth, setResizeStartWidth] = useState(250);
  const [resizeStartX, setResizeStartX] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const isValidEdge = (prevVal: string, currVal: string, isBus: boolean) => {
    if (isBus) return true;
    if (jumpOnPosedge && prevVal === '0' && currVal === '1') return true;
    if (jumpOnNegedge && prevVal === '1' && currVal === '0') return true;
    return false;
  };

  const findNearestEdgeTime = (time: number): number => {
    if (!activeTrackId || (!jumpOnPosedge && !jumpOnNegedge)) return time;
    const track = visibleTracks.find(t => t.uniqueId === activeTrackId);
    if (!track) return time;
    const data = vcd.data[track.signal.id];
    if (!data || data.length < 2) return time;

    const isBus = track.signal.width > 1;
    let left = 0;
    let right = data.length - 1;
    while (left <= right) {
       const mid = Math.floor((left + right) / 2);
       if (data[mid].time < time) left = mid + 1;
       else right = mid - 1;
    }
    const idx = Math.min(Math.max(0, right), data.length - 1);
    
    let closestTime = time;
    let minDiff = Infinity;
    
    // search locally for closest matching edge
    for (let i = Math.max(1, idx - 100); i < Math.min(data.length, idx + 100); i++) {
        if (isValidEdge(data[i-1].val, data[i].val, isBus)) {
           const diff = Math.abs(data[i].time - time);
           if (diff < minDiff) {
               minDiff = diff;
               closestTime = data[i].time;
           }
        }
    }

    if ((minDiff * scale) > 50) return time;
    return closestTime;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setIsHovering(true);
    if (canvasWrapperRef.current) {
        const rect = canvasWrapperRef.current.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        let rawTime = Math.max(0, (canvasX + offsetX) / scale);
        setCursorTime(stickyCursor ? findNearestEdgeTime(rawTime) : rawTime);
    }
    if (!isDragging) return;
    const dx = dragStart.x - e.clientX;
    const dy = dragStart.y - e.clientY;
    setOffsetX(Math.max(0, offsetX + dx));
    setOffsetY(Math.max(0, offsetY + dy));
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
  };
  
  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsHovering(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasWrapperRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasWrapperRef.current.clientWidth;
    const height = canvasWrapperRef.current.clientHeight;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '12px "JetBrains Mono", monospace';
    
    ctx.fillStyle = '#16161a';
    ctx.fillRect(0, 0, width, 30);
    ctx.strokeStyle = '#27272a';
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(width, 30);
    ctx.stroke();
    
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    
    const timeStart = Math.max(0, offsetX / scale);
    const timeEnd = timeStart + (width / scale);
    
    let timeStep = 1;
    while (timeStep * scale < 50) {
      timeStep *= 2;
      if (timeStep * scale < 50) timeStep *= 2.5;
      if (timeStep * scale < 50) timeStep *= 2;
    }

    const firstTick = Math.floor(timeStart / timeStep) * timeStep;
    for (let t = firstTick; t <= timeEnd; t += timeStep) {
      const x = (t * scale) - offsetX;
      ctx.beginPath();
      ctx.moveTo(x, 25);
      ctx.lineTo(x, 30);
      ctx.stroke();
      ctx.fillText(t.toString(), x, 20);
      
      ctx.strokeStyle = '#1e1e24';
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.strokeStyle = '#27272a';
    }

    let yPos = 30 - offsetY;
    
    visibleTracks.forEach((track) => {
      if (yPos > height || yPos + ROW_HEIGHT < 0) {
        yPos += ROW_HEIGHT;
        return; 
      }

      const sigData = vcd.data[track.signal.id];
      const traceY = yPos + ROW_HEIGHT / 2;
      const waveHeight = ROW_HEIGHT * 0.6;
      const h2 = waveHeight / 2;

      ctx.save();
      ctx.strokeStyle = '#1e1e24';
      ctx.beginPath();
      ctx.moveTo(0, yPos + ROW_HEIGHT);
      ctx.lineTo(width, yPos + ROW_HEIGHT);
      ctx.stroke();

      if (sigData && sigData.length > 0) {
        ctx.strokeStyle = track.uniqueId === activeTrackId ? '#34d399' : '#10b981';
        ctx.fillStyle = track.uniqueId === activeTrackId ? '#34d399' : '#10b981';
        ctx.lineWidth = track.uniqueId === activeTrackId ? 2 : 1.5;

        for (let i = 0; i < sigData.length; i++) {
          const trans = sigData[i];
          const nextTrans = sigData[i + 1];
          
          const tStart = trans.time;
          const tEnd = nextTrans ? nextTrans.time : Math.max(vcd.maxTime, timeEnd);

          if (tEnd < timeStart) continue; 
          if (tStart > timeEnd) break;    

          const x1 = (tStart * scale) - offsetX;
          const x2 = (tEnd * scale) - offsetX;
          
          const drawBus = track.signal.width > 1;

          if (drawBus) {
             const isX = trans.val.includes('x') || trans.val.includes('X');
             const isZ = trans.val.includes('z') || trans.val.includes('Z');
             ctx.strokeStyle = isX ? '#ef4444' : isZ ? '#eab308' : '#3b82f6';
             ctx.fillStyle = isX ? 'rgba(239,68,68,0.1)' : isZ ? 'rgba(234,179,8,0.1)' : 'rgba(59,130,246,0.1)';
             
             ctx.beginPath();
             ctx.moveTo(x1, traceY);
             ctx.lineTo(x1 + 3, traceY - h2);
             ctx.lineTo(x2 - 3, traceY - h2);
             ctx.lineTo(x2, traceY);
             ctx.lineTo(x2 - 3, traceY + h2);
             ctx.lineTo(x1 + 3, traceY + h2);
             ctx.closePath();
             
             ctx.fill();
             ctx.stroke();

             if (!isX && !isZ && x2 - x1 > 20) {
                ctx.fillStyle = '#94a3b8';
                ctx.textAlign = 'center';
                let text = trans.val;
                try {
                  const num = parseInt(trans.val, 2);
                  if (track.format === 'hex') text = num.toString(16).toUpperCase();
                  else if (track.format === 'dec') text = num.toString(10);
                } catch(e) {}
                ctx.fillText(text, (x1 + x2)/2, traceY + 4);
             }

          } else {
             const is1 = trans.val === '1';
             const is0 = trans.val === '0';
             const isX = (!is1 && !is0);

             ctx.strokeStyle = isX ? '#ef4444' : (track.uniqueId === activeTrackId ? '#34d399' : '#10b981');
             const ty = is1 ? traceY - h2 : is0 ? traceY + h2 : traceY;
             
             ctx.beginPath();
             if (i > 0) {
                const prev = sigData[i-1];
                const prev1 = prev.val === '1';
                const prev0 = prev.val === '0';
                const pty = prev1 ? traceY - h2 : prev0 ? traceY + h2 : traceY;
                if (pty !== ty) {
                    ctx.moveTo(x1, pty);
                    ctx.lineTo(x1, ty);
                } else {
                    ctx.moveTo(x1, ty);
                }
             } else {
                 ctx.moveTo(x1, ty);
             }
             
             ctx.lineTo(x2, ty);
             ctx.stroke();
          }
        }
      }

      ctx.restore();
      yPos += ROW_HEIGHT;
    });

  }, [vcd, visibleTracks, scale, offsetX, offsetY, activeTrackId]);

  const [draggedId, setDraggedId] = useState<string | null>(null);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
       setTracks(prev => {
          const next = [...prev];
          const draggedIdx = next.findIndex(t => t.uniqueId === draggedId);
          const dropIdx = next.findIndex(t => t.uniqueId === id);
          if (draggedIdx > -1 && dropIdx > -1) {
             const [item] = next.splice(draggedIdx, 1);
             next.splice(dropIdx, 0, item);
          }
          return next;
       });
    }
  };

  const onDragEnd = () => {
    setDraggedId(null);
  };
  
  const jumpToEdge = (direction: 'next' | 'prev') => {
    // If we have a jump target, proceed. Otherwise try to use the last cursor, or just the center of view.
    const target = cursorTime !== null ? cursorTime : (offsetX + (canvasWrapperRef.current?.clientWidth || 0) / 2) / scale;
    if (!activeTrackId) return;
    const track = visibleTracks.find(t => t.uniqueId === activeTrackId);
    if (!track) return;
    const data = vcd.data[track.signal.id];
    if (!data || data.length < 2) return;
    
    const isBus = track.signal.width > 1;

    if (direction === 'next') {
        const nextTransIdx = data.findIndex((d, i) => {
           if (d.time <= target + 0.0001) return false;
           if (i === 0) return false;
           return isValidEdge(data[i-1].val, d.val, isBus);
        });
        if (nextTransIdx > -1) jumpToTime(data[nextTransIdx].time);
    } else {
        let pastTransIdx = -1;
        for (let i = data.length - 1; i >= 1; i--) {
            if (data[i].time < target - 0.0001) {
                if (isValidEdge(data[i-1].val, data[i].val, isBus)) {
                    pastTransIdx = i;
                    break;
                }
            }
        }
        if (pastTransIdx > -1) jumpToTime(data[pastTransIdx].time);
    }
  };
  
  const jumpToTime = (t: number) => {
     setCursorTime(t);
     if (canvasWrapperRef.current) {
        const width = canvasWrapperRef.current.clientWidth;
        setOffsetX(Math.max(0, (t * scale) - width / 2));
     }
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isResizingLeft) return;
      const dx = e.clientX - resizeStartX;
      setLeftPanelWidth(Math.max(150, Math.min(resizeStartWidth + dx, 800)));
    };
    const handleUp = () => setIsResizingLeft(false);
    if (isResizingLeft) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingLeft, resizeStartX, resizeStartWidth]);

  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas || !minimapRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Check width/height relative to container
    const width = minimapRef.current.clientWidth;
    const height = minimapRef.current.clientHeight;
    if (width === 0 || height === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, width, height);
    
    let startIndex = 0;
    let endIndex = visibleTracks.length;
    
    if (canvasWrapperRef.current) {
        startIndex = Math.max(0, Math.floor(offsetY / ROW_HEIGHT));
        const visibleRowCount = Math.ceil(canvasWrapperRef.current.clientHeight / ROW_HEIGHT) + 1;
        endIndex = Math.min(visibleTracks.length, startIndex + visibleRowCount);
    }
    
    const activeMinimapTracks = visibleTracks.slice(startIndex, endIndex);

    if (vcd.maxTime === 0 || activeMinimapTracks.length === 0) return;

    const rowH = height / activeMinimapTracks.length;
    const miniScale = width / vcd.maxTime;

    ctx.lineWidth = 1;

    for (let tIdx = 0; tIdx < activeMinimapTracks.length; tIdx++) {
      const track = activeMinimapTracks[tIdx];
      const sigData = vcd.data[track.signal.id];
      if (!sigData || sigData.length === 0) continue;

      const isBus = track.signal.width > 1;
      const yCenter = tIdx * rowH + rowH / 2;
      const h2 = Math.min(rowH * 0.4, 4);

      ctx.strokeStyle = track.uniqueId === activeTrackId ? '#34d399' : '#3f3f46';
      ctx.fillStyle = track.uniqueId === activeTrackId ? '#34d399' : '#3f3f46';
      
      ctx.beginPath();

      for (let i = 0; i < sigData.length; i++) {
         const trans = sigData[i];
         const nextTrans = sigData[i + 1];
         const tStart = trans.time;
         const tEnd = nextTrans ? nextTrans.time : vcd.maxTime;
         
         const x1 = tStart * miniScale;
         const x2 = tEnd * miniScale;

         if (isBus) {
             const isX = trans.val.includes('x') || trans.val.includes('X');
             const isZ = trans.val.includes('z') || trans.val.includes('Z');
             ctx.strokeStyle = isX ? '#ef4444' : isZ ? '#eab308' : '#3b82f6';
             ctx.fillStyle = isX ? 'rgba(239,68,68,0.5)' : isZ ? 'rgba(234,179,8,0.5)' : 'rgba(59,130,246,0.5)';
             
             ctx.fillRect(x1, yCenter - h2, x2 - x1, h2 * 2);
             ctx.strokeRect(x1, yCenter - h2, x2 - x1, h2 * 2);
         } else {
             const is1 = trans.val === '1';
             const is0 = trans.val === '0';
             const isX = (!is1 && !is0);
             ctx.strokeStyle = isX ? '#ef4444' : (track.uniqueId === activeTrackId ? '#34d399' : '#059669');
             const ty = is1 ? yCenter - h2 : is0 ? yCenter + h2 : yCenter;

             if (i > 0) {
                const prev = sigData[i-1];
                const prev1 = prev.val === '1';
                const prev0 = prev.val === '0';
                const pty = prev1 ? yCenter - h2 : prev0 ? yCenter + h2 : yCenter;
                if (pty !== ty) {
                    ctx.moveTo(x1, pty);
                    ctx.lineTo(x1, ty);
                } else {
                    ctx.moveTo(x1, ty);
                }
             } else {
                 ctx.moveTo(x1, ty);
             }
             ctx.lineTo(x2, ty);
         }
      }
      if (!isBus) {
         ctx.stroke();
      }
    }
  }, [vcd, visibleTracks, activeTrackId, leftPanelWidth, offsetY]); // Re-render when tracks or container resize

  const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);
  
  const updateMinimapPan = (clientX: number) => {
    if (!minimapRef.current || !canvasWrapperRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const time = percentage * vcd.maxTime;
    
    // Center the viewport on this time
    const viewWidthTime = canvasWrapperRef.current.clientWidth / scale;
    setOffsetX(Math.max(0, (time * scale) - (viewWidthTime * scale) / 2));
  };

  const onMinimapMouseDown = (e: React.MouseEvent) => {
     setIsDraggingMinimap(true);
     updateMinimapPan(e.clientX);
  };

  useEffect(() => {
     const handleMove = (e: MouseEvent) => {
        if (!isDraggingMinimap) return;
        updateMinimapPan(e.clientX);
     };
     const handleUp = () => setIsDraggingMinimap(false);
     
     if (isDraggingMinimap) {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
     }
     return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
     };
  }, [isDraggingMinimap, vcd, scale]);

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-4 bg-[#121214] shrink-0">
        <h3 className="text-emerald-400 font-medium text-sm shrink-0 truncate max-w-[200px]">Waveform Viewer</h3>
        <span className="text-xs text-slate-500 bg-black/30 rounded px-2 py-1 shrink-0">Time: {vcd.timescale}</span>
        
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="text-xs text-slate-300 bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1 shrink-0 transition-colors">
               <Eye className="w-3 h-3" /> Signals ({visibleTracks.length}/{moduleTracks.length})
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" className="z-50 min-w-[200px] bg-[#1e1e24] border border-[#27272a] rounded shadow-xl py-1 max-h-[300px] overflow-y-auto">
               <div className="px-3 py-1 text-xs text-slate-500 font-medium">Toggle Visibility</div>
               <DropdownMenu.Item asChild>
                 <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] text-slate-300 flex items-center justify-between"
                   onClick={(e) => { e.preventDefault(); setFilterMode(filterMode === 'all' ? 'clean' : 'all'); }}
                 >
                   <span>Clean Names</span>
                   {filterMode === 'clean' && <Box className="w-3 h-3 text-emerald-400" />}
                 </button>
               </DropdownMenu.Item>
               <div className="h-px bg-[#27272a] my-1" />
               {filteredModuleTracks.map(t => (
                  <DropdownMenu.Item key={t.uniqueId} asChild>
                    <button 
                      className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] flex items-center gap-2 text-slate-300"
                      onClick={(e) => { e.preventDefault(); setTracks(p => p.map(x => x.uniqueId === t.uniqueId ? {...x, isHidden: !x.isHidden} : x)); }}
                    >
                      {t.isHidden ? <EyeOff className="w-3 h-3 text-slate-500 shrink-0" /> : <Eye className="w-3 h-3 text-emerald-400 shrink-0" />}
                      <span className="truncate flex-1 flex items-center gap-1.5" title={t.signal.name}><TypeIcon type={t.signal.type || 'wire'} /> <span className="opacity-70 text-[10px]">[{t.signal.width}]</span> {t.signal.name}</span>
                    </button>
                  </DropdownMenu.Item>
               ))}
               <div className="h-px bg-[#27272a] my-1" />
               <DropdownMenu.Item asChild>
                  <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] text-slate-300" onClick={(e) => { e.preventDefault(); setTracks(p => p.map(x => ({...x, isHidden: false}))); }}>
                     Show All
                  </button>
               </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/20 rounded border border-white/5 overflow-hidden">
             <button 
               className={`px-2 py-1 text-slate-400 disabled:opacity-30 transition-colors ${stickyCursor ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 hover:text-white'}`}
               onClick={() => setStickyCursor(!stickyCursor)}
               title="Sticky Cursor (Snap to Edges)"
             >
                <Magnet className="w-3.5 h-3.5" />
             </button>
             <button 
               className={`px-2 py-1 border-l border-white/5 text-slate-400 disabled:opacity-30 transition-colors ${jumpOnPosedge ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 hover:text-white'}`}
               onClick={() => setJumpOnPosedge(!jumpOnPosedge)}
               title="Snap/Jump on Positive Edge"
             >
                <ArrowUpRight className="w-3.5 h-3.5" />
             </button>
             <button 
               className={`px-2 py-1 border-l border-white/5 text-slate-400 disabled:opacity-30 transition-colors ${jumpOnNegedge ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-white/10 hover:text-white'}`}
               onClick={() => setJumpOnNegedge(!jumpOnNegedge)}
               title="Snap/Jump on Negative Edge"
             >
                <ArrowDownRight className="w-3.5 h-3.5" />
             </button>
          </div>

          <div className="flex items-center bg-black/20 rounded border border-white/5 overflow-hidden">
             <button 
               className="px-2 py-1 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors" 
               onClick={() => jumpToEdge('prev')}
               disabled={!activeTrackId}
               title="Jump to Previous Edge (Selected Track)"
             >
                <ChevronLeft className="w-3.5 h-3.5" />
             </button>
             <button 
               className="px-2 py-1 hover:bg-white/10 border-l border-white/5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
               onClick={() => jumpToEdge('next')}
               disabled={!activeTrackId}
               title="Jump to Next Edge (Selected Track)"
             >
                <ChevronRight className="w-3.5 h-3.5" />
             </button>
          </div>
        </div>

        <span className="text-xs text-slate-500 bg-black/30 flex-1 px-3 truncate rounded py-1 max-w-[250px] hidden md:block">Scroll=Pan, Ctrl=Zoom, Shift=Up/Down</span>
        
        <div className="flex-1" />
        <button className="p-1.5 text-slate-400 hover:text-white transition-colors" onClick={() => setScale(s => Math.max(MIN_PIXELS_PER_TICK, s * 0.8))} title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
        </button>
        <button className="p-1.5 text-slate-400 hover:text-white transition-colors" onClick={() => setScale(s => Math.min(MAX_PIXELS_PER_TICK, s * 1.2))} title="Zoom In">
            <ZoomIn className="w-4 h-4" />
        </button>
        <button className="p-1.5 text-slate-400 hover:text-white transition-colors" onClick={() => { setOffsetX(0); setOffsetY(0); }} title="Reset View">
            <Maximize className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 w-full relative overflow-hidden flex" ref={containerRef}>
        
        {/* Left Side: Track Labels */}
        <div style={{ width: leftPanelWidth }} className="h-full flex flex-col items-stretch shrink-0 bg-[#121214] border-r border-[#1e1e24] relative z-10">
           <div className="h-[30px] border-b border-[#27272a] bg-[#16161a] shrink-0 flex items-center px-1">
             <select
               className="w-full bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
               value={selectedModule}
               onChange={e => setSelectedModule(e.target.value)}
             >
               <option value="all">All Modules</option>
               {modules.map(m => (
                 <option key={m} value={m}>{m}</option>
               ))}
             </select>
           </div>
           <div className="flex-1 overflow-hidden relative">
              <div style={{ transform: `translateY(${-offsetY}px)` }} className="left-0 right-0 top-0 absolute">
                 {visibleTracks.map(t => {
                   
                   // Find value at cursor
                   let currentVal = '';
                   if (cursorTime !== null) {
                     const data = vcd.data[t.signal.id];
                     if (data) {
                       for (let i = data.length - 1; i >= 0; i--) {
                         if (data[i].time <= cursorTime) {
                           currentVal = data[i].val;
                           if (t.format === 'hex' && t.signal.width > 1 && !currentVal.includes('x') && !currentVal.includes('z')) {
                              try { currentVal = parseInt(currentVal, 2).toString(16).toUpperCase(); } catch {}
                           } else if (t.format === 'dec' && t.signal.width > 1 && !currentVal.includes('x') && !currentVal.includes('z')) {
                              try { currentVal = parseInt(currentVal, 2).toString(10); } catch {}
                           }
                           break;
                         }
                       }
                     }
                   }

                   return (
                    <div 
                      key={t.uniqueId}
                      draggable
                      onDragStart={(e) => onDragStart(e, t.uniqueId)}
                      onDragOver={(e) => onDragOver(e, t.uniqueId)}
                      onDragEnd={onDragEnd}
                      onClick={() => setActiveTrackId(prev => prev === t.uniqueId ? null : t.uniqueId)}
                      className={`h-[40px] flex items-center justify-between px-2 group border-b border-[#1e1e24] transition-colors cursor-pointer
                        ${activeTrackId === t.uniqueId ? 'bg-emerald-500/10' : 'bg-[#121214] hover:bg-[#1a1a1f]'} 
                        ${draggedId === t.uniqueId ? 'opacity-50' : ''}`}
                    >
                       <div className="flex items-center gap-1.5 overflow-hidden flex-1 active:cursor-grabbing">
                          <GripVertical className="w-3 h-3 text-slate-500 opacity-20 group-hover:opacity-100 shrink-0" />
                          <TypeIcon type={t.signal.type || 'wire'} />
                          <span className={`truncate text-xs font-mono flex-1 select-none ${activeTrackId === t.uniqueId ? 'text-emerald-300' : 'text-emerald-400'}`} title={t.signal.name}>
                             <span className="opacity-70 text-[10px]">[{t.signal.width}]</span> {t.signal.name}
                          </span>
                       </div>
                       
                       <div className="flex items-center gap-2">
                         {cursorTime !== null && currentVal && (
                           <span className="text-[10px] bg-black/40 text-slate-300 px-1 rounded font-mono shrink-0">
                             {currentVal}
                           </span>
                         )}
                         <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                               <button className="p-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white shrink-0 outline-none">
                                  <Settings2 className="w-3 h-3" />
                               </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                               <DropdownMenu.Content className="z-50 min-w-[120px] bg-[#1e1e24] border border-[#27272a] rounded shadow-xl py-1">
                                  <div className="px-3 py-1 text-[10px] text-slate-500 uppercase tracking-wider">Format</div>
                                  <DropdownMenu.Item asChild>
                                     <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] text-slate-300 flex items-center justify-between" onClick={(e) => { e.preventDefault(); setTracks(p => p.map(x => x.uniqueId === t.uniqueId ? {...x, format: 'hex'} : x)); }}>
                                        Hexadecimal {t.format === 'hex' && '✓'}
                                     </button>
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item asChild>
                                     <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] text-slate-300 flex items-center justify-between" onClick={(e) => { e.preventDefault(); setTracks(p => p.map(x => x.uniqueId === t.uniqueId ? {...x, format: 'dec'} : x)); }}>
                                        Decimal {t.format === 'dec' && '✓'}
                                     </button>
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item asChild>
                                     <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-[#27272a] text-slate-300 flex items-center justify-between" onClick={(e) => { e.preventDefault(); setTracks(p => p.map(x => x.uniqueId === t.uniqueId ? {...x, format: 'bin'} : x)); }}>
                                        Binary {t.format === 'bin' && '✓'}
                                     </button>
                                  </DropdownMenu.Item>
                                  <div className="h-px bg-[#27272a] my-1" />
                                  <DropdownMenu.Item asChild>
                                     <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-rose-500/20 text-rose-400 flex items-center gap-2" onClick={(e) => { e.preventDefault(); setTracks(p => p.map(x => x.uniqueId === t.uniqueId ? {...x, isHidden: true} : x)); }}>
                                        <EyeOff className="w-3 h-3" /> Hide Signal
                                     </button>
                                  </DropdownMenu.Item>
                               </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                         </DropdownMenu.Root>
                       </div>
                    </div>
                 )})}
                 <div className="h-[40px]" /> 
              </div>
           </div>
           
           <div 
             className="absolute top-0 bottom-0 right-[-2px] w-4 cursor-col-resize hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-colors z-20 flex justify-center"
             onMouseDown={(e) => {
               setIsResizingLeft(true);
               setResizeStartX(e.clientX);
               setResizeStartWidth(leftPanelWidth);
             }}
           >
              <div className="w-px h-full bg-[#27272a] group-hover:bg-emerald-500/50" />
           </div>
        </div>

        {/* Canvas Workspace */}
        <div 
           className="flex-1 flex flex-col h-full relative border-l border-black"
        >
          <div 
             className="flex-1 relative cursor-crosshair"
             ref={canvasWrapperRef}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseLeave}
          >
             <canvas ref={canvasRef} className="absolute inset-0 select-none active:cursor-grabbing outline-none" tabIndex={0} style={{ touchAction: 'none' }} />
             
             {cursorTime !== null && (
               <div 
                 className={`absolute top-[30px] bottom-0 ${stickyCursor ? 'w-[2px] bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'w-px bg-white/40'} pointer-events-none z-10`} 
                 style={{ left: (cursorTime * scale) - offsetX }}
               >
                 <div className={`absolute top-0 left-1 text-[10px] font-mono px-1 rounded ${stickyCursor ? 'text-emerald-100 bg-emerald-600/90 border border-emerald-400/30' : 'text-white/80 bg-black/60'}`}>
                   {cursorTime.toFixed(0)}
                 </div>
               </div>
             )}
          </div>
          
          {/* Scrollbar Handle */}
          <div className="h-6 bg-[#16161a] border-t border-[#27272a] relative flex items-center shrink-0">
             <input 
                type="range"
                className="w-full h-full opacity-50 hover:opacity-100 cursor-pointer mx-2"
                min={0}
                max={Math.max(1, vcd.maxTime - ((canvasWrapperRef.current?.clientWidth || 0) / scale))}
                value={offsetX / scale}
                onChange={(e) => setOffsetX(parseFloat(e.target.value) * scale)}
                style={{ accentColor: '#34d399' }}
             />
          </div>
        </div>
      </div>
      
      {/* Full Width Minimap */}
      <div className="h-[60px] bg-[#0c0c0e] border-t border-[#27272a] relative shrink-0 overflow-hidden" ref={minimapRef}>
         <canvas ref={minimapCanvasRef} className="absolute inset-0" />
         <div 
           className="absolute top-0 bottom-0 border-x-2 border-emerald-500/50 bg-emerald-500/10 cursor-ew-resize hover:bg-emerald-500/20 active:bg-emerald-500/30 transition-colors z-10"
           style={{ 
             left: `${vcd.maxTime > 0 ? ((offsetX / scale) / vcd.maxTime) * 100 : 0}%`,
             width: `${vcd.maxTime > 0 && canvasWrapperRef.current ? ((canvasWrapperRef.current.clientWidth / scale) / vcd.maxTime) * 100 : 100}%`,
             minWidth: '2px',
             maxWidth: '100%'
           }}
           onMouseDown={onMinimapMouseDown}
         />
      </div>

    </div>
  );
}
