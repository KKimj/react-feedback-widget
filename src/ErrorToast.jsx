import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const ToastContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
`;

const Toast = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 8px;
  background: ${props => props.$type === 'error' ? '#fef2f2' : props.$type === 'success' ? '#f0fdf4' : '#eff6ff'};
  border: 1px solid ${props => props.$type === 'error' ? '#fecaca' : props.$type === 'success' ? '#bbf7d0' : '#bfdbfe'};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 380px;
  min-width: 300px;
  pointer-events: auto;
  animation: ${props => props.$isLeaving ? slideOut : slideIn} 0.3s ease forwards;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const IconWrapper = styled.div`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$type === 'error' ? '#fee2e2' : props.$type === 'success' ? '#dcfce7' : '#dbeafe'};
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.$type === 'error' ? '#991b1b' : props.$type === 'success' ? '#166534' : '#1e40af'};
  margin-bottom: 2px;
`;

const Message = styled.div`
  font-size: 13px;
  color: ${props => props.$type === 'error' ? '#b91c1c' : props.$type === 'success' ? '#15803d' : '#1d4ed8'};
  word-break: break-word;
  line-height: 1.4;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin: -4px;
  color: ${props => props.$type === 'error' ? '#991b1b' : props.$type === 'success' ? '#166534' : '#1e40af'};
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`;

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const SuccessIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9,12 11,14 15,10" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ToastItem = ({ toast, onRemove }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const Icon = toast.type === 'error' ? ErrorIcon : toast.type === 'success' ? SuccessIcon : InfoIcon;

  return (
    <Toast $type={toast.type} $isLeaving={isLeaving}>
      <IconWrapper $type={toast.type}>
        <Icon />
      </IconWrapper>
      <Content>
        <Title $type={toast.type}>{toast.title}</Title>
        <Message $type={toast.type}>{toast.message}</Message>
      </Content>
      <CloseButton $type={toast.type} onClick={handleClose}>
        <CloseIcon />
      </CloseButton>
    </Toast>
  );
};

// Toast Manager - singleton pattern for global access
let toastCallback = null;

export const showToast = (toast) => {
  if (toastCallback) {
    toastCallback(toast);
  }
};

export const showError = (message, title = '오류') => {
  showToast({ type: 'error', title, message });
};

export const showSuccess = (message, title = '성공') => {
  showToast({ type: 'success', title, message });
};

export const showInfo = (message, title = '안내') => {
  showToast({ type: 'info', title, message });
};

const ErrorToast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastCallback = (toast) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { ...toast, id }]);
    };

    return () => {
      toastCallback = null;
    };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <ToastContainer>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </ToastContainer>
  );
};

export default ErrorToast;
