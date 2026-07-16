import React from 'react';
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
  bottom: 24px;
  right: 24px;
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
  cursor: pointer;
  z-index: 99990;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  animation: ${fadeIn} 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: background 0.2s ease;

  &:active {
    transform: scale(0.92);
  }
`;

export const MobileTrigger = ({ mode = 'light', isActive, onActivate, onCancel }) => {
  const theme = getTheme(mode);

  return createPortal(
    <ThemeProvider theme={theme}>
      <TriggerButton
        $active={isActive}
        onClick={isActive ? onCancel : onActivate}
        aria-label={isActive ? '피드백 취소' : '피드백 보내기'}
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
