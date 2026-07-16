import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled, { ThemeProvider, keyframes } from 'styled-components';
import { X, CheckCircle, Sparkles, Rocket, Tag } from 'lucide-react';
import { getTheme } from './theme.js';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -48%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
`;

const slideUpMobile = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const itemFadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// --- Styled Components ---
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: ${props => props.theme.mode === 'dark'
    ? 'rgba(0, 0, 0, 0.7)'
    : 'rgba(0, 0, 0, 0.4)'};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 99998;
  animation: ${fadeIn} 0.25s ease-out forwards;
`;

const ModalContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: 75vh;
  background: ${props => props.theme.mode === 'dark'
    ? '#1a1a2e'
    : '#ffffff'};
  border-radius: 16px;
  border: 1px solid ${props => props.theme.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.08)'};
  box-shadow: ${props => props.theme.mode === 'dark'
    ? '0 24px 80px -12px rgba(0, 0, 0, 0.8)'
    : '0 24px 80px -12px rgba(0, 0, 0, 0.25)'};
  z-index: 99999;
  animation: ${slideUp} 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 640px) {
    width: calc(100vw - 32px);
    max-width: calc(100vw - 32px);
    max-height: 65vh;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 14px;
  }
`;

const Header = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid ${props => props.theme.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${props => props.theme.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.02)'
    : 'rgba(0, 0, 0, 0.01)'};
  flex-shrink: 0;

  @media (max-width: 640px) {
    padding: 14px 16px;
  }
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.textPrimary};
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: ${props => props.theme.colors.textSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.colors.hoverBg};
    color: ${props => props.theme.colors.textPrimary};
  }
`;

const FilterBar = styled.div`
  padding: 12px 20px;
  border-bottom: 1px solid ${props => props.theme.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.05)'};
  display: flex;
  gap: 8px;
  overflow-x: auto;
  background: transparent;
  flex-shrink: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (max-width: 640px) {
    padding: 10px 16px;
  }
`;

const FilterPill = styled.button`
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  
  border: 1px solid ${props => props.$active 
    ? 'transparent' 
    : props.theme.colors.border};
    
  background: ${props => props.$active 
    ? props.theme.colors.btnPrimaryBg 
    : 'transparent'};
    
  color: ${props => props.$active 
    ? 'white' 
    : props.theme.colors.textSecondary};

  &:hover {
    background: ${props => props.$active 
      ? props.theme.colors.btnPrimaryHover 
      : props.theme.colors.hoverBg};
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const UpdateItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid ${props => props.theme.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(0, 0, 0, 0.05)'};
  transition: background 0.15s ease;
  animation: ${itemFadeIn} 0.35s ease-out forwards;
  animation-delay: ${props => props.$index * 0.04}s;
  opacity: 0;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${props => props.theme.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.03)'
      : 'rgba(0, 0, 0, 0.02)'};
  }

  @media (max-width: 640px) {
    padding: 14px 16px;
  }
`;

const ItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const ItemTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.textPrimary};
  line-height: 1.4;
  flex: 1;
  min-width: 0;

  @media (max-width: 640px) {
    font-size: 13px;
  }
`;

const ItemDate = styled.span`
  font-size: 11px;
  color: ${props => props.theme.colors.textTertiary};
  white-space: nowrap;
  margin-left: 10px;
  flex-shrink: 0;
`;

const ItemDescription = styled.p`
  margin: 0 0 10px 0;
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.5;

  @media (max-width: 640px) {
    font-size: 12px;
    margin-bottom: 8px;
  }
`;

const ItemFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

// Badge styles based on type
const getTypeStyles = (type, theme) => {
  switch (type) {
    case 'solved':
      return { bg: theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5', color: '#059669' }; // Green
    case 'new_feature':
      return { bg: theme.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : '#ede9fe', color: '#7c3aed' }; // Purple
    default:
      return { bg: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe', color: '#2563eb' }; // Blue
  }
};

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  background: ${props => props.$bg};
  color: ${props => props.$color};
`;

const MetaTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${props => props.theme.colors.textTertiary};
  padding: 2px 6px;
  background: ${props => props.theme.colors.hoverBg};
  border-radius: 4px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: ${props => props.theme.colors.textTertiary};
`;

// --- Helpers ---
const getStatusLabel = (type) => {
  switch (type) {
    case 'solved': return 'Fixed';
    case 'new_feature': return 'New Feature';
    default: return type;
  }
};

const getStatusIcon = (type) => {
  switch (type) {
    case 'solved': return <CheckCircle size={12} />;
    case 'new_feature': return <Sparkles size={12} />;
    default: return <Rocket size={12} />;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const UpdatesModal = ({
  isOpen,
  onClose,
  onUpdatesSeen,
  updates = [],
  title = "What's New",
  mode = 'light'
}) => {
  const [filter, setFilter] = useState('solved'); // Default to showing Fixed
  const theme = getTheme(mode);

  const counts = useMemo(() => ({
    solved: updates.filter(u => u.type === 'solved').length,
    new_feature: updates.filter(u => u.type === 'new_feature').length,
  }), [updates]);

  // Sort updates: Fixed first, then New Feature (newest first within each group)
  const sortedUpdates = useMemo(() => {
    const typeOrder = { solved: 0, new_feature: 1 };
    return [...updates].sort((a, b) => {
      const orderA = typeOrder[a.type] ?? 2;
      const orderB = typeOrder[b.type] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by date (newest first)
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  }, [updates]);

  const filteredUpdates = useMemo(() => {
    if (!filter) return sortedUpdates;
    return sortedUpdates.filter(u => u.type === filter);
  }, [sortedUpdates, filter]);

  // Reset filter when modal closes and notify about seen updates
  const handleClose = () => {
    setFilter('solved');
    if (onUpdatesSeen) {
      onUpdatesSeen(updates);
    }
    onClose();
  };

  if (!isOpen) return null;

  const hasFilters = counts.solved > 0 || counts.new_feature > 0;

  const modalContent = (
    <ThemeProvider theme={theme}>
      <Backdrop onClick={handleClose} />
      <ModalContainer>
        <Header>
          <TitleGroup>
            <Rocket size={20} color={theme.colors.btnPrimaryBg} />
            <HeaderTitle>{title}</HeaderTitle>
          </TitleGroup>
          <CloseButton onClick={handleClose}><X size={18} /></CloseButton>
        </Header>

        {hasFilters && (
          <FilterBar>
            {counts.solved > 0 && (
              <FilterPill
                $active={filter === 'solved' || filter === null}
                onClick={() => setFilter('solved')}
              >
                <CheckCircle size={12} />
                Fixed <span style={{opacity: 0.7}}>({counts.solved})</span>
              </FilterPill>
            )}
            {counts.new_feature > 0 && (
              <FilterPill
                $active={filter === 'new_feature'}
                onClick={() => setFilter('new_feature')}
              >
                <Sparkles size={12} />
                New <span style={{opacity: 0.7}}>({counts.new_feature})</span>
              </FilterPill>
            )}
          </FilterBar>
        )}

        <Content>
          {filteredUpdates.length === 0 ? (
            <EmptyState>
              <Rocket size={32} style={{opacity: 0.3, marginBottom: 12}} />
              <p>업데이트가 없어요</p>
            </EmptyState>
          ) : (
            filteredUpdates.map((update, index) => {
              const styles = getTypeStyles(update.type, theme);
              return (
                <UpdateItem key={update.id || index} $index={index}>
                  <ItemHeader>
                    <ItemTitle>{update.title}</ItemTitle>
                    {update.date && <ItemDate>{formatDate(update.date)}</ItemDate>}
                  </ItemHeader>

                  {update.description && (
                    <ItemDescription>{update.description}</ItemDescription>
                  )}

                  <ItemFooter>
                    <StatusBadge $bg={styles.bg} $color={styles.color}>
                      {getStatusIcon(update.type)}
                      {getStatusLabel(update.type)}
                    </StatusBadge>

                    {update.version && (
                      <MetaTag>
                        <Tag size={10} /> v{update.version}
                      </MetaTag>
                    )}

                    {update.category && (
                      <MetaTag>{update.category}</MetaTag>
                    )}
                  </ItemFooter>
                </UpdateItem>
              );
            })
          )}
        </Content>
      </ModalContainer>
    </ThemeProvider>
  );

  return createPortal(modalContent, document.body);
};

export default UpdatesModal;
