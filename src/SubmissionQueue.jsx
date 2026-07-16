import React from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes, ThemeProvider } from 'styled-components';
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';
import { getTheme } from './theme.js';

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideOut = keyframes`
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const QueueContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99997;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
`;

const QueueItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: ${props => props.theme.colors.modalBg};
  border-radius: 10px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 0 0 1px ${props => props.theme.colors.border};
  animation: ${props => props.$exiting ? slideOut : slideIn} 0.3s ease forwards;
  min-width: 200px;
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const SpinningLoader = styled(Loader2)`
  animation: ${spin} 1s linear infinite;
  color: ${props => props.theme.colors.btnPrimaryBg};
`;

const SuccessIcon = styled(CheckCircle)`
  color: #22c55e;
`;

const ErrorIcon = styled(XCircle)`
  color: #ef4444;
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Subtitle = styled.div`
  font-size: 11px;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 2px;
`;

const DismissButton = styled.button`
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: ${props => props.theme.colors.textTertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: ${props => props.theme.colors.hoverBg};
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const MoreIndicator = styled.div`
  text-align: center;
  font-size: 11px;
  color: ${props => props.theme.colors.textSecondary};
  padding: 4px 8px;
  background: ${props => props.theme.colors.modalBg};
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

export const SubmissionQueue = ({ submissions, onDismiss, mode = 'light' }) => {
  const theme = getTheme(mode);

  if (!submissions || submissions.length === 0) return null;

  // Show only the first 3 submissions
  const visibleSubmissions = submissions.slice(0, 3);
  const hiddenCount = submissions.length - 3;

  const getStatusInfo = (status) => {
    switch (status) {
      case 'submitting':
        return {
          icon: <SpinningLoader size={18} />,
          title: '피드백 보내는 중...',
          subtitle: '잠시만 기다려주세요'
        };
      case 'success':
        return {
          icon: <SuccessIcon size={18} />,
          title: '전송 완료!',
          subtitle: '피드백이 접수됐어요'
        };
      case 'error':
        return {
          icon: <ErrorIcon size={18} />,
          title: '전송 실패',
          subtitle: '다시 시도해주세요'
        };
      default:
        return {
          icon: <SpinningLoader size={18} />,
          title: '처리 중...',
          subtitle: ''
        };
    }
  };

  return createPortal(
    <ThemeProvider theme={theme}>
      <QueueContainer>
        {visibleSubmissions.map((submission) => {
          const { icon, title, subtitle } = getStatusInfo(submission.status);
          const results = submission.destinationResults || [];
          const summary = results.length
            ? `${results.filter((r) => r.ok).length}/${results.length}곳 전송됨`
            : subtitle;
          return (
            <QueueItem
              key={submission.id}
              $exiting={submission.exiting}
            >
              <IconWrapper>{icon}</IconWrapper>
              <Content>
                <Title>{title}</Title>
                {summary && <Subtitle>{summary}</Subtitle>}
                {results.length > 0 && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4,
                  }}>
                    {results.map((r) => (
                      <span key={r.name} title={r.ok
                        ? `${r.name} · ${r.durationMs}ms${r.url ? ' · ' + r.url : ''}`
                        : `${r.name} 실패: ${r.error || '알 수 없음'}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 7px', borderRadius: 999,
                          background: r.ok ? '#dcfce7' : '#fee2e2',
                          color: r.ok ? '#166534' : '#991b1b',
                          border: `1px solid ${r.ok ? '#86efac' : '#fecaca'}`,
                          fontFamily: 'inherit',
                        }}>
                        {r.ok ? '✓' : '⚠'} {r.describe || r.name}
                      </span>
                    ))}
                  </div>
                )}
              </Content>
              {submission.status !== 'submitting' && (
                <DismissButton onClick={() => onDismiss(submission.id)}>
                  <X size={14} />
                </DismissButton>
              )}
            </QueueItem>
          );
        })}
        {hiddenCount > 0 && (
          <MoreIndicator>
            +{hiddenCount} more in queue
          </MoreIndicator>
        )}
      </QueueContainer>
    </ThemeProvider>,
    document.body
  );
};

export default SubmissionQueue;
