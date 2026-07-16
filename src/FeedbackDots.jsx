import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled, { ThemeProvider, keyframes, css } from 'styled-components';
import {
  X, Bug, Lightbulb, Zap, MessageSquare,
  Clock, User, FileCode, Layers, ZoomIn, Minimize2, Maximize2
} from 'lucide-react';
import { getTheme } from './theme.js';
import { formatPath } from './utils.js';
import { StatusBadge } from './components/StatusBadge.jsx';

// =====================================================================
// CONSTANTS
// =====================================================================

const FEEDBACK_STORAGE_KEY = 'react-feedback-data';
const DOT_SIZE = 20;
const TYPE_PIP_SIZE = 8;
const CLUSTER_THRESHOLD = 30;
const MINI_CARD_WIDTH = 240;
const POPOVER_WIDTH = 340;
const POPOVER_MAX_HEIGHT = 400;
const MARGIN = 10;
const HOVER_DELAY = 200;
const HOVER_LEAVE_DELAY = 100;
const FAN_OUT_RADIUS = 28;

const DOT_COLORS = {
  bug: '#ef4444',
  feature: '#10b981',
  improvement: '#3b82f6',
  other: '#8b5cf6',
};

const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'wontFix']);

const DOT_STATUSES = {
  new: { label: '신규', color: '#8b5cf6', bgColor: '#ede9fe', textColor: '#6d28d9', icon: 'Inbox' },
  open: { label: '열림', color: '#f59e0b', bgColor: '#fef3c7', textColor: '#92400e', icon: 'AlertCircle' },
  inProgress: { label: '진행중', color: '#3b82f6', bgColor: '#dbeafe', textColor: '#1e40af', icon: 'Play' },
  underReview: { label: '검토중', color: '#06b6d4', bgColor: '#cffafe', textColor: '#0e7490', icon: 'Eye' },
  resolved: { label: '해결됨', color: '#10b981', bgColor: '#d1fae5', textColor: '#065f46', icon: 'CheckCircle' },
  closed: { label: '닫힘', color: '#64748b', bgColor: '#e2e8f0', textColor: '#334155', icon: 'Archive' },
};

// =====================================================================
// ANIMATIONS
// =====================================================================

const dotAppear = keyframes`
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
`;

const breathe = keyframes`
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
`;

const miniCardAppear = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const popoverSlideRight = keyframes`
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
`;

const popoverSlideLeft = keyframes`
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
`;

const highlightAppear = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const highlightPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const toolbarSlideUp = keyframes`
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

// =====================================================================
// STYLED COMPONENTS — Container & Dots
// =====================================================================

const DotsContainer = styled.div`
  position: absolute;
  top: 0; left: 0; width: 0; height: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 99990;
`;

const DotWrapper = styled.div`
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
  animation: ${dotAppear} 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);

  &:focus-visible {
    outline: 2px solid ${p => p.theme.colors.dotFocusRing};
    outline-offset: 3px;
    border-radius: 50%;
  }
  &:focus:not(:focus-visible) { outline: none; }
`;

const AvatarDot = styled.div`
  position: relative;
  width: ${DOT_SIZE}px; height: ${DOT_SIZE}px;
  border-radius: 50%;
  transition: transform 0.15s ease-out;
  ${p => !p.$resolved && css`animation: ${breathe} 3s ease-in-out infinite;`}
  ${p => p.$resolved && css`opacity: 0.5; filter: saturate(0.4);`}

  &:hover { transform: scale(1.15); }
`;

const AvatarImage = styled.img`
  width: ${DOT_SIZE}px; height: ${DOT_SIZE}px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid ${p => p.$color};
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  display: block;
`;

const AvatarFallback = styled.div`
  width: ${DOT_SIZE}px; height: ${DOT_SIZE}px;
  border-radius: 50%;
  background: ${p => p.$color};
  border: 1.5px solid ${p => p.theme.colors.dotBorder};
  display: flex; align-items: center; justify-content: center;
  color: white;
  font-size: 9px; font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  text-transform: uppercase;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
`;

const TypePip = styled.div`
  position: absolute;
  bottom: -1px; right: -1px;
  width: ${TYPE_PIP_SIZE}px; height: ${TYPE_PIP_SIZE}px;
  border-radius: 50%;
  background: ${p => p.$color};
  border: 1.5px solid ${p => p.theme.colors.dotBorder};
`;

// =====================================================================
// STYLED COMPONENTS — Cluster
// =====================================================================

const ClusterDot = styled.div`
  width: 24px; height: 24px;
  border-radius: 50%;
  background: ${p => p.theme.colors.dotClusterBg};
  border: 2px solid ${p => p.theme.colors.dotBorder};
  display: flex; align-items: center; justify-content: center;
  color: ${p => p.theme.colors.dotClusterText};
  font-size: 11px; font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: transform 0.15s ease-out;

  &:hover { transform: scale(1.15); }
`;

const FanOutDot = styled.div`
  position: absolute;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) ${p => p.$delay}ms,
              opacity 0.2s ease ${p => p.$delay}ms;
  opacity: ${p => p.$expanded ? 1 : 0};
  transform: ${p => p.$expanded
    ? `translate(${p.$tx}px, ${p.$ty}px)`
    : 'translate(0, 0) scale(0.5)'};
`;

// =====================================================================
// STYLED COMPONENTS — Element Highlight
// =====================================================================

const ElementHighlight = styled.div`
  position: absolute;
  border: 2px solid ${p => p.$color || '#3b82f6'};
  background: ${p => (p.$color || '#3b82f6') + '08'};
  pointer-events: none;
  z-index: 99989;
  border-radius: 4px;
  animation: ${highlightAppear} 0.2s ease-out, ${highlightPulse} 2s ease-in-out infinite 0.2s;
  box-shadow: 0 0 0 4px ${p => (p.$color || '#3b82f6') + '15'};
`;

// =====================================================================
// STYLED COMPONENTS — Mini Card (hover)
// =====================================================================

const MiniCard = styled.div`
  position: absolute;
  width: ${MINI_CARD_WIDTH}px;
  background: ${p => p.theme.colors.dotMiniCardBg};
  border: 1px solid ${p => p.theme.colors.dotMiniCardBorder};
  border-radius: 10px;
  box-shadow: 0 8px 24px ${p => p.theme.colors.dotMiniCardShadow};
  padding: 10px 12px;
  pointer-events: none;
  z-index: 99991;
  animation: ${miniCardAppear} 0.15s ease-out;
  display: flex; flex-direction: column; gap: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const MiniCardHeader = styled.div`
  display: flex; align-items: center; gap: 6px;
`;

const MiniCardAvatar = styled.img`
  width: 24px; height: 24px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  border: 1px solid ${p => p.theme.colors.border};
`;

const MiniCardAvatarFallback = styled.div`
  width: 24px; height: 24px; border-radius: 50%;
  background: ${p => p.$color};
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 10px; font-weight: 700; flex-shrink: 0;
  text-transform: uppercase;
`;

const MiniCardName = styled.span`
  font-size: 13px; font-weight: 600;
  color: ${p => p.theme.colors.textPrimary};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 120px;
`;

const MiniCardSep = styled.span`
  width: 3px; height: 3px; border-radius: 50%;
  background: ${p => p.theme.colors.textTertiary};
  flex-shrink: 0;
`;

const MiniCardTime = styled.span`
  font-size: 11px; color: ${p => p.theme.colors.textTertiary};
  white-space: nowrap;
`;

const MiniCardTypePill = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 600; text-transform: capitalize;
  background: ${p => p.$color}15;
  color: ${p => p.$color};
  align-self: flex-start;
`;

const MiniCardText = styled.p`
  margin: 0;
  font-size: 12px; line-height: 1.4;
  color: ${p => p.theme.colors.textSecondary};
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
`;

const MiniCardChip = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 6px; border-radius: 4px;
  background: ${p => p.theme.colors.hoverBg};
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 10px; color: #10b981;
  align-self: flex-start;
`;

// =====================================================================
// STYLED COMPONENTS — Popover
// =====================================================================

const PopoverContainer = styled.div`
  position: absolute;
  width: ${POPOVER_WIDTH}px;
  max-height: ${POPOVER_MAX_HEIGHT}px;
  background: ${p => p.theme.colors.dotPopoverBg};
  border: 1px solid ${p => p.theme.colors.dotPopoverBorder};
  border-radius: 14px;
  box-shadow: 0 16px 48px ${p => p.theme.colors.dotPopoverShadow};
  z-index: 99992;
  overflow: hidden;
  animation: ${p => p.$direction === 'left' ? popoverSlideLeft : popoverSlideRight} 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex; flex-direction: column;
`;

const PopoverHeader = styled.div`
  padding: 14px 16px;
  display: flex; align-items: flex-start; gap: 10px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.headerBg};
  flex-shrink: 0;
`;

const PopoverAvatar = styled.img`
  width: 32px; height: 32px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  border: 2px solid ${p => p.$color};
`;

const PopoverAvatarFallback = styled.div`
  width: 32px; height: 32px; border-radius: 50%;
  background: ${p => p.$color};
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 13px; font-weight: 700; flex-shrink: 0;
  text-transform: uppercase;
`;

const PopoverNameStack = styled.div`
  display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;
`;

const PopoverName = styled.span`
  font-size: 14px; font-weight: 600;
  color: ${p => p.theme.colors.textPrimary};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;

const PopoverSubline = styled.span`
  font-size: 11px; color: ${p => p.theme.colors.textTertiary};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; gap: 4px;
`;

const PopoverTypeBadge = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 10px;
  font-size: 11px; font-weight: 600; text-transform: capitalize;
  background: ${p => p.$color}15;
  color: ${p => p.$color};
  flex-shrink: 0; align-self: center;
`;

const PopoverCloseBtn = styled.button`
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  color: ${p => p.theme.colors.textTertiary};
  cursor: pointer; flex-shrink: 0; transition: all 0.15s;

  &:hover {
    background: ${p => p.theme.colors.hoverBg};
    color: ${p => p.theme.colors.textPrimary};
  }
`;

const PopoverBody = styled.div`
  padding: 14px 16px;
  overflow-y: auto;
  flex: 1;
  display: flex; flex-direction: column; gap: 12px;
`;

const PopoverText = styled.p`
  margin: 0;
  font-size: 14px; line-height: 1.6;
  color: ${p => p.theme.colors.textPrimary};
  word-break: break-word;
`;

const PopoverDivider = styled.div`
  height: 1px;
  background: ${p => p.theme.colors.border};
`;

const PopoverChips = styled.div`
  display: flex; flex-direction: column; gap: 6px;
`;

const PopoverChip = styled.span`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 6px;
  background: ${p => p.theme.colors.hoverBg};
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px; font-weight: 500;
  color: ${p => p.$accent || p.theme.colors.textSecondary};
  align-self: flex-start;

  svg { flex-shrink: 0; }
`;

const PopoverScreenshotWrap = styled.div`
  border-radius: 8px; overflow: hidden;
  border: 1px solid ${p => p.theme.colors.border};
  position: relative; cursor: pointer;

  img {
    width: 100%; max-height: 120px; object-fit: cover;
    display: block; transition: transform 0.3s ease;
  }
  &:hover img { transform: scale(1.05); }
`;

const PopoverScreenshotZoom = styled.div`
  position: absolute; top: 6px; right: 6px;
  background: rgba(0,0,0,0.5); border-radius: 4px; padding: 4px;
  color: white; display: flex; opacity: 0; transition: opacity 0.15s;
  ${PopoverScreenshotWrap}:hover & { opacity: 1; }
`;

const PopoverFooter = styled.div`
  padding: 8px 16px;
  border-top: 1px solid ${p => p.theme.colors.border};
  background: ${p => p.theme.colors.headerBg};
  flex-shrink: 0;
`;

const PopoverSelectorPath = styled.span`
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 10px; color: ${p => p.theme.colors.textTertiary};
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: block;
`;

// =====================================================================
// STYLED COMPONENTS — Toolbar
// =====================================================================

const Toolbar = styled.div`
  position: fixed;
  bottom: 20px; left: 50%;
  transform: translateX(-50%);
  height: 40px; border-radius: 20px;
  background: ${p => p.theme.colors.dotToolbarBg};
  border: 1px solid ${p => p.theme.colors.dotToolbarBorder};
  box-shadow: 0 8px 32px ${p => p.theme.colors.dotToolbarShadow};
  backdrop-filter: blur(12px);
  padding: 4px 6px;
  display: flex; align-items: center; gap: 2px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 99993;
  pointer-events: auto;
  animation: ${toolbarSlideUp} 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
`;

const ToolbarCount = styled.span`
  padding: 4px 10px; border-radius: 12px;
  background: ${p => p.theme.colors.dotClusterBg};
  color: ${p => p.theme.colors.dotClusterText};
  font-size: 12px; font-weight: 700;
`;

const ToolbarDivider = styled.div`
  width: 1px; height: 20px;
  background: ${p => p.theme.colors.border};
  margin: 0 4px;
`;

const ToolbarPill = styled.button`
  padding: 4px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 600;
  cursor: pointer; border: none;
  transition: all 0.15s;
  display: inline-flex; align-items: center; gap: 4px;
  background: ${p => p.$active ? (p.$color + '18') : 'transparent'};
  color: ${p => p.$active ? p.$color : p.theme.colors.textTertiary};

  &:hover {
    background: ${p => p.$color + '12'};
    color: ${p => p.$color};
  }
`;

const ToolbarHint = styled.span`
  font-size: 10px; color: ${p => p.theme.colors.textTertiary};
  white-space: nowrap; padding: 0 4px;
`;

const ToolbarBtn = styled.button`
  width: 28px; height: 28px; border-radius: 50%;
  background: transparent; border: none; cursor: pointer;
  color: ${p => p.theme.colors.textTertiary};
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;

  &:hover {
    background: ${p => p.theme.colors.hoverBg};
    color: ${p => p.theme.colors.textPrimary};
  }
`;

// =====================================================================
// HELPERS
// =====================================================================

const getInitial = (name) => {
  if (!name) return '?';
  return name.trim()[0]?.toUpperCase() || '?';
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
};

const getTypeIcon = (type, size = 10) => {
  switch (type) {
    case 'bug': return <Bug size={size} />;
    case 'feature': return <Lightbulb size={size} />;
    case 'improvement': return <Zap size={size} />;
    default: return <MessageSquare size={size} />;
  }
};

const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

const isResolved = (status) => RESOLVED_STATUSES.has(status);

// Normalize a single item from any format (DB or widget) into the widget format
const normalizeItem = (item, index) => {
  if (!item) return null;

  // Already in widget format
  if (item.dotPosition && item.elementInfo?.selector) return item;

  const normalized = { ...item };
  const issues = [];

  // Map DB snake_case dot_position_x/y → widget dotPosition
  if (!normalized.dotPosition && (normalized.dot_position_x != null && normalized.dot_position_y != null)) {
    normalized.dotPosition = {
      relativeX: normalized.dot_position_x,
      relativeY: normalized.dot_position_y,
    };
  }

  // Map DB user_avatar → widget userAvatar
  if (!normalized.userAvatar && normalized.user_avatar) {
    normalized.userAvatar = normalized.user_avatar;
  }

  // Map DB username/useremail → widget userName/userEmail
  if (!normalized.userName && normalized.username) normalized.userName = normalized.username;
  if (!normalized.userEmail && normalized.useremail) normalized.userEmail = normalized.useremail;

  // Map DB createdat → widget timestamp
  if (!normalized.timestamp && normalized.createdat) normalized.timestamp = normalized.createdat;

  // Parse elementinfo from JSON string if needed
  if (!normalized.elementInfo && normalized.elementinfo) {
    try {
      normalized.elementInfo = typeof normalized.elementinfo === 'string'
        ? JSON.parse(normalized.elementinfo)
        : normalized.elementinfo;
    } catch { issues.push('elementinfo is not valid JSON'); }
  }

  // Parse viewport from JSON string if needed
  if (normalized.viewport && typeof normalized.viewport === 'string') {
    try { normalized.viewport = JSON.parse(normalized.viewport); } catch { /* skip */ }
  }

  // Map DB status values (with underscores) to widget format (camelCase)
  if (normalized.status === 'in_progress') normalized.status = 'inProgress';

  // --- Validation logging ---
  if (!normalized.dotPosition) issues.push('missing dotPosition (and no dot_position_x/dot_position_y)');
  if (!normalized.elementInfo) issues.push('missing elementInfo (and no elementinfo)');
  else if (!normalized.elementInfo.selector) issues.push('elementInfo exists but has no .selector');

  if (issues.length > 0) {
    console.warn(
      `[FeedbackDots] Item ${index ?? '?'} (id: ${item.id || 'unknown'}) skipped:`,
      issues.join('; '),
      '\n  Available keys:', Object.keys(item).join(', ')
    );
  }

  return normalized;
};

const loadFeedbackFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!stored) return [];
    const all = JSON.parse(stored);
    return all
      .map((item, i) => normalizeItem(item, i))
      .filter(item => item && item.dotPosition && item.elementInfo?.selector);
  } catch { return []; }
};

const calcDotPos = (item) => {
  try {
    const el = document.querySelector(item.elementInfo.selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: r.left + window.pageXOffset + r.width * item.dotPosition.relativeX - DOT_SIZE / 2,
      top: r.top + window.pageYOffset + r.height * item.dotPosition.relativeY - DOT_SIZE / 2,
    };
  } catch { return null; }
};

const getHighlightRect = (selector) => {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left + window.pageXOffset, top: r.top + window.pageYOffset, width: r.width, height: r.height };
  } catch { return null; }
};

const clusterDots = (items, positions) => {
  const clusters = [];
  const assigned = new Set();
  const withPos = items.filter(i => positions.has(i.id)).map(i => ({ item: i, pos: positions.get(i.id) }));

  for (let i = 0; i < withPos.length; i++) {
    if (assigned.has(withPos[i].item.id)) continue;
    const cluster = [withPos[i]];
    assigned.add(withPos[i].item.id);

    for (let j = i + 1; j < withPos.length; j++) {
      if (assigned.has(withPos[j].item.id)) continue;
      const dx = withPos[i].pos.left - withPos[j].pos.left;
      const dy = withPos[i].pos.top - withPos[j].pos.top;
      if (Math.sqrt(dx * dx + dy * dy) <= CLUSTER_THRESHOLD) {
        cluster.push(withPos[j]);
        assigned.add(withPos[j].item.id);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
};

const getPopoverPosition = (dotLeft, dotTop) => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const sx = window.pageXOffset, sy = window.pageYOffset;
  const dvx = dotLeft - sx, dvy = dotTop - sy;

  let left, direction;
  if (dvx + DOT_SIZE + MARGIN + POPOVER_WIDTH <= vw) {
    left = dotLeft + DOT_SIZE + MARGIN; direction = 'right';
  } else {
    left = dotLeft - POPOVER_WIDTH - MARGIN; direction = 'left';
  }

  let top = dvy + POPOVER_MAX_HEIGHT <= vh ? dotTop : dotTop - POPOVER_MAX_HEIGHT + DOT_SIZE;
  left = Math.max(sx + MARGIN, Math.min(left, sx + vw - POPOVER_WIDTH - MARGIN));
  top = Math.max(sy + MARGIN, Math.min(top, sy + vh - POPOVER_MAX_HEIGHT - MARGIN));

  return { left, top, direction };
};

const getMiniCardPos = (dotLeft, dotTop) => {
  const vw = window.innerWidth, sx = window.pageXOffset;
  const dvx = dotLeft - sx;
  let left = dvx + DOT_SIZE + 8 + MINI_CARD_WIDTH <= vw
    ? DOT_SIZE + 8
    : -MINI_CARD_WIDTH - 8;
  return { left, top: -4 };
};

// =====================================================================
// COMPONENT
// =====================================================================

export const FeedbackDots = ({ mode = 'light', isDeveloper = false, data = null, visible = true }) => {
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [positions, setPositions] = useState(new Map());
  const [hoveredDotId, setHoveredDotId] = useState(null);
  const [showMiniCard, setShowMiniCard] = useState(false);
  const [highlightRect, setHighlightRect] = useState(null);
  const [highlightColor, setHighlightColor] = useState(null);
  const [activeDotId, setActiveDotId] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);
  const [popoverDir, setPopoverDir] = useState('right');
  const [expandedClusterId, setExpandedClusterId] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [toolbarMinimized, setToolbarMinimized] = useState(false);

  const rafRef = useRef(null);
  const hoverEnterRef = useRef(null);
  const hoverLeaveRef = useRef(null);
  const theme = getTheme(mode);

  // --- Data loading: merge props data + localStorage ---
  const loadData = useCallback(() => {
    const localItems = loadFeedbackFromLocalStorage();

    // Normalize and filter props data
    let propsItems = [];
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[FeedbackDots] Props data received: ${data.length} items`);
      // Log first item's raw shape for debugging
      const first = data[0];
      console.log(`[FeedbackDots] First item raw keys:`, Object.keys(first).join(', '));
      console.log(`[FeedbackDots] First item dotPosition:`, first.dotPosition, `| dot_position_x:`, first.dot_position_x, `| elementInfo:`, typeof first.elementInfo, `| elementinfo:`, typeof first.elementinfo);
      const normalized = data.map((item, i) => normalizeItem(item, i));
      propsItems = normalized.filter(item => item && item.dotPosition && item.elementInfo?.selector);
      const skipped = data.length - propsItems.length;
      if (skipped > 0) {
        console.warn(`[FeedbackDots] ${skipped}/${data.length} props items skipped (missing dotPosition or elementInfo.selector)`);
      }
    } else if (data && !Array.isArray(data)) {
      console.error('[FeedbackDots] feedbackDotsData must be an array, got:', typeof data);
    }

    // Merge: props data first, then localStorage, dedupe by id
    const seen = new Set();
    const merged = [];
    for (const item of [...propsItems, ...localItems]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }

    console.log(`[FeedbackDots] Total items to render: ${merged.length} (${propsItems.length} from props, ${localItems.length} from localStorage)`);
    setFeedbackItems(merged);
  }, [data]);

  useEffect(() => {
    loadData();
    const h = () => loadData();
    window.addEventListener('feedback-data-updated', h);
    window.addEventListener('popstate', h);
    return () => { window.removeEventListener('feedback-data-updated', h); window.removeEventListener('popstate', h); };
  }, [loadData]);

  // --- Filtering ---
  const filteredItems = useMemo(() => {
    let items = feedbackItems;
    if (typeFilter) items = items.filter(i => i.type === typeFilter);
    if (statusFilter === 'open') items = items.filter(i => !isResolved(i.status));
    if (statusFilter === 'resolved') items = items.filter(i => isResolved(i.status));
    return items;
  }, [feedbackItems, typeFilter, statusFilter]);

  // --- Position calculation ---
  const recalcPositions = useCallback(() => {
    const m = new Map();
    let found = 0, notFound = 0;
    filteredItems.forEach(i => {
      const p = calcDotPos(i);
      if (p) { m.set(i.id, p); found++; }
      else {
        notFound++;
        console.warn(
          `[FeedbackDots] Element not found for item ${i.id}:`,
          `selector="${(i.elementInfo?.selector || '').slice(0, 80)}..."`,
          `— this element may not exist on the current page`
        );
      }
    });
    if (filteredItems.length > 0) {
      console.log(`[FeedbackDots] Positions: ${found} found, ${notFound} not found on page`);
    }
    setPositions(m);
  }, [filteredItems]);

  useEffect(() => {
    recalcPositions();
    const h = () => { if (rafRef.current) return; rafRef.current = requestAnimationFrame(() => { rafRef.current = null; recalcPositions(); }); };
    window.addEventListener('scroll', h, { passive: true });
    window.addEventListener('resize', h, { passive: true });
    return () => { window.removeEventListener('scroll', h); window.removeEventListener('resize', h); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [recalcPositions]);

  // --- Clustering ---
  const clusters = useMemo(() => clusterDots(filteredItems, positions), [filteredItems, positions]);

  // --- Close popover on scroll / outside click ---
  useEffect(() => {
    if (!activeDotId) return;
    const h = () => { setActiveDotId(null); setHighlightRect(null); };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, [activeDotId]);

  useEffect(() => {
    if (!activeDotId) return;
    const h = (e) => { if (!e.target.closest('.feedback-dots-container')) { setActiveDotId(null); setPopoverPos(null); setHighlightRect(null); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [activeDotId]);

  // --- Escape key closes popover ---
  useEffect(() => {
    if (!activeDotId) return;
    const h = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setActiveDotId(null); setPopoverPos(null); setHighlightRect(null); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [activeDotId]);

  // --- Hover handlers with delay ---
  const handleDotEnter = useCallback((item) => {
    clearTimeout(hoverLeaveRef.current);
    hoverEnterRef.current = setTimeout(() => {
      setHoveredDotId(item.id);
      setShowMiniCard(true);
      const rect = getHighlightRect(item.elementInfo?.selector);
      setHighlightRect(rect);
      setHighlightColor(DOT_COLORS[item.type] || DOT_COLORS.other);
    }, HOVER_DELAY);
  }, []);

  const handleDotLeave = useCallback(() => {
    clearTimeout(hoverEnterRef.current);
    hoverLeaveRef.current = setTimeout(() => {
      setHoveredDotId(null);
      setShowMiniCard(false);
      if (!activeDotId) setHighlightRect(null);
    }, HOVER_LEAVE_DELAY);
  }, [activeDotId]);

  // --- Click handler ---
  const handleDotClick = useCallback((e, item) => {
    e.stopPropagation();
    clearTimeout(hoverEnterRef.current);
    setHoveredDotId(null);
    setShowMiniCard(false);

    const pos = positions.get(item.id);
    if (!pos) return;

    if (activeDotId === item.id) {
      setActiveDotId(null); setPopoverPos(null); setHighlightRect(null);
      return;
    }

    const p = getPopoverPosition(pos.left, pos.top);
    setPopoverPos(p); setPopoverDir(p.direction); setActiveDotId(item.id);
    const rect = getHighlightRect(item.elementInfo?.selector);
    setHighlightRect(rect); setHighlightColor(DOT_COLORS[item.type] || DOT_COLORS.other);
  }, [positions, activeDotId]);

  const handleKeyActivate = useCallback((e, item) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDotClick(e, item); }
  }, [handleDotClick]);

  const handleClosePopover = useCallback((e) => {
    e.stopPropagation();
    setActiveDotId(null); setPopoverPos(null); setHighlightRect(null);
  }, []);

  // --- Cluster click ---
  const handleClusterClick = useCallback((e, clusterId) => {
    e.stopPropagation();
    setExpandedClusterId(prev => prev === clusterId ? null : clusterId);
  }, []);

  // Close expanded cluster on outside click
  useEffect(() => {
    if (expandedClusterId === null) return;
    const h = (e) => { if (!e.target.closest('.feedback-dots-container')) setExpandedClusterId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [expandedClusterId]);

  // --- Render helpers ---
  const activeItem = activeDotId ? filteredItems.find(i => i.id === activeDotId) : null;
  const hoveredItem = hoveredDotId ? filteredItems.find(i => i.id === hoveredDotId) : null;
  const hoveredPos = hoveredDotId ? positions.get(hoveredDotId) : null;

  const typeCounts = useMemo(() => {
    const c = { bug: 0, feature: 0, improvement: 0, other: 0 };
    feedbackItems.forEach(i => { c[i.type] = (c[i.type] || 0) + 1; });
    return c;
  }, [feedbackItems]);

  // Data loading always runs. Only hide the UI when not visible.
  if (!visible) return null;

  const renderSingleDot = (item, pos, extraStyle) => {
    const dotColor = DOT_COLORS[item.type] || DOT_COLORS.other;
    const resolved = isResolved(item.status);

    return (
      <DotWrapper
        key={item.id}
        style={{ left: pos.left, top: pos.top, ...extraStyle }}
        tabIndex={0}
        role="button"
        aria-label={`Feedback by ${item.userName || 'Anonymous'}: ${(item.feedback || '').slice(0, 50)}`}
        data-feedback-dot={item.id}
        onMouseEnter={() => handleDotEnter(item)}
        onMouseLeave={handleDotLeave}
        onClick={(e) => handleDotClick(e, item)}
        onKeyDown={(e) => handleKeyActivate(e, item)}
      >
        <AvatarDot $resolved={resolved}>
          {item.userAvatar
            ? <AvatarImage src={item.userAvatar} alt="" $color={dotColor} />
            : <AvatarFallback $color={dotColor}>{getInitial(item.userName)}</AvatarFallback>}
          <TypePip $color={dotColor} />
        </AvatarDot>
      </DotWrapper>
    );
  };

  return createPortal(
    <ThemeProvider theme={theme}>
      <DotsContainer className="feedback-dots-container">

        {/* Element highlight */}
        {highlightRect && (
          <ElementHighlight $color={highlightColor} style={{ left: highlightRect.left, top: highlightRect.top, width: highlightRect.width, height: highlightRect.height }} />
        )}

        {/* Render clusters / individual dots */}
        {clusters.map((cluster, ci) => {
          if (cluster.length === 1) {
            const { item, pos } = cluster[0];
            return renderSingleDot(item, pos);
          }

          // Cluster
          const anchor = cluster[0].pos;
          const isExpanded = expandedClusterId === ci;

          return (
            <DotWrapper key={`cluster-${ci}`} style={{ left: anchor.left, top: anchor.top }}>
              {!isExpanded && (
                <ClusterDot onClick={(e) => handleClusterClick(e, ci)}>
                  {cluster.length}
                </ClusterDot>
              )}

              {isExpanded && cluster.map(({ item, pos: iPos }, di) => {
                const angle = (di / cluster.length) * 2 * Math.PI - Math.PI / 2;
                const tx = Math.cos(angle) * FAN_OUT_RADIUS;
                const ty = Math.sin(angle) * FAN_OUT_RADIUS;
                const dotColor = DOT_COLORS[item.type] || DOT_COLORS.other;
                const resolved = isResolved(item.status);

                return (
                  <FanOutDot key={item.id} $expanded $tx={tx} $ty={ty} $delay={di * 30}>
                    <div
                      style={{ cursor: 'pointer' }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Feedback by ${item.userName || 'Anonymous'}`}
                      onMouseEnter={() => handleDotEnter(item)}
                      onMouseLeave={handleDotLeave}
                      onClick={(e) => handleDotClick(e, item)}
                      onKeyDown={(e) => handleKeyActivate(e, item)}
                    >
                      <AvatarDot $resolved={resolved}>
                        {item.userAvatar
                          ? <AvatarImage src={item.userAvatar} alt="" $color={dotColor} />
                          : <AvatarFallback $color={dotColor}>{getInitial(item.userName)}</AvatarFallback>}
                        <TypePip $color={dotColor} />
                      </AvatarDot>
                    </div>
                  </FanOutDot>
                );
              })}
            </DotWrapper>
          );
        })}

        {/* Mini card on hover */}
        {showMiniCard && hoveredItem && hoveredPos && activeDotId !== hoveredDotId && (() => {
          const mc = getMiniCardPos(hoveredPos.left, hoveredPos.top);
          const dotColor = DOT_COLORS[hoveredItem.type] || DOT_COLORS.other;
          const comp = hoveredItem.elementInfo?.reactComponent || hoveredItem.component;

          return (
            <MiniCard style={{ left: hoveredPos.left + mc.left, top: hoveredPos.top + mc.top }}>
              <MiniCardHeader>
                {hoveredItem.userAvatar
                  ? <MiniCardAvatar src={hoveredItem.userAvatar} alt="" />
                  : <MiniCardAvatarFallback $color={dotColor}>{getInitials(hoveredItem.userName)}</MiniCardAvatarFallback>}
                <MiniCardName>{hoveredItem.userName || 'Anonymous'}</MiniCardName>
                <MiniCardSep />
                <MiniCardTime>{timeAgo(hoveredItem.timestamp)}</MiniCardTime>
              </MiniCardHeader>
              <MiniCardTypePill $color={dotColor}>
                {getTypeIcon(hoveredItem.type)}
                {hoveredItem.type || 'other'}
              </MiniCardTypePill>
              {hoveredItem.feedback && <MiniCardText>{hoveredItem.feedback}</MiniCardText>}
              {isDeveloper && comp && (
                <MiniCardChip><Layers size={10} />&lt;{comp}&gt;</MiniCardChip>
              )}
            </MiniCard>
          );
        })()}

        {/* Popover */}
        {activeItem && popoverPos && (
          <PopoverContainer $direction={popoverDir} style={{ left: popoverPos.left, top: popoverPos.top }} onClick={e => e.stopPropagation()}>
            <PopoverHeader>
              {activeItem.userAvatar
                ? <PopoverAvatar src={activeItem.userAvatar} alt="" $color={DOT_COLORS[activeItem.type] || DOT_COLORS.other} />
                : <PopoverAvatarFallback $color={DOT_COLORS[activeItem.type] || DOT_COLORS.other}>{getInitials(activeItem.userName)}</PopoverAvatarFallback>}
              <PopoverNameStack>
                <PopoverName>{activeItem.userName || 'Anonymous'}</PopoverName>
                <PopoverSubline>
                  {activeItem.userEmail && <span>{activeItem.userEmail}</span>}
                  {activeItem.userEmail && activeItem.timestamp && <span>·</span>}
                  {activeItem.timestamp && <span>{timeAgo(activeItem.timestamp)}</span>}
                </PopoverSubline>
              </PopoverNameStack>
              <PopoverTypeBadge $color={DOT_COLORS[activeItem.type] || DOT_COLORS.other}>
                {getTypeIcon(activeItem.type)}
                {activeItem.type || 'other'}
              </PopoverTypeBadge>
              <PopoverCloseBtn onClick={handleClosePopover}><X size={14} /></PopoverCloseBtn>
            </PopoverHeader>

            <PopoverBody>
              <PopoverText>{activeItem.feedback}</PopoverText>

              {(activeItem.elementInfo?.reactComponent || activeItem.component || activeItem.elementInfo?.sourceFile?.fileName || activeItem.status) && (
                <>
                  <PopoverDivider />
                  <PopoverChips>
                    {(activeItem.elementInfo?.reactComponent || activeItem.component) && (
                      <PopoverChip $accent="#10b981">
                        <Layers size={12} />
                        &lt;{activeItem.elementInfo?.reactComponent || activeItem.component}&gt;
                      </PopoverChip>
                    )}
                    {activeItem.elementInfo?.sourceFile?.fileName && (
                      <PopoverChip>
                        <FileCode size={12} />
                        {formatPath(activeItem.elementInfo.sourceFile.fileName)}
                        {activeItem.elementInfo.sourceFile.lineNumber && `:${activeItem.elementInfo.sourceFile.lineNumber}`}
                      </PopoverChip>
                    )}
                    {activeItem.status && (
                      <div><StatusBadge status={activeItem.status} statuses={DOT_STATUSES} /></div>
                    )}
                  </PopoverChips>
                </>
              )}

              {activeItem.screenshot && (
                <PopoverScreenshotWrap onClick={() => { const w = window.open('', '_blank'); if (w) w.document.write(`<img src="${activeItem.screenshot}" style="max-width:100%;height:auto;" />`); }}>
                  <img src={activeItem.screenshot} alt="Screenshot" />
                  <PopoverScreenshotZoom><ZoomIn size={14} /></PopoverScreenshotZoom>
                </PopoverScreenshotWrap>
              )}
            </PopoverBody>

            {activeItem.elementInfo?.selector && (
              <PopoverFooter>
                <PopoverSelectorPath>{activeItem.elementInfo.selector}</PopoverSelectorPath>
              </PopoverFooter>
            )}
          </PopoverContainer>
        )}
      </DotsContainer>

      {/* Toolbar */}
      {createPortal(
        <Toolbar className="feedback-dots-container">
          {toolbarMinimized ? (
            <>
              <ToolbarCount>{filteredItems.length}</ToolbarCount>
              <ToolbarBtn onClick={() => setToolbarMinimized(false)}><Maximize2 size={14} /></ToolbarBtn>
            </>
          ) : (
            <>
              <ToolbarCount>{filteredItems.length}</ToolbarCount>
              <ToolbarDivider />
              {['bug', 'feature', 'improvement', 'other'].map(t => (
                typeCounts[t] > 0 && (
                  <ToolbarPill key={t} $active={typeFilter === t} $color={DOT_COLORS[t]} onClick={() => setTypeFilter(prev => prev === t ? null : t)}>
                    {getTypeIcon(t)} {t}
                  </ToolbarPill>
                )
              ))}
              <ToolbarDivider />
              <ToolbarPill $active={statusFilter === 'open'} $color="#f59e0b" onClick={() => setStatusFilter(prev => prev === 'open' ? null : 'open')}>열림</ToolbarPill>
              <ToolbarPill $active={statusFilter === 'resolved'} $color="#10b981" onClick={() => setStatusFilter(prev => prev === 'resolved' ? null : 'resolved')}>해결됨</ToolbarPill>
              <ToolbarDivider />
              <ToolbarHint>Alt+D</ToolbarHint>
              <ToolbarBtn onClick={() => setToolbarMinimized(true)}><Minimize2 size={14} /></ToolbarBtn>
            </>
          )}
        </Toolbar>,
        document.body
      )}
    </ThemeProvider>,
    document.body
  );
};
