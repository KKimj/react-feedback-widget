import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled, { ThemeProvider, keyframes } from 'styled-components';
import { Trash2 } from 'lucide-react';
import { getTheme } from './theme.js';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// Styled Components
const OverlayContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  cursor: crosshair;
  animation: ${fadeIn} 0.2s ease;
`;

const DrawingIndicator = styled.div`
  position: fixed;
  top: 20px;
  left: 20px;
  padding: 12px 16px;
  background-color: rgba(239, 68, 68, 0.95);
  color: white;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
`;

const Canvas = styled.canvas`
  display: block;
  position: absolute;
  top: 0;
  left: 0;
`;

const ToolsContainer = styled.div`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: ${props => props.theme.mode === 'dark' ? '#1f2937' : 'white'};
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  z-index: 10001;
`;

const ToolButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background-color: ${props => props.theme.mode === 'dark' ? '#374151' : '#f3f4f6'};
  color: ${props => props.theme.mode === 'dark' ? '#f3f4f6' : '#374151'};
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: ${props => props.theme.mode === 'dark' ? '#4b5563' : '#e5e7eb'};
  }
`;

const FeedbackInput = styled.input`
  position: fixed;
  width: 300px;
  padding: 10px 14px;
  font-size: 14px;
  border: 2px solid #ef4444;
  border-radius: 8px;
  outline: none;
  background-color: ${props => props.theme.mode === 'dark' ? '#1f2937' : 'white'};
  color: ${props => props.theme.mode === 'dark' ? '#f3f4f6' : '#111827'};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-family: inherit;
  z-index: 10002;

  &::placeholder {
    color: ${props => props.theme.mode === 'dark' ? '#9ca3af' : '#6b7280'};
  }
`;

export const CanvasOverlay = ({ isActive, onComplete, onCancel, mode = 'light' }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const inputRef = useRef(null);
  const [inputPosition, setInputPosition] = useState({ x: 0, y: 0 });
  const drawingBoundsRef = useRef({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  const theme = getTheme(mode);

  // Initialize canvas
  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Configure drawing context
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ef4444'; // Red color for drawing

    setContext(ctx);

    // Prevent scrolling on mobile when drawing
    const preventScroll = (e) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [isActive, isDrawing]);

  // Get coordinates from mouse or touch event
  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches.length > 0) {
      // Touch event
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  }, []);

  // Start drawing
  const startDrawing = useCallback((e) => {
    if (!context) return;

    e.preventDefault();
    setIsDrawing(true);

    const { x, y } = getCoordinates(e);
    lastPointRef.current = { x, y };

    // Update drawing bounds
    const bounds = drawingBoundsRef.current;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);

    context.beginPath();
    context.moveTo(x, y);
  }, [context, getCoordinates]);

  // Draw on canvas
  const draw = useCallback((e) => {
    if (!isDrawing || !context) return;

    e.preventDefault();

    const { x, y } = getCoordinates(e);

    // Update drawing bounds
    const bounds = drawingBoundsRef.current;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);

    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = '#ef4444';
    context.lineWidth = 3;

    context.lineTo(x, y);
    context.stroke();

    lastPointRef.current = { x, y };
  }, [isDrawing, context, getCoordinates]);

  // Clear all drawings
  const clearCanvas = useCallback(() => {
    if (!context || !canvasRef.current) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    // Reset drawing bounds
    drawingBoundsRef.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  }, [context]);

  // Capture screenshot function
  const captureScreenshot = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      // Import html2canvas + PII redaction dynamically
      const html2canvas = (await import('html2canvas')).default;
      const { maskPiiInClonedDoc } = await import('./lib/screenshot-redaction.js');
      const canvas = canvasRef.current;

      // Capture the entire visible page with drawings
      const pageCanvas = await html2canvas(document.body, {
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        allowTaint: true,
        logging: false,
        // Mask passwords / cc-* fields / data-feedback-redact in the
        // cloned DOM before render. The live page is untouched.
        onclone: (clonedDoc) => maskPiiInClonedDoc(clonedDoc),
      });

      // Create combined canvas with page + drawings
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = pageCanvas.width;
      combinedCanvas.height = pageCanvas.height;
      const combinedCtx = combinedCanvas.getContext('2d');

      // Draw the captured page
      combinedCtx.drawImage(pageCanvas, 0, 0);

      // Draw the user's drawings on top
      combinedCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

      // Convert to data URL
      const screenshotData = combinedCanvas.toDataURL('image/png', 0.95);
      setScreenshot(screenshotData);
    } catch (error) {
      // Continue anyway - feedback can still be submitted without screenshot
      setScreenshot(null);
    }
  }, []);

  // Complete drawing and capture screenshot
  const handleComplete = useCallback(() => {
    if (!canvasRef.current) return;

    // Calculate smart position for input box near the drawing
    const bounds = drawingBoundsRef.current;

    // Check if user actually drew something
    if (bounds.minX === Infinity || bounds.maxX === -Infinity) {
      // No drawing detected, use center position
      const position = {
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 25
      };
      setInputPosition(position);
      setShowFeedbackInput(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);

      // Still capture screenshot even without drawing
      captureScreenshot();
      return;
    }

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const inputWidth = 300;
    const inputHeight = 50;
    const padding = 20;

    let x, y;

    // Try to position on the right of drawing
    if (bounds.maxX + padding + inputWidth < window.innerWidth) {
      x = bounds.maxX + padding;
      y = centerY - inputHeight / 2;
    }
    // Try left
    else if (bounds.minX - padding - inputWidth > 0) {
      x = bounds.minX - padding - inputWidth;
      y = centerY - inputHeight / 2;
    }
    // Try below
    else if (bounds.maxY + padding + inputHeight < window.innerHeight) {
      x = centerX - inputWidth / 2;
      y = bounds.maxY + padding;
    }
    // Try above
    else if (bounds.minY - padding - inputHeight > 0) {
      x = centerX - inputWidth / 2;
      y = bounds.minY - padding - inputHeight;
    }
    // Fallback to center-right
    else {
      x = Math.min(centerX + padding, window.innerWidth - inputWidth - 20);
      y = Math.max(20, Math.min(centerY - inputHeight / 2, window.innerHeight - inputHeight - 20));
    }

    // Ensure input stays within viewport
    x = Math.max(20, Math.min(x, window.innerWidth - inputWidth - 20));
    y = Math.max(20, Math.min(y, window.innerHeight - inputHeight - 20));

    setInputPosition({ x, y });

    // Show input immediately - don't wait for screenshot
    setShowFeedbackInput(true);

    // Focus input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);

    // Capture screenshot in background
    captureScreenshot();
  }, [captureScreenshot]);

  // Stop drawing - auto-shows input when user lifts mouse/finger
  const stopDrawing = useCallback(() => {
    if (!context || !isDrawing) return;
    setIsDrawing(false);
    context.closePath();

    // Automatically show input when user stops drawing (only if not already shown)
    const bounds = drawingBoundsRef.current;
    if (bounds.minX !== Infinity && bounds.maxX !== -Infinity && !showFeedbackInput) {
      // User drew something, show input automatically
      handleComplete();
    }
  }, [context, handleComplete, isDrawing, showFeedbackInput]);

  // Reset all states
  const resetCanvas = useCallback(() => {
    // Clear the drawing
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    // Reset all states
    setShowFeedbackInput(false);
    setFeedbackText('');
    setScreenshot(null);
    drawingBoundsRef.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  }, [context]);

  // Submit feedback
  const handleSubmit = useCallback(() => {
    if (!feedbackText.trim()) return;

    // Call onComplete with screenshot and feedback
    onComplete(screenshot, feedbackText.trim());

    // Reset after submit
    resetCanvas();
  }, [feedbackText, screenshot, onComplete, resetCanvas]);

  // Handle Enter key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  // Global escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isActive) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isActive, onCancel]);

  if (!isActive) return null;

  return createPortal(
    <ThemeProvider theme={theme}>
      <OverlayContainer>
        {/* Drawing cursor indicator */}
        {!showFeedbackInput && (
          <DrawingIndicator>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
            </svg>
            Drawing Mode
          </DrawingIndicator>
        )}

        <Canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            pointerEvents: showFeedbackInput ? 'none' : 'auto'
          }}
        />

        {/* Drawing Tools - Only Clear button */}
        {!showFeedbackInput && (
          <ToolsContainer>
            <ToolButton onClick={clearCanvas} title="전체 지우기">
              <Trash2 size={18} />
              지우기
            </ToolButton>
          </ToolsContainer>
        )}

        {/* Small inline feedback input */}
        {showFeedbackInput && (
          <FeedbackInput
            ref={inputRef}
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="피드백 입력..."
            style={{
              left: `${inputPosition.x}px`,
              top: `${inputPosition.y}px`,
            }}
          />
        )}
      </OverlayContainer>
    </ThemeProvider>,
    document.body
  );
};
