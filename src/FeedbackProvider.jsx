import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useReducer
} from 'react';
import { createPortal } from 'react-dom';
import styled, { ThemeProvider } from 'styled-components';
import { dispatchToDestinations } from './destinations/registry.js';
import { uploadViaSignedUrl } from './destinations/signedUrlUpload.js';
import { compressDataUrl } from './lib/mediaCompression.js';
import { FeedbackModal } from './FeedbackModal.jsx';
import { FeedbackModalDrawer } from './feedback-modal/FeedbackModalDrawer.jsx';
import { FeedbackModalCompact } from './feedback-modal/FeedbackModalCompact.jsx';
import { FeedbackModalStepper } from './feedback-modal/FeedbackModalStepper.jsx';
import { FeedbackModalTwoColumn } from './feedback-modal/FeedbackModalTwoColumn.jsx';
import { FeedbackModalWorkspace } from './feedback-modal/FeedbackModalWorkspace.jsx';

const MODAL_VARIANTS = {
  centered: FeedbackModal,
  drawer: FeedbackModalDrawer,
  compact: FeedbackModalCompact,
  stepper: FeedbackModalStepper,
  'two-column': FeedbackModalTwoColumn,
  workspace: FeedbackModalWorkspace,
};
import { FeedbackDashboard, saveFeedbackToLocalStorage } from './FeedbackDashboard.jsx';
import { CanvasOverlay } from './CanvasOverlay.jsx';
import { RecordingOverlay } from './RecordingOverlay.jsx';
import { SubmissionQueue } from './SubmissionQueue.jsx';
import ErrorToast, { showError, showSuccess, showInfo } from './ErrorToast.jsx';
import recorder from './recorder.js';
import { getElementInfo, captureElementScreenshot, getReactComponentInfo } from './utils.js';
import { getTheme, FeedbackGlobalStyle } from './theme.js';
import { IntegrationClient } from './integrations/index.js';
import {
  getFeedbackAuthHeaders,
  resolveRedactionConfig,
  redactFeedbackEvidence,
} from './lib/feedbackSecurity.js';
import { CaptureProvider } from './capture/CaptureProvider.jsx';
import { CaptureContext } from './capture/CaptureContext.jsx';
import { runViaWorker } from './capture/workerClient.js';
import { FeedbackDots } from './FeedbackDots.jsx';
import { MobileTrigger } from './MobileTrigger.jsx';

const FeedbackContext = createContext(null);

// Styled Components for FeedbackProvider
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${props => props.theme.colors.overlayBg};
  z-index: 999998;
  cursor: crosshair;
  pointer-events: none;
  transition: background 0.2s ease;
`;

const Highlight = styled.div`
  position: absolute;
  border: 2px solid ${props => props.theme.colors.highlightBorder};
  background: transparent;
  pointer-events: none;
  z-index: 999999;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 0 0 1px ${props => props.theme.colors.highlightShadow},
    0 4px 6px -1px rgba(0, 0, 0, 0.08);
  border-radius: 4px;
`;

const Tooltip = styled.div`
  position: fixed;
  background: ${props => props.theme.colors.tooltipBg};
  color: ${props => props.theme.colors.tooltipText};
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  font-weight: 500;
  pointer-events: none;
  z-index: 1000000;
  white-space: nowrap;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.3),
    0 4px 6px -2px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.15s ease;
  max-width: 300px;
`;

const MobileBanner = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: ${props => props.theme.colors.btnPrimaryBg};
  color: white;
  font-size: 14px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  text-align: center;
  z-index: 1000001;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  -webkit-tap-highlight-color: transparent;
`;

const MobileBannerClose = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const TooltipComponent = styled.span`
  color: #10b981;
  font-weight: 600;
`;

const TooltipTag = styled.span`
  color: ${props => props.theme.colors.tooltipText};
  opacity: 0.7;
`;

const initialState = {
  internalIsActive: false,
  hoveredElement: null,
  hoveredComponentInfo: null,
  selectedElement: null,
  highlightStyle: {},
  tooltipStyle: {},
  isModalOpen: false,
  screenshot: null,
  fullScreenshot: null,
  isCapturing: false,
  isDashboardOpen: false,
  isCanvasActive: false,
  isRecordingActive: false,
  isRecording: false,
  isInitializing: false,
  isPaused: false,
  videoBlob: null,
  eventLogs: [],
  isManualFeedbackOpen: false,
  // Integration state
  integrationStatus: {
    jira: { loading: false, error: null, result: null },
    sheets: { loading: false, error: null, result: null }
  },
  lastIntegrationResults: null,
  // Submission queue state
  submissionQueue: [],
  // Feedback dots state
  showFeedbackDots: false,
  clickPosition: null
};

function feedbackReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'START_HOVERING':
      return { ...state, hoveredElement: action.payload.element, hoveredComponentInfo: action.payload.componentInfo, highlightStyle: action.payload.highlightStyle, tooltipStyle: action.payload.tooltipStyle };
    case 'STOP_HOVERING':
      return { ...state, hoveredElement: null, hoveredComponentInfo: null };
    case 'START_CAPTURE':
      return { ...state, isCapturing: true, selectedElement: action.payload };
    case 'COMPLETE_CAPTURE':
      return { ...state, isCapturing: false, screenshot: action.payload, fullScreenshot: action.fullScreenshot ?? null, isModalOpen: true, hoveredElement: null, hoveredComponentInfo: null };
    case 'CANCEL_CAPTURE':
      return { ...state, isCapturing: false, hoveredElement: null, hoveredComponentInfo: null };
    case 'OPEN_DASHBOARD':
      return { ...state, isDashboardOpen: true };
    case 'CLOSE_DASHBOARD':
      return { ...state, isDashboardOpen: false };
    case 'OPEN_MANUAL_FEEDBACK':
      return { ...state, isManualFeedbackOpen: true, isModalOpen: true, screenshot: null, videoBlob: null };
    case 'CLOSE_MANUAL_FEEDBACK':
      return { ...state, isManualFeedbackOpen: false, isModalOpen: false };
    case 'START_RECORDING_INIT':
      return { ...state, isInitializing: true };
    case 'START_RECORDING_SUCCESS':
      return { ...state, isInitializing: false, isRecordingActive: true, isRecording: true, isPaused: false };
    case 'START_RECORDING_FAILURE':
      return { ...state, isInitializing: false, isRecording: false, isRecordingActive: false };
    case 'PAUSE_RECORDING':
      return { ...state, isPaused: true };
    case 'RESUME_RECORDING':
      return { ...state, isPaused: false };
    case 'CANCEL_RECORDING':
      return { ...state, isRecordingActive: false, isRecording: false, isInitializing: false, isPaused: false, videoBlob: null, eventLogs: [] };
    case 'STOP_RECORDING':
      return { ...state, isRecordingActive: false, isRecording: false, isInitializing: false, isPaused: false, videoBlob: action.payload.blob, eventLogs: action.payload.events, isModalOpen: action.payload.blob && action.payload.blob.size > 0 };
    case 'RESET_MODAL':
      return { ...state, isModalOpen: false, isManualFeedbackOpen: false, selectedElement: null, screenshot: null, fullScreenshot: null, hoveredElement: null, hoveredComponentInfo: null, isCanvasActive: false, videoBlob: null, eventLogs: [], lastIntegrationResults: null, clickPosition: null };
    // Integration actions
    case 'INTEGRATION_START':
      return {
        ...state,
        integrationStatus: {
          jira: action.payload.jira ? { loading: true, error: null, result: null } : state.integrationStatus.jira,
          sheets: action.payload.sheets ? { loading: true, error: null, result: null } : state.integrationStatus.sheets
        }
      };
    case 'INTEGRATION_SUCCESS':
      return {
        ...state,
        integrationStatus: {
          jira: action.payload.jira ? { loading: false, error: null, result: action.payload.jira } : state.integrationStatus.jira,
          sheets: action.payload.sheets ? { loading: false, error: null, result: action.payload.sheets } : state.integrationStatus.sheets
        },
        lastIntegrationResults: action.payload
      };
    case 'INTEGRATION_ERROR':
      return {
        ...state,
        integrationStatus: {
          jira: action.payload.jira?.error ? { loading: false, error: action.payload.jira.error, result: null } : state.integrationStatus.jira,
          sheets: action.payload.sheets?.error ? { loading: false, error: action.payload.sheets.error, result: null } : state.integrationStatus.sheets
        },
        lastIntegrationResults: action.payload
      };
    case 'INTEGRATION_RESET':
      return {
        ...state,
        integrationStatus: {
          jira: { loading: false, error: null, result: null },
          sheets: { loading: false, error: null, result: null }
        },
        lastIntegrationResults: null
      };
    // Submission queue actions
    case 'ADD_SUBMISSION':
      return {
        ...state,
        submissionQueue: [...state.submissionQueue, action.payload]
      };
    case 'UPDATE_SUBMISSION':
      return {
        ...state,
        submissionQueue: state.submissionQueue.map(sub =>
          sub.id === action.payload.id ? { ...sub, ...action.payload } : sub
        )
      };
    case 'REMOVE_SUBMISSION':
      return {
        ...state,
        submissionQueue: state.submissionQueue.filter(sub => sub.id !== action.payload)
      };
    // Feedback dots actions
    case 'TOGGLE_FEEDBACK_DOTS':
      return { ...state, showFeedbackDots: !state.showFeedbackDots };
    case 'SET_FEEDBACK_DOTS':
      return { ...state, showFeedbackDots: action.payload };
    case 'SET_CLICK_POSITION':
      return { ...state, clickPosition: action.payload };
    default:
      return state;
  }
}

export const FeedbackProvider = ({
  children,
  onSubmit,
  isActive: controlledIsActive,
  onActiveChange,
  dashboard = false,
  dashboardData,
  isDeveloper = false,
  isUser = true,
  userName,
  userEmail,
  userAvatar,
  onStatusChange,
  mode = 'light',
  defaultOpen = false,
  // Integration configuration
  integrations = null,
  onIntegrationSuccess,
  onIntegrationError,
  // Feedback dots
  showFeedbackDots: showFeedbackDotsProp,
  feedbackDotsData,
  // Mobile
  enableMobileFeedback = true,
  // AI-actionable capture (Phase C); when omitted the widget behaves identically to post-B2
  captureConfig,
  // Security (Phase A)
  auth,                  // { mode: 'none'|'session'|'bearer'|'signed', getToken?, getHeaders?, csrfToken? }
  redact = 'default',    // 'default' | 'strict' | 'off' | FeedbackRedactionConfig
  // Phase D: pick which dialog layout to render. 'centered' = original; 'drawer' | 'compact' | 'stepper' | 'two-column' are alternative structures.
  modalVariant = 'centered',
  // Phase E: array of destinations to fan a submission out to in parallel.
  // Each destination is an adapter from 'react-visual-feedback/destinations'
  // (local, supabasePublic, githubIssue, linearIssue, notionDb, webhook, cloud, ...).
  // The legacy `integrations={jira:..., sheets:...}` prop continues to work
  // and is dispatched alongside `destinations`.
  destinations,
  onDestinationResults,
  // Phase F: nested ui object lets `<FeedbackProvider {...feedbackConfig} />`
  // spread a single defineConfig() result cleanly. `ui.variant` maps to
  // modalVariant, `ui.accent` will map to theme accent (in a later phase).
  ui,
}) => {
  // Unpack `ui:` into its individual props with the explicit prop
  // winning so a host can still override at the call site.
  if (ui && typeof ui === 'object') {
    if (modalVariant === 'centered' && ui.variant) modalVariant = ui.variant;
  }
  // Stable refs for auth/redact so we can read latest values from callbacks.
  const authRef = useRef(auth);
  authRef.current = auth;
  const redactionConfigRef = useRef(resolveRedactionConfig(redact));
  useEffect(() => {
    redactionConfigRef.current = resolveRedactionConfig(redact);
  }, [redact]);

  // Auth-mode 'none' production warning (one-time).
  useEffect(() => {
    if (auth && auth.mode === 'none' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      console.warn('[react-visual-feedback] auth.mode === "none" is for demos only — anyone can submit feedback. Use session, bearer, or signed in production.');
    }
  }, [auth?.mode]);

  // Stable async function that returns fresh auth headers per call.
  const getAuthHeadersForSubmission = useRef(async () => {
    if (!authRef.current) return {};
    return getFeedbackAuthHeaders(authRef.current);
  }).current;

  const [state, dispatch] = useReducer(feedbackReducer, initialState);
  const {
    internalIsActive,
    hoveredElement,
    hoveredComponentInfo,
    selectedElement,
    highlightStyle,
    tooltipStyle,
    isModalOpen,
    screenshot,
    fullScreenshot,
    isCapturing,
    isDashboardOpen,
    isCanvasActive,
    isRecordingActive,
    isRecording,
    isInitializing,
    isPaused,
    videoBlob,
    eventLogs,
    isManualFeedbackOpen,
    integrationStatus,
    lastIntegrationResults,
    submissionQueue,
    showFeedbackDots,
    clickPosition
  } = state;

  // Initialize integration client
  const integrationClientRef = useRef(null);

  useEffect(() => {
    if (integrations && (integrations.jira?.enabled || integrations.sheets?.enabled)) {
      integrationClientRef.current = new IntegrationClient({
        jira: integrations.jira,
        sheets: integrations.sheets,
        getAuthHeaders: getAuthHeadersForSubmission,
        onSuccess: (type, result) => {
          if (onIntegrationSuccess) {
            onIntegrationSuccess(type, result);
          }
        },
        onError: (type, error) => {
          if (onIntegrationError) {
            onIntegrationError(type, error);
          }
        }
      });
    } else {
      integrationClientRef.current = null;
    }
  }, [integrations?.jira?.enabled, integrations?.sheets?.enabled, onIntegrationSuccess, onIntegrationError, getAuthHeadersForSubmission]);

  // Determine if component is controlled
  const isControlled = controlledIsActive !== undefined;
  const isActive = isControlled ? controlledIsActive : internalIsActive;

  useEffect(() => {
    if (defaultOpen) {
      dispatch({ type: 'OPEN_MANUAL_FEEDBACK' });
    }
  }, [defaultOpen]);

  useEffect(() => {
    if (showFeedbackDotsProp !== undefined) {
      dispatch({ type: 'SET_FEEDBACK_DOTS', payload: showFeedbackDotsProp });
    }
  }, [showFeedbackDotsProp]);

  // Handle state changes
  const setIsActive = useCallback((newValue) => {
    if (isControlled) {
      if (onActiveChange) {
        onActiveChange(typeof newValue === 'function' ? newValue(isActive) : newValue);
      }
    } else {
      dispatch({ type: 'SET_STATE', payload: { internalIsActive: newValue } });
    }
  }, [isControlled, onActiveChange, isActive]);

  const overlayRef = useRef(null);
  const highlightRef = useRef(null);
  const startRecordingRef = useRef(null);
  // Eager compression — pre-warm a WebP encode of the screenshot the
  // moment we have it, so by the time the user clicks Send Feedback the
  // promise is already resolved and the modal close is jank-free.
  // Shape: { dataUrl, promise } | null
  const eagerCompressionRef = useRef(null);

  function kickEagerCompression(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      eagerCompressionRef.current = null;
      return;
    }
    const mediaCfg = captureConfig?.media || {};
    if (mediaCfg.compress === false) {
      eagerCompressionRef.current = null;
      return;
    }
    const uploadStrategy = captureConfig?.upload?.strategy;
    const downstreamIsBinary = uploadStrategy === 'signed-url' || uploadStrategy === 'multipart';
    eagerCompressionRef.current = {
      dataUrl,
      promise: compressDataUrl(dataUrl, {
        format: mediaCfg.format || 'webp',
        quality: typeof mediaCfg.quality === 'number' ? mediaCfg.quality : 0.85,
        maxDimension: mediaCfg.maxDimension || null,
        skipDataUrl: downstreamIsBinary,
      }).catch(() => null),
    };
  }

  const theme = getTheme(mode);

  useEffect(() => {
    if (!onSubmit || typeof onSubmit !== 'function') {
      // onSubmit function is required
    }
  }, [onSubmit]);

  const isValidElement = useCallback((element) => {
    if (!element || element === document.body || element === document.documentElement) {
      return false;
    }

    if (element.closest('.feedback-overlay, .feedback-modal, .feedback-backdrop, .feedback-tooltip, .feedback-highlight, .feedback-dots-container')) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      return false;
    }

    return true;
  }, []);

  // Throttle helper
  const throttleRef = useRef(null);
  const lastElementRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!isActive) return;

    // Throttle to 60fps max (16ms)
    if (throttleRef.current) return;
    throttleRef.current = requestAnimationFrame(() => {
      throttleRef.current = null;

      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!isValidElement(element) || element === lastElementRef.current) return;

      lastElementRef.current = element;
      const componentInfo = getReactComponentInfo(element);
      const rect = element.getBoundingClientRect();
      const scrollX = window.pageXOffset;
      const scrollY = window.pageYOffset;

      dispatch({
        type: 'START_HOVERING',
        payload: {
          element,
          componentInfo,
          highlightStyle: {
            left: rect.left + scrollX,
            top: rect.top + scrollY,
            width: rect.width,
            height: rect.height,
          },
          tooltipStyle: {
            left: Math.min(e.clientX + 10, window.innerWidth - 300),
            top: Math.max(e.clientY - 40, 10),
          }
        }
      });
    });
  }, [isActive, isValidElement]);

  const handleElementClick = useCallback(async (e) => {
    if (!isActive || !hoveredElement) return;

    e.preventDefault();
    e.stopPropagation();

    // Capture click position relative to the element (0-1 range)
    const rect = hoveredElement.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    dispatch({ type: 'SET_CLICK_POSITION', payload: { relativeX, relativeY } });

    dispatch({ type: 'START_CAPTURE', payload: hoveredElement });

    try {
      const screenshotData = await captureElementScreenshot(hoveredElement);
      let fullScreenshotData = null;
      try { fullScreenshotData = await captureElementScreenshot(document.documentElement); } catch { /* 전체화면 실패해도 요소 캡처는 유지 */ }
      kickEagerCompression(screenshotData);
      dispatch({ type: 'COMPLETE_CAPTURE', payload: screenshotData, fullScreenshot: fullScreenshotData });
    } catch (error) {
      showError('스크린샷 캡처에 실패했어요. 그래도 피드백은 보낼 수 있어요.', '캡처 오류');
      dispatch({ type: 'COMPLETE_CAPTURE', payload: null });
    }
  }, [isActive, hoveredElement]);

  const handleKeyDown = useCallback((e) => {
    // Alt+Q - Activate feedback mode (element selection)
    if (e.altKey && !e.shiftKey && (e.key.toLowerCase() === 'q' || e.keyCode === 81 || e.code === 'KeyQ')) {
      e.preventDefault();
      if (!isActive && !isRecording) {
        setIsActive(true);
        dispatch({ type: 'SET_STATE', payload: { isCanvasActive: false } });
      }
      return;
    }

    // Alt+A - Open form directly (Manual Feedback)
    if (e.altKey && !e.shiftKey && (e.key.toLowerCase() === 'a' || e.keyCode === 65 || e.code === 'KeyA')) {
      e.preventDefault();
      if (!isModalOpen && !isActive && !isRecording) {
        dispatch({ type: 'OPEN_MANUAL_FEEDBACK' });
      }
      return;
    }

    // Alt+W - Start video recording
    if (e.altKey && !e.shiftKey && (e.key.toLowerCase() === 'w' || e.keyCode === 87 || e.code === 'KeyW')) {
      e.preventDefault();
      if (!isRecording && !isActive && startRecordingRef.current) {
        startRecordingRef.current();
      }
      return;
    }

    // Alt+D - Toggle feedback dots
    if (e.altKey && !e.shiftKey && (e.key.toLowerCase() === 'd' || e.keyCode === 68 || e.code === 'KeyD')) {
      e.preventDefault();
      dispatch({ type: 'TOGGLE_FEEDBACK_DOTS' });
      return;
    }

    // Alt+Shift+Q - Open dashboard
    if (dashboard && e.altKey && e.shiftKey && (e.key.toLowerCase() === 'q' || e.keyCode === 81 || e.code === 'KeyQ')) {
      e.preventDefault();
      dispatch({ type: 'OPEN_DASHBOARD' });
      return;
    }

    // Escape - Cancel/close
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isActive) {
        setIsActive(false);
        dispatch({ type: 'RESET_MODAL' });
      }
      if (isDashboardOpen) {
        dispatch({ type: 'CLOSE_DASHBOARD' });
      }
    }
  }, [isActive, isDashboardOpen, dashboard, setIsActive, isRecording]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isActive) {
      document.body.classList.add('feedback-mode-active');
    } else {
      document.body.classList.remove('feedback-mode-active');
    }

    return () => {
      document.body.classList.remove('feedback-mode-active');
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      dispatch({ type: 'STOP_HOVERING' });
      dispatch({ type: 'SET_STATE', payload: { selectedElement: null } });
      return;
    }

    if (!isCanvasActive && !isModalOpen) {
      // react-grab 처럼 선택 중에는 서비스를 정지 — 스크롤을 잠그고 클릭은 요소 선택으로만(handleElementClick 이 preventDefault)
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('click', handleElementClick, true);

      return () => {
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleElementClick, true);
      };
    }
  }, [isActive, isCanvasActive, isModalOpen, handleMouseMove, handleElementClick]);

  // --- Mobile: detect touch device ---
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  // --- Mobile: touch-based element selection (replaces hover on touch devices) ---
  const handleTouchSelect = useCallback(async (e) => {
    if (!isActive || isCanvasActive || isModalOpen) return;

    const touch = e.touches[0];
    if (!touch) return;

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!isValidElement(element)) return;

    e.preventDefault();

    // Highlight the element
    const componentInfo = getReactComponentInfo(element);
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    dispatch({
      type: 'START_HOVERING',
      payload: {
        element,
        componentInfo,
        highlightStyle: {
          left: rect.left + scrollX,
          top: rect.top + scrollY,
          width: rect.width,
          height: rect.height,
        },
        tooltipStyle: { left: -9999, top: -9999 } // hide tooltip on mobile
      }
    });

    // Capture click position
    const relativeX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const relativeY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
    dispatch({ type: 'SET_CLICK_POSITION', payload: { relativeX, relativeY } });

    // Brief highlight then capture
    dispatch({ type: 'START_CAPTURE', payload: element });

    try {
      const screenshotData = await captureElementScreenshot(element);
      let fullScreenshotData = null;
      try { fullScreenshotData = await captureElementScreenshot(document.documentElement); } catch { /* 전체화면 실패해도 요소 캡처는 유지 */ }
      kickEagerCompression(screenshotData);
      dispatch({ type: 'COMPLETE_CAPTURE', payload: screenshotData, fullScreenshot: fullScreenshotData });
    } catch (error) {
      showError('스크린샷 캡처에 실패했어요.', '캡처 오류');
      dispatch({ type: 'COMPLETE_CAPTURE', payload: null });
    }
  }, [isActive, isCanvasActive, isModalOpen, isValidElement]);

  useEffect(() => {
    if (!isTouchDevice || !isActive || isCanvasActive || isModalOpen) return;

    document.addEventListener('touchstart', handleTouchSelect, { passive: false });
    return () => document.removeEventListener('touchstart', handleTouchSelect);
  }, [isTouchDevice, isActive, isCanvasActive, isModalOpen, handleTouchSelect]);

  // --- Mobile: activate feedback mode ---
  const openScreenshotMode = useCallback(() => {
    if (!isActive && !isRecording) {
      setIsActive(true);
      dispatch({ type: 'SET_STATE', payload: { isCanvasActive: true } });
    }
  }, [isActive, isRecording, setIsActive]);

  // Generate unique ID for submissions
  const generateSubmissionId = useCallback(() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    // qa-YYYY-MM-DD-HHMMSS (로컬시각, 초까지). 사람이 읽기 쉬운 QA ID
    return `qa-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }, []);

  // Async submission handler that adds to queue and processes in background
  const handleAsyncSubmit = useCallback((feedbackData) => {
    const submissionId = generateSubmissionId();

    // Add to queue immediately with 'submitting' status
    dispatch({
      type: 'ADD_SUBMISSION',
      payload: { id: submissionId, status: 'submitting' }
    });

    // Reset modal state immediately (don't wait for submission)
    setIsActive(false);
    dispatch({ type: 'RESET_MODAL' });

    // Process submission in background with timeout (60 seconds for large files)
    const hasLargeMedia = feedbackData.videoBlob && feedbackData.videoBlob.size > 5 * 1024 * 1024; // 5MB+
    const timeoutMs = hasLargeMedia ? 60000 : 30000; // 1 min for large, 30s otherwise

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('전송 시간이 초과됐어요')), timeoutMs);
    });

    const submitPromise = (async () => {
      // Client-side redaction: strip sensitive headers, keys, and bodies from
      // captured network/console/storage events before localStorage write or
      // network submission. Server-side withSecureDefaults will redact again
      // as defense-in-depth.
      const redacted = redactFeedbackEvidence(feedbackData, redactionConfigRef.current).data;
      let processedData = { ...redacted };

      // Keep videoBlob as-is for FormData upload (binary; redactor does not touch it).
      if (feedbackData.videoBlob && feedbackData.videoBlob instanceof Blob) {
        processedData.videoBlob = feedbackData.videoBlob;
        processedData.videoSize = feedbackData.videoBlob.size;
        processedData.videoType = feedbackData.videoBlob.type;
      }

      // Phase G: compress the screenshot in-browser before dispatch.
      // PNG → WebP @ q=0.85 typically shrinks 1.2 MB → 140 KB with no
      // perceptible quality loss. Captures fromBytes/toBytes so the
      // submission carries proof of the savings.
      //
      // Optimisations:
      //  1. Worker — when OffscreenCanvas is available, run encoding off
      //     the main thread (result.encodedOn === 'worker').
      //  2. Skip dataUrl roundtrip when downstream is multipart or
      //     signed-URL — both consume the Blob directly, the dataUrl
      //     would just be ~30ms of wasted base64 encoding.
      //  3. Stash both `screenshot` (dataUrl, retained for local()
      //     adapter / inline preview) and `screenshotBlob` (the raw
      //     compressed Blob) so the multipart builder + signed-URL
      //     flow consume the Blob directly without re-decoding.
      const mediaCfg = captureConfig?.media || {};
      const uploadStrategy = captureConfig?.upload?.strategy;
      const downstreamIsBinary = uploadStrategy === 'signed-url' || uploadStrategy === 'multipart';
      if (mediaCfg.compress !== false && typeof processedData.screenshot === 'string' && processedData.screenshot.startsWith('data:image/')) {
        try {
          // OPT: if eager compression already kicked off at capture time
          // for THIS exact screenshot, await its (likely-already-resolved)
          // promise. The user typically spent several seconds typing —
          // compression finished long ago. This is what makes the modal
          // close jank-free even on huge captures.
          let eagerResult = null;
          const eager = eagerCompressionRef.current;
          if (eager && eager.dataUrl === processedData.screenshot) {
            eagerResult = await eager.promise;
            eagerCompressionRef.current = null;
          }
          const result = eagerResult || await compressDataUrl(processedData.screenshot, {
            format: mediaCfg.format || 'webp',
            quality: typeof mediaCfg.quality === 'number' ? mediaCfg.quality : 0.85,
            maxDimension: mediaCfg.maxDimension || null,
            skipDataUrl: downstreamIsBinary,
          });
          if (result.blob && result.toBytes < result.fromBytes) {
            if (result.dataUrl) processedData.screenshot = result.dataUrl;
            processedData.screenshotBlob = result.blob;
            processedData.mediaCompressed = {
              format: result.format,
              fromBytes: result.fromBytes,
              toBytes: result.toBytes,
              savedBytes: result.fromBytes - result.toBytes,
              ratio: Math.round((1 - result.toBytes / result.fromBytes) * 100),
              encodedOn: result.encodedOn,
            };
          }
        } catch {
          // Compression failures never block submission.
        }
      }

      // Extract selectedIntegrations from feedback data
      const selectedIntegrations = feedbackData.selectedIntegrations || {
        local: true,
        jira: integrations?.jira?.enabled || false,
        sheets: integrations?.sheets?.enabled || false
      };

      // Save to local storage if dashboard is enabled AND local is selected
      if (dashboard && selectedIntegrations.local) {
        await saveFeedbackToLocalStorage(processedData);
      }

      if (captureConfig && captureRef.current) {
        try {
          const ticket = await runViaWorker({
            item: processedData,
            interactions: captureRef.current.getInteractions(),
            errors: captureRef.current.getErrors(),
            routes: captureRef.current.getRoutes(),
            network: typeof captureRef.current.getNetwork === 'function' ? captureRef.current.getNetwork() : [],
            vitals: typeof captureRef.current.getVitals === 'function' ? captureRef.current.getVitals() : [],
            mutations: typeof captureRef.current.getMutations === 'function' ? captureRef.current.getMutations() : [],
            environment: typeof captureRef.current.getEnvironment === 'function' ? captureRef.current.getEnvironment() : null,
            storageQuota: typeof captureRef.current.getStorageQuota === 'function' ? await captureRef.current.getStorageQuota() : null,
            fiberSnapshot: processedData.elementInfo?.fiberSnapshot || {},
            buildInfo: captureRef.current.getBuildInfo(),
            flags: await captureRef.current.getFlags(),
            framesToResolve: [],
            redactConfig: 'default',
          });
          processedData = { ...processedData, aiTicket: ticket };
        } catch {
          // Ticket assembly failures never block submission.
        }
      }

      // Phase G tier 3: if upload.strategy === 'signed-url', request signed
      // upload URLs from the host's `/api/feedback/upload-url` route,
      // PUT each binary directly to object storage in parallel, and
      // replace the binary fields on the payload with public-read URLs.
      // The downstream dispatch then sends only metadata + URLs — no
      // base64, no multipart bandwidth on the host app server.
      // Falls back to multipart automatically when the upload-URL
      // request fails (e.g. dev mode without storage configured).
      //
      // Runs BEFORE onSubmit + destinations so the host's onSubmit
      // (and every adapter) sees the final URL-referenced payload, not
      // the pre-upload binary version.
      const uploadCfg = captureConfig?.upload;
      if (uploadCfg?.strategy === 'signed-url') {
        try {
          processedData = await uploadViaSignedUrl(processedData, {
            endpoint: uploadCfg.endpoint || '/api/feedback/upload-url',
          });
        } catch {
          // Never block — proxyPost will use multipart instead.
        }
      }

      if (onSubmit && typeof onSubmit === 'function') {
        await onSubmit(processedData);
      }

      // Send to integrations if configured AND selected
      const shouldSendToJira = integrationClientRef.current && integrations?.jira?.enabled && selectedIntegrations.jira;
      const shouldSendToSheets = integrationClientRef.current && integrations?.sheets?.enabled && selectedIntegrations.sheets;

      // Fan out to the new destinations array in parallel — runs alongside
      // the legacy integrations path. Each destination resolves with
      // {ok, id?, url?, error?, durationMs} so the UI can surface
      // per-destination status in the modal footer / submission queue.
      if (Array.isArray(destinations) && destinations.length > 0) {
        try {
          const { results } = await dispatchToDestinations(destinations, processedData);
          if (typeof onDestinationResults === 'function') {
            try { onDestinationResults(results); } catch { /* swallow */ }
          }
          processedData.destinationResults = results;
        } catch (e) {
          // dispatchToDestinations never throws, but guard anyway.
          console.warn('destinations dispatch error:', e?.message);
        }
      }

      if (shouldSendToJira || shouldSendToSheets) {
        try {
          const integrationResults = await integrationClientRef.current.sendFeedback(processedData, {
            jira: shouldSendToJira,
            sheets: shouldSendToSheets
          });

          if (integrationResults.jira?.success && integrationResults.jira?.issueKey) {
            processedData.jiraKey = integrationResults.jira.issueKey;
            processedData.jiraUrl = integrationResults.jira.issueUrl;

            if (dashboard && selectedIntegrations.local) {
              await saveFeedbackToLocalStorage({
                ...processedData,
                jiraKey: integrationResults.jira.issueKey,
                jiraUrl: integrationResults.jira.issueUrl
              });
            }
          }
        } catch (integrationError) {
          // Log but don't fail the submission
          console.warn('Integration error:', integrationError.message);
        }
      }

      return processedData;
    })();

    // Race between submission and timeout
    Promise.race([submitPromise, timeoutPromise])
      .then((finalData) => {
        // Update to success — include destination results so the queue
        // toast / footer can render per-destination status chips.
        dispatch({
          type: 'UPDATE_SUBMISSION',
          payload: {
            id: submissionId,
            status: 'success',
            destinationResults: finalData?.destinationResults || null,
          }
        });

        // Auto-remove success after 3 seconds (or 6s if any destination failed)
        const anyDestFailed = (finalData?.destinationResults || []).some((r) => !r.ok);
        setTimeout(() => {
          dispatch({ type: 'REMOVE_SUBMISSION', payload: submissionId });
        }, anyDestFailed ? 6000 : 3000);
      })
      .catch((error) => {
        // Update to error
        dispatch({
          type: 'UPDATE_SUBMISSION',
          payload: { id: submissionId, status: 'error', error: error.message }
        });

        // Auto-remove error after 5 seconds
        setTimeout(() => {
          dispatch({ type: 'REMOVE_SUBMISSION', payload: submissionId });
        }, 5000);
      });
  }, [onSubmit, dashboard, setIsActive, integrations, generateSubmissionId, destinations, onDestinationResults]);

  // Handler to dismiss a submission from the queue
  const handleDismissSubmission = useCallback((submissionId) => {
    dispatch({ type: 'REMOVE_SUBMISSION', payload: submissionId });
  }, []);

  // Legacy synchronous submit (kept for backward compatibility)
  const handleFeedbackSubmit = useCallback(async (feedbackData) => {
    // Use async handler instead
    handleAsyncSubmit(feedbackData);
  }, [handleAsyncSubmit]);

  const handleCloseModal = useCallback(() => {
    setIsActive(false);
    dispatch({ type: 'RESET_MODAL' });
  }, [setIsActive]);

  const handleCanvasComplete = useCallback(async (canvasScreenshot, feedbackText) => {
    setIsActive(false);
    dispatch({ type: 'SET_STATE', payload: { isCanvasActive: false } });

    const feedbackData = {
      feedback: feedbackText,
      elementInfo: null,
      screenshot: canvasScreenshot,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timestamp: new Date().toISOString(),
      userName: userName || '익명',
      userEmail: userEmail || null
    };

    const redactedCanvas = redactFeedbackEvidence(feedbackData, redactionConfigRef.current).data;

    try {
      if (dashboard) {
        const result = await saveFeedbackToLocalStorage(redactedCanvas);
        if (!result.success) {
          throw new Error(result.error);
        }
      }

      if (onSubmit && typeof onSubmit === 'function') {
        await onSubmit(redactedCanvas);
      }

      showSuccess('피드백이 전송됐어요!', '전송 완료');
      dispatch({ type: 'STOP_HOVERING' });
      dispatch({ type: 'SET_STATE', payload: { selectedElement: null, screenshot: null } });
    } catch (error) {
      showError(error.message || '피드백 전송에 실패했어요. 다시 시도해주세요.', '전송 오류');
    }
  }, [dashboard, onSubmit, userName, userEmail, setIsActive]);

  const handleCanvasCancel = useCallback(() => {
    setIsActive(false);
    dispatch({ type: 'SET_STATE', payload: { isCanvasActive: false } });
  }, [setIsActive]);

  const handleStartRecording = useCallback(async () => {
    try {
      dispatch({ type: 'START_RECORDING_INIT' });
      await recorder.start();
      dispatch({ type: 'START_RECORDING_SUCCESS' });
    } catch (error) {
      dispatch({ type: 'START_RECORDING_FAILURE' });
      showError('녹화를 시작할 수 없어요. 화면·마이크 권한을 확인해주세요.', '녹화 오류');
    }
  }, []);

  startRecordingRef.current = handleStartRecording;

  const handlePauseRecording = useCallback(() => {
    recorder.pause();
    dispatch({ type: 'PAUSE_RECORDING' });
  }, []);

  const handleResumeRecording = useCallback(() => {
    recorder.resume();
    dispatch({ type: 'RESUME_RECORDING' });
  }, []);
  
  const handleCancelRecording = useCallback(async () => {
    await recorder.stop();
    dispatch({ type: 'CANCEL_RECORDING' });
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      const { videoBlob: blob, events } = await recorder.stop();
      dispatch({ type: 'STOP_RECORDING', payload: { blob, events } });
      if (!blob || blob.size === 0) {
        showError('녹화 실패: 영상 데이터가 없어요. 다시 시도해주세요.', '녹화 오류');
      }
    } catch (error) {
      showError('녹화를 제대로 멈추지 못했어요. 다시 시도해주세요.', '녹화 오류');
      dispatch({ type: 'CANCEL_RECORDING' });
    }
  }, []);

  const setIsDashboardOpen = useCallback((value) => {
    if (value) {
      dispatch({ type: 'OPEN_DASHBOARD' });
    } else {
      dispatch({ type: 'CLOSE_DASHBOARD' });
    }
  }, []);

  const getTooltipContent = () => {
    if (!hoveredElement) return null;
    const tagName = hoveredElement.tagName.toLowerCase();
    const id = hoveredElement.id ? `#${hoveredElement.id}` : '';
    const componentName = hoveredComponentInfo?.componentName;
    return { tagName, id, componentName };
  };

  const tooltipContent = getTooltipContent();

  const captureRef = useRef(null);
  function CaptureReader() {
    const ctx = React.useContext(CaptureContext);
    captureRef.current = ctx;
    return null;
  }

  const renderTree = (
    <FeedbackContext.Provider value={{
      isActive,
      setIsActive,
      setIsDashboardOpen,
      startRecording: handleStartRecording,
      integrationStatus,
      integrations,
      integrationClient: integrationClientRef.current,
      showFeedbackDots,
      toggleFeedbackDots: () => dispatch({ type: 'TOGGLE_FEEDBACK_DOTS' }),
      openScreenshotMode
    }}>
      <ThemeProvider theme={theme}>
        <FeedbackGlobalStyle />
        {children}

        {isActive && !isCanvasActive && !isModalOpen && createPortal(
          <>
            <Overlay ref={overlayRef} className="feedback-overlay" />

            {isTouchDevice && (
              <MobileBanner>
                요소를 탭해서 피드백을 남기세요
                <MobileBannerClose onClick={() => {
                  setIsActive(false);
                  dispatch({ type: 'RESET_MODAL' });
                }}>
                  Cancel
                </MobileBannerClose>
              </MobileBanner>
            )}

            {hoveredElement && (
              <>
                <Highlight
                  ref={highlightRef}
                  className="feedback-highlight"
                  style={highlightStyle}
                />
                <Tooltip className="feedback-tooltip" style={tooltipStyle}>
                  {tooltipContent?.componentName && (
                    <>
                      <TooltipComponent>&lt;{tooltipContent.componentName}&gt;</TooltipComponent>
                      {' '}
                    </>
                  )}
                  <TooltipTag>
                    {tooltipContent?.tagName}
                    {tooltipContent?.id}
                  </TooltipTag>
                  {isCapturing && ' (Capturing...)'}
                </Tooltip>
              </>
            )}
          </>,
          document.body
        )}

        {(() => {
          const ModalComponent = MODAL_VARIANTS[modalVariant] || FeedbackModal;
          return (
            <ModalComponent
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              elementInfo={selectedElement ? getElementInfo(selectedElement) : null}
              screenshot={screenshot}
              fullScreenshot={fullScreenshot}
              videoBlob={videoBlob}
              eventLogs={eventLogs}
              onSubmit={handleFeedbackSubmit}
              onAsyncSubmit={handleAsyncSubmit}
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              mode={mode}
              isManual={isManualFeedbackOpen}
              integrations={integrations}
              clickPosition={clickPosition}
            />
          );
        })()}

        <CanvasOverlay
          isActive={isCanvasActive}
          onComplete={handleCanvasComplete}
          onCancel={handleCanvasCancel}
          mode={mode}
        />

        <RecordingOverlay
          isRecording={isRecording}
          isInitializing={isInitializing}
          isPaused={isPaused}
          onStop={handleStopRecording}
          onPause={handlePauseRecording}
          onResume={handleResumeRecording}
          onCancel={handleCancelRecording}
          mode={mode}
        />

        {dashboard && (
          <FeedbackDashboard
            isOpen={isDashboardOpen}
            onClose={() => setIsDashboardOpen(false)}
            data={dashboardData}
            isDeveloper={isDeveloper}
            isUser={isUser}
            onStatusChange={onStatusChange}
            userName={userName}
            userEmail={userEmail}
            mode={mode}
            integrations={integrations}
            integrationClient={integrationClientRef.current}
          />
        )}

        <ErrorToast />

        <SubmissionQueue
          submissions={submissionQueue}
          onDismiss={handleDismissSubmission}
          mode={mode}
        />

        <FeedbackDots
          mode={mode}
          isDeveloper={isDeveloper}
          data={feedbackDotsData}
          visible={showFeedbackDots && !isActive}
        />

        {enableMobileFeedback && isTouchDevice && (
          <MobileTrigger
            mode={mode}
            isActive={isActive}
            onActivate={() => {
              if (!isActive && !isRecording) {
                setIsActive(true);
                dispatch({ type: 'SET_STATE', payload: { isCanvasActive: false } });
              }
            }}
            onCancel={() => {
              setIsActive(false);
              dispatch({ type: 'RESET_MODAL' });
            }}
          />
        )}
      </ThemeProvider>
    </FeedbackContext.Provider>
  );

  return captureConfig
    ? <CaptureProvider config={captureConfig}><CaptureReader />{renderTree}</CaptureProvider>
    : renderTree;
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
};
