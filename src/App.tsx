import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import logo from './assets/sketcha-logo.png';
import { config } from './config';
import { LandingUI } from './components/LandingUI';

import type { User, Tool, DrawAction } from './types';

const FONTS = ["Arial", "Verdana", "Times New Roman", "Courier New", "Comic Sans MS", "Impact", "Georgia", "Trebuchet MS", "Inter"];

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'create' | 'workspace'>('home');
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState('');
  const [activeRoomName, setActiveRoomName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [joinError, setJoinError] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const [showJoinName, setShowJoinName] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(() => window.innerWidth > 768);
  const lastTouchTime = useRef<number>(0);

  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [brushColor, setBrushColor] = useState('#18181B');
  const [brushSize, setBrushSize] = useState(3);
  const [textFont, setTextFont] = useState("Arial");
  const [textFontSize, setTextFontSize] = useState(24);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const drawHistory = useRef<DrawAction[]>([]);
  const historyStack = useRef<DrawAction[][]>([]);
  const undoStack = useRef<DrawAction[][]>([]);
  const snapshotBeforeAction = useRef<DrawAction[] | null>(null);
  const currentAction = useRef<DrawAction | null>(null);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [textInput, setTextInput] = useState<{ x: number; y: number; visualX: number; visualY: number; visible: boolean }>({ x: 0, y: 0, visualX: 0, visualY: 0, visible: false });
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedActionIndex, _setSelectedActionIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const setSelectedActionIndex = (idx: number | null) => {
    selectedIndexRef.current = idx;
    _setSelectedActionIndex(idx);
  };

  const socketRef = useRef<Socket | null>(null);
  const remoteDrawings = useRef<Record<string, { action: DrawAction; userName: string }>>({});
  const [activeDrawers, setActiveDrawers] = useState<{ userId: string; userName: string }[]>([]);
  const lastEmitTime = useRef<number>(0);
  const throttleMs = config.DRAWING_THROTTLE_MS;

  useEffect(() => {
    const socket = io(config.SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
    });

    socket.on('room_created', (data: { roomCode: string; roomName: string; users: User[], whiteboardElements: any[] }) => {
      console.log('Room created!', data);
      setActiveRoomCode(data.roomCode);
      setActiveRoomName(data.roomName);
      setUsers(data.users);
      setIsPanelOpen(window.innerWidth > 768);
      drawHistory.current = data.whiteboardElements || [];
      setCurrentView('workspace');
    });

    socket.on('room_joined', (data: { roomCode: string; roomName: string; users: User[], whiteboardElements: any[] }) => {
      console.log('Joined room!', data);
      setActiveRoomCode(data.roomCode);
      setActiveRoomName(data.roomName);
      setUsers(data.users);
      setIsPanelOpen(window.innerWidth > 768);
      drawHistory.current = data.whiteboardElements || [];
      setCurrentView('workspace');
    });

    socket.on('user_joined', (data: { user: User; users: User[] }) => {
      console.log('User joined:', data.user.name);
      setUsers(data.users);
    });

    socket.on('user_left', (data: { user: User; users: User[] }) => {
      console.log('User left:', data.user.name);
      setUsers(data.users);
    });

    socket.on('users_updated', (data: { users: User[] }) => {
      setUsers(data.users);
    });

    socket.on('join_error', (data: { message: string }) => {
      setJoinError(data.message);
      setTimeout(() => setJoinError(''), 3000);
    });

    socket.on('kicked_from_room', () => {
      alert("You have been kicked from the room by the host.");
      socket.disconnect();
      socket.connect();
      setActiveRoomCode('');
      setActiveRoomName('');
      setUsers([]);
      setUsername('');
      setRoomName('');
      setRoomCode('');
      setJoinUsername('');
      setShowJoinName(false);
      setCurrentView('home');
    });

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-item-container')) {
        setSelectedUserId(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleGlobalClick);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socketRef.current) return;

    const handleWhiteboardUpdate = (data: { actions: DrawAction[] }) => {
      const newHistory = data.actions;

      if (isDrawing.current && activeTool === 'select' && selectedActionIndex !== null) {
        if (newHistory[selectedActionIndex]) {
          newHistory[selectedActionIndex] = drawHistory.current[selectedActionIndex];
        }
      }

      drawHistory.current = newHistory;
      undoStack.current = [];
      redrawCanvas();
    };

    const handleAddAction = (data: { action: DrawAction }) => {
      drawHistory.current.push(data.action);
      undoStack.current = [];
      redrawCanvas();
    };

    const handleRemoteDrawing = (data: { userId: string; userName: string; action: DrawAction }) => {
      remoteDrawings.current[data.userId] = { action: data.action, userName: data.userName };
      setActiveDrawers(Object.entries(remoteDrawings.current).map(([userId, v]) => ({ userId, userName: v.userName })));
      redrawCanvas();
    };

    const handleRemoteDrawingEnd = (data: { userId: string }) => {
      delete remoteDrawings.current[data.userId];
      setActiveDrawers(Object.entries(remoteDrawings.current).map(([userId, v]) => ({ userId, userName: v.userName })));
    };

    socketRef.current.on('whiteboard_update', handleWhiteboardUpdate);
    socketRef.current.on('whiteboard_add_action', handleAddAction);
    socketRef.current.on('whiteboard_drawing', handleRemoteDrawing);
    socketRef.current.on('whiteboard_drawing_end', handleRemoteDrawingEnd);

    return () => {
      socketRef.current?.off('whiteboard_update', handleWhiteboardUpdate);
      socketRef.current?.off('whiteboard_add_action', handleAddAction);
      socketRef.current?.off('whiteboard_drawing', handleRemoteDrawing);
      socketRef.current?.off('whiteboard_drawing_end', handleRemoteDrawingEnd);
    };
  }, [currentView]);

  useEffect(() => {
    if (currentView !== 'workspace') return;
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      const logicalWidth = 1920;
      const logicalHeight = 1080;

      canvas.width = logicalWidth;
      canvas.height = logicalHeight;

      const padding = 16;
      const parentW = parent.clientWidth - padding * 2;
      const parentH = parent.clientHeight - padding * 2;

      const scale = Math.min(parentW / logicalWidth, parentH / logicalHeight);

      canvas.style.width = `${logicalWidth * scale}px`;
      canvas.style.height = `${logicalHeight * scale}px`;

      redrawCanvas();
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [currentView, isPanelOpen]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < drawHistory.current.length; i++) {
      renderAction(ctx, drawHistory.current[i]);
    }

    for (const userId of Object.keys(remoteDrawings.current)) {
      renderAction(ctx, remoteDrawings.current[userId].action);
    }

    if (isDrawing.current && currentAction.current) {
      renderAction(ctx, currentAction.current);
    }

    const selIdx = selectedIndexRef.current;
    if (selIdx !== null && selIdx < drawHistory.current.length) {
      const action = drawHistory.current[selIdx];
      ctx.strokeStyle = '#494c83';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;

      let minX = 0, minY = 0, w = 0, h = 0;
      if (action.tool === 'text') {
        ctx.font = `${action.fontSize || 16}px '${action.fontFamily || 'Inter'}', sans-serif`;
        const metrics = ctx.measureText(action.text!);
        w = metrics.width + 8;
        h = (action.fontSize || 16) + 8;
        minX = action.startX! - 4;
        minY = action.startY! - h + 4;
      } else if (action.tool === 'rect') {
        minX = Math.min(action.startX!, action.endX!) - 4;
        w = Math.abs(action.endX! - action.startX!) + 8;
        minY = Math.min(action.startY!, action.endY!) - 4;
        h = Math.abs(action.endY! - action.startY!) + 8;
      } else if (action.tool === 'circle') {
        const rx = Math.abs(action.endX! - action.startX!) / 2;
        const ry = Math.abs(action.endY! - action.startY!) / 2;
        const cx = action.startX! + (action.endX! - action.startX!) / 2;
        const cy = action.startY! + (action.endY! - action.startY!) / 2;
        minX = cx - rx - 4;
        minY = cy - ry - 4;
        w = rx * 2 + 8;
        h = ry * 2 + 8;
      } else if (action.tool === 'line') {
        minX = Math.min(action.startX!, action.endX!) - 4;
        w = Math.abs(action.endX! - action.startX!) + 8;
        minY = Math.min(action.startY!, action.endY!) - 4;
        h = Math.abs(action.endY! - action.startY!) + 8;
      } else if (action.points && action.points.length > 0) {
        const xs = action.points.map(p => p.x);
        const ys = action.points.map(p => p.y);
        minX = Math.min(...xs) - 4;
        w = Math.max(...xs) - minX + 8;
        minY = Math.min(...ys) - 4;
        h = Math.max(...ys) - minY + 8;
      }
      ctx.strokeRect(minX, minY, w, h);
      ctx.setLineDash([]);
    }
  }, []);

  const renderAction = (ctx: CanvasRenderingContext2D, action: DrawAction) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (action.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
    }
    ctx.lineWidth = action.size;

    if (action.tool === 'pencil' || action.tool === 'eraser') {
      if (action.points && action.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.stroke();
      }
    } else if (action.tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(action.startX!, action.startY!);
      ctx.lineTo(action.endX!, action.endY!);
      ctx.stroke();
    } else if (action.tool === 'rect') {
      ctx.strokeRect(action.startX!, action.startY!, action.endX! - action.startX!, action.endY! - action.startY!);
    } else if (action.tool === 'circle') {
      const rx = Math.abs(action.endX! - action.startX!) / 2;
      const ry = Math.abs(action.endY! - action.startY!) / 2;
      const cx = action.startX! + (action.endX! - action.startX!) / 2;
      const cy = action.startY! + (action.endY! - action.startY!) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (action.tool === 'text' && action.text) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `${action.fontSize || 16}px '${action.fontFamily || 'Inter'}', sans-serif`;
      ctx.fillText(action.text, action.startX!, action.startY!);
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canDrawUser) return;

    if ('touches' in e && e.touches.length > 1) return;

    if ('touches' in e) {
      lastTouchTime.current = Date.now();
    } else if (Date.now() - lastTouchTime.current < 500) {
      return;
    }

    snapshotBeforeAction.current = JSON.parse(JSON.stringify(drawHistory.current));

    if (activeTool === 'select') {
      const pos = getCanvasPos(e);
      let hit = -1;
      const ctx = canvasRef.current!.getContext('2d')!;

      for (let i = drawHistory.current.length - 1; i >= 0; i--) {
        const action = drawHistory.current[i];
        if (action.tool === 'text') {
          ctx.font = `${action.fontSize || 16}px '${action.fontFamily || 'Inter'}', sans-serif`;
          const metrics = ctx.measureText(action.text!);
          const w = metrics.width;
          const h = action.fontSize || 16;
          if (pos.x >= action.startX! && pos.x <= action.startX! + w &&
            pos.y <= action.startY! && pos.y >= action.startY! - h) {
            hit = i; break;
          }
        } else if (action.tool === 'rect' || action.tool === 'line' || action.tool === 'circle') {
          const minX = Math.min(action.startX!, action.endX!) - 10;
          const maxX = Math.max(action.startX!, action.endX!) + 10;
          const minY = Math.min(action.startY!, action.endY!) - 10;
          const maxY = Math.max(action.startY!, action.endY!) + 10;
          if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) { hit = i; break; }
        }
      }

      if (hit !== -1) {
        setSelectedActionIndex(hit);
        isDrawing.current = true;
        startPos.current = pos;
        redrawCanvas();
      } else {
        setSelectedActionIndex(null);
        redrawCanvas();
      }
      return;
    }

    if (activeTool === 'text') {
      const pos = getCanvasPos(e);

      let clientX, clientY;
      if ('touches' in e) {
        if (e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        }
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const parentRect = canvasRef.current!.parentElement!.getBoundingClientRect();
      const visualX = clientX - parentRect.left;
      const visualY = clientY - parentRect.top;

      setTextInput({ x: pos.x, y: pos.y, visualX, visualY, visible: true });
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    setSelectedActionIndex(null);
    isDrawing.current = true;
    const pos = getCanvasPos(e);
    startPos.current = pos;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      currentAction.current = { tool: activeTool, color: brushColor, size: brushSize, points: [pos] };
    } else {
      currentAction.current = { tool: activeTool, color: brushColor, size: brushSize, startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!('touches' in e) && Date.now() - lastTouchTime.current < 500) return;

    if ('touches' in e && e.touches.length > 1) {
      if (isDrawing.current) {
        isDrawing.current = false;
        currentAction.current = null;
        redrawCanvas();
      }
      return;
    }

    if (activeTool === 'select' && isDrawing.current && selectedActionIndex !== null) {
      const pos = getCanvasPos(e);
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      startPos.current = pos;

      const action = drawHistory.current[selectedActionIndex];
      if (action.startX !== undefined) action.startX += dx;
      if (action.startY !== undefined) action.startY += dy;
      if (action.endX !== undefined) action.endX += dx;
      if (action.endY !== undefined) action.endY += dy;
      if (action.points) {
        action.points.forEach(p => { p.x += dx; p.y += dy; });
      }

      redrawCanvas();

      const now = Date.now();
      if (now - lastEmitTime.current > throttleMs && socketRef.current && activeRoomCode) {
        lastEmitTime.current = now;
        socketRef.current.emit('whiteboard_drawing', {
          roomCode: activeRoomCode,
          action: { ...action }
        });
      }
      return;
    }

    if (!isDrawing.current || !currentAction.current) return;
    const pos = getCanvasPos(e);

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      currentAction.current.points!.push(pos);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const pts = currentAction.current.points!;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = currentAction.current.size;
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentAction.current.color;
      }
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      currentAction.current.endX = pos.x;
      currentAction.current.endY = pos.y;
      redrawCanvas();
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      renderAction(ctx, currentAction.current);
    }

    const now = Date.now();
    if (now - lastEmitTime.current > throttleMs && socketRef.current && activeRoomCode) {
      lastEmitTime.current = now;
      socketRef.current.emit('whiteboard_drawing', {
        roomCode: activeRoomCode,
        action: currentAction.current
      });
    }
  };

  const handleCanvasMouseUp = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e && !('touches' in e) && Date.now() - lastTouchTime.current < 500) return;

    if (activeTool === 'select' && isDrawing.current) {
      isDrawing.current = false;
      if (snapshotBeforeAction.current) {
        const strBefore = JSON.stringify(snapshotBeforeAction.current);
        const strAfter = JSON.stringify(drawHistory.current);
        if (strBefore !== strAfter) {
          historyStack.current.push(snapshotBeforeAction.current);
          if (historyStack.current.length > 50) historyStack.current.shift();
          undoStack.current = [];
        }
      }
      if (socketRef.current && activeRoomCode) {
        socketRef.current.emit('whiteboard_drawing_end', { roomCode: activeRoomCode });
      }
      syncWhiteboard();
      return;
    }

    if (!isDrawing.current || !currentAction.current) return;
    isDrawing.current = false;

    if (snapshotBeforeAction.current) {
      historyStack.current.push(snapshotBeforeAction.current);
      if (historyStack.current.length > 50) historyStack.current.shift();
      undoStack.current = [];
    }

    drawHistory.current.push(currentAction.current);
    const actionToSync = currentAction.current;
    currentAction.current = null;

    if (socketRef.current && activeRoomCode) {
      socketRef.current.emit('whiteboard_drawing_end', { roomCode: activeRoomCode });
    }

    syncAddAction(actionToSync);
  };

  const syncWhiteboard = () => {
    if (socketRef.current && activeRoomCode) {
      socketRef.current.emit('whiteboard_update', {
        roomCode: activeRoomCode,
        elements: drawHistory.current
      });
    }
  };

  const syncAddAction = (action: DrawAction) => {
    if (socketRef.current && activeRoomCode) {
      socketRef.current.emit('whiteboard_add_action', {
        roomCode: activeRoomCode,
        action: action
      });
    }
  };

  const handleTextSubmit = (value: string) => {
    if (value.trim()) {
      historyStack.current.push(JSON.parse(JSON.stringify(drawHistory.current)));
      if (historyStack.current.length > 50) historyStack.current.shift();
      undoStack.current = [];

      const action: DrawAction = {
        tool: 'text',
        color: brushColor,
        size: brushSize,
        startX: textInput.x,
        startY: textInput.y,
        text: value,
        fontSize: textFontSize,
        fontFamily: textFont,
      };
      drawHistory.current.push(action);
      redrawCanvas();
      syncAddAction(action);
    }
    setTextInput({ x: 0, y: 0, visualX: 0, visualY: 0, visible: false });
  };

  const handleUndo = () => {
    if (historyStack.current.length === 0) return;
    undoStack.current.push(JSON.parse(JSON.stringify(drawHistory.current)));
    drawHistory.current = historyStack.current.pop()!;
    redrawCanvas();
    syncWhiteboard();
  };

  const handleRedo = () => {
    if (undoStack.current.length === 0) return;
    historyStack.current.push(JSON.parse(JSON.stringify(drawHistory.current)));
    drawHistory.current = undoStack.current.pop()!;
    redrawCanvas();
    syncWhiteboard();
  };

  const handleClearCanvas = () => {
    historyStack.current.push(JSON.parse(JSON.stringify(drawHistory.current)));
    if (historyStack.current.length > 50) historyStack.current.shift();
    drawHistory.current = [];
    undoStack.current = [];
    redrawCanvas();
    syncWhiteboard();
  };

  const handleColorChange = (newColor: string) => {
    setBrushColor(newColor);
    if (selectedActionIndex !== null && drawHistory.current[selectedActionIndex]) {
      historyStack.current.push(JSON.parse(JSON.stringify(drawHistory.current)));
      if (historyStack.current.length > 50) historyStack.current.shift();
      undoStack.current = [];
      drawHistory.current[selectedActionIndex].color = newColor;
      redrawCanvas();
      syncWhiteboard();
    }
  };

  const handleCreateRoomClick = () => {
    setCurrentView('create');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setUsername('');
    setRoomName('');
    setJoinError('');
    setShowJoinName(false);
    setJoinUsername('');
  };

  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && roomName.trim() && socketRef.current) {
      socketRef.current.emit('create_room', {
        username: username.trim(),
        roomName: roomName.trim()
      });
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim() && !showJoinName) {
      setShowJoinName(true);
      return;
    }
    if (roomCode.trim() && joinUsername.trim() && socketRef.current) {
      socketRef.current.emit('join_room', {
        username: joinUsername.trim(),
        roomCode: roomCode.trim()
      });
    }
  };

  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
    setActiveRoomCode('');
    setActiveRoomName('');
    setUsers([]);
    setUsername('');
    setRoomName('');
    setRoomCode('');
    setJoinUsername('');
    setShowJoinName(false);
    drawHistory.current = [];
    undoStack.current = [];
    setCurrentView('home');
  };

  const handleKickUser = (targetUserId: string) => {
    if (socketRef.current && activeRoomCode) {
      socketRef.current.emit('kick_user', {
        roomCode: activeRoomCode,
        targetUserId
      });
      setSelectedUserId(null);
    }
  };

  const handleToggleAccess = (targetUserId: string, canDraw: boolean) => {
    if (socketRef.current && activeRoomCode) {
      socketRef.current.emit('toggle_draw_access', {
        roomCode: activeRoomCode,
        targetUserId,
        canDraw
      });
      setSelectedUserId(null);
    }
  };

  const currentSocketId = socketRef.current?.id;
  const currentUser = users.find(u => u.id === currentSocketId);
  const isCurrentUserHost = currentUser?.isHost;
  const canDrawUser = currentUser?.isHost || currentUser?.canDraw;

  const handleUserClick = (userId: string, isMe: boolean) => {
    if (isCurrentUserHost && !isMe) {
      setSelectedUserId(selectedUserId === userId ? null : userId);
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(activeRoomCode);
  };

  const colors = ['#18181B', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];

  return (
    <>
      {/* Loading Screen */}
      <div className={`loading-screen ${!isLoading ? 'hidden' : ''}`}>
        <div className="loading-content">
          <img src={logo} alt="Sketcha Loading" className="loading-logo" />
          <div className="progress-bar-container">
            <div className="progress-bar"></div>
          </div>
        </div>
      </div>

      {/* Main Application */}
      <div className={`app-container ${!isLoading ? 'loaded' : ''}`}>

        {/* Soft, minimal background blobs */}
        <div className="bg-elements">
          <div className="bg-blob blob-primary"></div>
          <div className="bg-blob blob-secondary"></div>
        </div>

        {/* Logo at the top left - No Header */}
        <div className="top-logo-container">
          <img src={logo} alt="Sketcha Logo" className="logo-img" />
          {/* <span className="logo-text">sketcha</span> */}
        </div>

        {/* Main Content */}
        <main className="main-content slider-container">

          {/* Back Button (Fixed on the left) */}
          <button
            className={`global-back-btn ${currentView === 'create' ? 'visible' : ''}`}
            onClick={handleBackToHome}
            aria-label="Go back"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <LandingUI
            currentView={currentView}
            handleCreateRoomClick={handleCreateRoomClick}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            showJoinName={showJoinName}
            joinUsername={joinUsername}
            setJoinUsername={setJoinUsername}
            handleJoinRoom={handleJoinRoom}
            joinError={joinError}
            username={username}
            setUsername={setUsername}
            roomName={roomName}
            setRoomName={setRoomName}
            handleCreateRoomSubmit={handleCreateRoomSubmit}
          />

          {/* ===== WORKSPACE VIEW ===== */}
          <div className={`slider-view view-workspace ${currentView === 'workspace' ? 'active' : 'inactive-right'}`}>
            <div className="workspace-container">
              <div className="workspace-body">
                {/* Canvas Area with Toolbar */}
                <div className="canvas-area">
                  {/* Floating Toolbar */}
                  <div className={`canvas-toolbar ${canDrawUser ? 'visible' : 'hidden'}`}>
                    {/* Tool Buttons */}
                    <div className="toolbar-group">
                      <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')} title="Select & Move">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" />
                        </svg>
                      </button>
                      <button className={`tool-btn ${activeTool === 'pencil' ? 'active' : ''}`} onClick={() => setActiveTool('pencil')} title="Pencil">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`} onClick={() => setActiveTool('line')} title="Line">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5" /></svg>
                      </button>
                      <button className={`tool-btn ${activeTool === 'rect' ? 'active' : ''}`} onClick={() => setActiveTool('rect')} title="Rectangle">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        </svg>
                      </button>
                      <button className={`tool-btn ${activeTool === 'circle' ? 'active' : ''}`} onClick={() => setActiveTool('circle')} title="Circle">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                      </button>
                      <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool('text')} title="Text">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 7 4 4 20 4 20 7" /><line x1="9.5" y1="20" x2="14.5" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
                        </svg>
                      </button>
                      <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} onClick={() => setActiveTool('eraser')} title="Eraser">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 20H7L3 16a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l6.6 6.6a1 1 0 0 1 0 1.4L14 20" />
                        </svg>
                      </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    {/* Colors */}
                    <div className="toolbar-group toolbar-colors">
                      {colors.map(c => (
                        <button
                          key={c}
                          className={`color-btn ${brushColor === c ? 'active' : ''}`}
                          style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #d4d4d8' : 'none' }}
                          onClick={() => handleColorChange(c)}
                        />
                      ))}
                      <label className={`color-btn custom-color-picker ${!colors.includes(brushColor) ? 'active' : ''}`} style={{ backgroundColor: !colors.includes(brushColor) ? brushColor : '#f4f4f5', border: '1px solid #d4d4d8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }} title="Custom Color & Eyedropper">
                        {!colors.includes(brushColor) ? null : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
                        <input type="color" value={brushColor} onChange={(e) => handleColorChange(e.target.value)} style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer', inset: 0 }} />
                      </label>
                    </div>

                    <div className="toolbar-divider"></div>

                    {/* Brush Size (if not text tool and no text selected) */}
                    {activeTool !== 'text' && !(activeTool === 'select' && selectedActionIndex !== null && drawHistory.current[selectedActionIndex]?.tool === 'text') && (
                      <>
                        <div className="toolbar-group toolbar-size">
                          <input
                            type="range"
                            min="1"
                            max="50"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            className="size-slider"
                          />
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(parseInt(e.target.value) || 1)}
                            className="size-input"
                            title="Brush size (px)"
                          />
                        </div>
                        <div className="toolbar-divider"></div>
                      </>
                    )}

                    {/* Text Formatting (if text tool) */}
                    {activeTool === 'text' && (
                      <>
                        <div className="toolbar-group">
                          <select
                            className="font-select"
                            value={textFont}
                            onChange={(e) => setTextFont(e.target.value)}
                            title="Font Family"
                          >
                            {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                          </select>
                          <input
                            type="number"
                            min="8"
                            max="200"
                            value={textFontSize}
                            onChange={(e) => setTextFontSize(parseInt(e.target.value) || 24)}
                            className="size-input"
                            title="Font size (px)"
                          />
                        </div>
                        <div className="toolbar-divider"></div>
                      </>
                    )}

                    {/* Edit selected text properties */}
                    {activeTool === 'select' && selectedActionIndex !== null && drawHistory.current[selectedActionIndex]?.tool === 'text' && (
                      <>
                        <div className="toolbar-group">
                          <select
                            className="font-select"
                            value={drawHistory.current[selectedActionIndex]?.fontFamily || 'Arial'}
                            onChange={(e) => {
                              const snap = JSON.parse(JSON.stringify(drawHistory.current));
                              historyStack.current.push(snap);
                              if (historyStack.current.length > 50) historyStack.current.shift();
                              undoStack.current = [];
                              drawHistory.current[selectedActionIndex!].fontFamily = e.target.value;
                              redrawCanvas();
                              syncWhiteboard();
                              forceRender(n => n + 1);
                            }}
                            title="Font Family"
                          >
                            {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                          </select>
                          <input
                            type="number"
                            min="8"
                            max="200"
                            value={drawHistory.current[selectedActionIndex]?.fontSize || 24}
                            onChange={(e) => {
                              const snap = JSON.parse(JSON.stringify(drawHistory.current));
                              historyStack.current.push(snap);
                              if (historyStack.current.length > 50) historyStack.current.shift();
                              undoStack.current = [];
                              drawHistory.current[selectedActionIndex!].fontSize = parseInt(e.target.value) || 24;
                              redrawCanvas();
                              syncWhiteboard();
                              forceRender(n => n + 1);
                            }}
                            className="size-input"
                            title="Font size (px)"
                          />
                        </div>
                        <div className="toolbar-divider"></div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="toolbar-group">
                      <button className="tool-btn" onClick={handleUndo} title="Undo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      </button>
                      <button className="tool-btn" onClick={handleRedo} title="Redo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
                        </svg>
                      </button>
                      <button className="tool-btn tool-btn-danger" onClick={handleClearCanvas} title="Clear Canvas">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* The Actual Canvas */}
                  <canvas
                    ref={canvasRef}
                    className="drawing-canvas"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onTouchStart={handleCanvasMouseDown}
                    onTouchMove={handleCanvasMouseMove}
                    onTouchEnd={handleCanvasMouseUp}
                    onTouchCancel={handleCanvasMouseUp}
                    style={{ cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'text' ? 'text' : 'crosshair' }}
                  />

                  {/* Floating Text Input */}
                  {textInput.visible && (
                    <input
                      ref={textInputRef}
                      className="canvas-text-input"
                      type="text"
                      placeholder="Type here..."
                      style={{ left: textInput.visualX, top: textInput.visualY - 20 }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTextSubmit((e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setTextInput({ x: 0, y: 0, visualX: 0, visualY: 0, visible: false });
                      }}
                      onInput={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        if (socketRef.current && activeRoomCode) {
                          const previewAction: DrawAction = {
                            tool: 'text', color: brushColor, size: brushSize,
                            startX: textInput.x, startY: textInput.y,
                            text: val || ' ', fontSize: textFontSize, fontFamily: textFont,
                          };
                          socketRef.current.emit('whiteboard_drawing', {
                            roomCode: activeRoomCode,
                            action: previewAction
                          });
                        }
                      }}
                      onBlur={(e) => handleTextSubmit(e.target.value)}
                    />
                  )}

                  {/* Active Drawers Indicator */}
                  {activeDrawers.length > 0 && (
                    <div className="active-drawers">
                      {activeDrawers.map((drawer) => (
                        <div key={drawer.userId} className="active-drawer-chip">
                          <span className="drawer-avatar">
                            {drawer.userName.charAt(0).toUpperCase()}
                          </span>
                          <span className="drawer-name">{drawer.userName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Panel Toggle Button */}
                <button
                  className={`panel-toggle-btn ${!isPanelOpen ? 'closed' : ''}`}
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  title={isPanelOpen ? "Close Panel" : "Open Panel"}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isPanelOpen ? (
                      <polyline points="9 18 15 12 9 6" />
                    ) : (
                      <polyline points="15 18 9 12 15 6" />
                    )}
                  </svg>
                </button>

                {/* Right Panel */}
                <div className={`workspace-panel ${!isPanelOpen ? 'closed' : ''}`}>
                  {/* Room Info Section */}
                  <div className="panel-section panel-room-info">
                    <div className="panel-room-header">
                      <div className="panel-room-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="panel-room-name">{activeRoomName}</h2>
                        <p className="panel-room-status">
                          <span className="status-dot"></span>
                          Active Session
                        </p>
                      </div>
                    </div>

                    <div className="panel-invite-section">
                      <span className="panel-label">Invite Code</span>
                      <div className="panel-invite-code" onClick={copyInviteCode} title="Click to copy">
                        <span className="invite-code-text">{activeRoomCode}</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Members Section */}
                  <div className="panel-section panel-members">
                    <div className="panel-section-header">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                      </svg>
                      <span>Members</span>
                      <span className="member-count">{users.length}</span>
                    </div>

                    <ul className="users-list">
                      {/* Sort: host first */}
                      {[...users].sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0)).map((user) => {
                        const isMe = user.id === currentSocketId;
                        return (
                          <li
                            key={user.id}
                            className={`user-item-container ${isCurrentUserHost && !isMe ? 'clickable' : ''}`}
                            onClick={() => handleUserClick(user.id, isMe)}
                          >
                            <div className={`user-item ${user.isHost ? 'user-host' : ''} ${isMe ? 'user-me' : ''}`}>
                              <div className="user-avatar-wrapper">
                                {user.isHost && (
                                  <svg className="crown-icon" width="14" height="14" viewBox="0 0 24 24" fill="var(--color-primary)" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.5 18.5L4 8L8.5 12L12 4L15.5 12L20 8L21.5 18.5H2.5Z" />
                                  </svg>
                                )}
                                <div className="user-avatar" style={user.isHost ? { background: 'var(--color-primary)', boxShadow: '0 0 0 2px rgba(73, 76, 131, 0.2)' } : {}}>
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <div className="user-info">
                                <span className="user-name">
                                  {user.name} {isMe && <span className="text-you">(You)</span>}
                                </span>
                                <div className="user-badges">
                                  {user.isHost && <span className="host-badge">Host</span>}
                                  {(user.canDraw || user.isHost) && (
                                    <svg className="shield-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <title>Has Draw Access</title>
                                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                  )}
                                </div>
                              </div>

                              {/* Status Indicator */}
                              <span className="user-status-dot"></span>
                            </div>

                            {/* Inline Dropdown for Actions */}
                            {selectedUserId === user.id && (
                              <div className="user-action-dropdown" onClick={(e) => e.stopPropagation()}>
                                <button className="popup-btn" onClick={() => handleToggleAccess(user.id, !user.canDraw)} style={{ color: 'var(--color-primary)' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                  </svg>
                                  {user.canDraw ? 'Revoke Draw Access' : 'Grant Draw Access'}
                                </button>
                                <button className="popup-btn popup-kick" onClick={() => handleKickUser(user.id)}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                  Kick from room
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Leave Button */}
                  <button className="btn-leave" onClick={handleLeaveRoom}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Leave Room
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>

        {/* Footer */}
        {currentView !== 'workspace' && (
          <footer className="footer">
            <p>
              &copy; {new Date().getFullYear()} Sketcha. Made by{' '}
              <a href="https://github.com/NikolaiPetrov31" target="_blank" rel="noreferrer" className="footer-link">
                Nikolai Petrov
              </a>
            </p>
          </footer>
        )}
      </div>
    </>
  );
}

export default App;
