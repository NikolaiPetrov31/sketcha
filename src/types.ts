export interface User {
  id: string;
  name: string;
  isHost: boolean;
  canDraw?: boolean;
}

export type Tool = 'select' | 'pencil' | 'line' | 'rect' | 'circle' | 'text' | 'eraser';

export interface DrawAction {
  tool: Tool;
  color: string;
  size: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface Point {
  x: number;
  y: number;
}
