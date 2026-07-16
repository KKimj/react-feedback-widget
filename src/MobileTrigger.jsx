import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled, { ThemeProvider, keyframes } from 'styled-components';
import { MessageSquare } from 'lucide-react';
import { getTheme } from './theme.js';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
`;

const TriggerButton = styled.button`
  position: fixed;
  bottom: ${p => p.$bottom ?? 24}px;
  right: ${p => p.$right ?? 24}px;
  min-width: 52px;
  height: 52px;
  padding: ${p => p.$active ? '0' : '0 18px 0 15px'};
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 26px;
  border: none;
  background: ${p => p.$active ? '#ef4444' : p.theme.colors.btnPrimaryBg};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  z-index: 99990;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  animation: ${fadeIn} 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease;

  &:active {
    cursor: grabbing;
  }
`;

const STORAGE_KEY = 'qa-feedback-trigger-pos';

const loadPos = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// 드래그로 위치 이동 가능한 트리거. 드래그(이동)와 클릭(열기)을 moved 플래그로 구분한다.
// 이동한 위치는 localStorage 에 저장돼 새로고침 후에도 유지된다.
export const MobileTrigger = ({ mode = 'light', isActive, onActivate, onCancel, bottom = 24, right = 24 }) => {
  const theme = getTheme(mode);
  const [pos, setPos] = useState(loadPos);
  const drag = useRef({ active: false, moved: false, offsetX: 0, offsetY: 0 });

  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = {
      active: true,
      moved: false,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!drag.current.active) return;
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) drag.current.moved = true;
    const x = Math.max(4, Math.min(window.innerWidth - 56, e.clientX - drag.current.offsetX));
    const y = Math.max(4, Math.min(window.innerHeight - 56, e.clientY - drag.current.offsetY));
    setPos({ x, y });
  };

  const handlePointerUp = (e) => {
    if (drag.current.active && drag.current.moved && pos) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* localStorage 불가 시 무시 */ }
    }
    drag.current.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleClick = () => {
    // 드래그 직후의 click 은 무시(위치 이동일 뿐 열기 아님)
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    (isActive ? onCancel : onActivate)();
  };

  const posStyle = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined;

  return createPortal(
    <ThemeProvider theme={theme}>
      <TriggerButton
        $active={isActive}
        $bottom={bottom}
        $right={right}
        style={posStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        aria-label={isActive ? '피드백 취소' : '피드백 보내기 (드래그로 위치 이동)'}
      >
        {isActive
          ? <span style={{ fontSize: 22, lineHeight: 1 }}>✕</span>
          : <>
              <MessageSquare size={20} />
              <span>버그/의견</span>
            </>
        }
      </TriggerButton>
    </ThemeProvider>,
    document.body
  );
};
