import { useState, useEffect, useRef, useCallback } from 'react';

export const FEEDBACK_TYPES = [
  { id: 'bug', label: '버그' },
  { id: 'feature', label: '기능' },
  { id: 'improvement', label: '개선' },
  { id: 'other', label: '기타' },
];

export const PRIORITY_OPTIONS = [
  { id: 'P0', label: 'P0', hint: '심각' },
  { id: 'P1', label: 'P1', hint: '높음' },
  { id: 'P2', label: 'P2', hint: '보통' },
  { id: 'P3', label: 'P3', hint: '낮음' },
];

export const DEFAULT_SUGGESTED_LABELS = ['ui', 'a11y', 'perf', 'data', 'flow'];

/**
 * Shared state + submit + reset for all FeedbackModal variants. Each
 * layout (centered, drawer, compact, stepper, two-column) calls this
 * once and renders the returned bag however it wants.
 */
export function useFeedbackModalState({
  isOpen,
  onClose,
  onSubmit,
  onAsyncSubmit,
  screenshot,
  manualScreenshotProp = null,
  videoBlob,
  manualVideoProp = null,
  manualFileProp = null,
  eventLogs,
  userName,
  userEmail,
  userAvatar,
  elementInfo,
  clickPosition,
}) {
  const [feedbackType, setFeedbackType] = useState('bug');
  const [priority, setPriority] = useState('P2');
  const [labels, setLabels] = useState([]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualScreenshot, setManualScreenshot] = useState(manualScreenshotProp);
  const [manualVideo, setManualVideo] = useState(manualVideoProp);
  const [manualFile, setManualFile] = useState(manualFileProp);
  const [manualAudio, setManualAudio] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [selectedIntegrations, setSelectedIntegrations] = useState({
    local: true, jira: false, sheets: false,
  });

  const descriptionRef = useRef(null);
  const screenshotInputRef = useRef(null);
  const dragCounterRef = useRef(0); // dragenter/dragleave fire on children too

  useEffect(() => {
    let url = null;
    if (videoBlob) url = URL.createObjectURL(videoBlob);
    else if (manualVideo) url = URL.createObjectURL(manualVideo);
    setVideoUrl(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [videoBlob, manualVideo]);

  useEffect(() => {
    let url = null;
    if (manualAudio) url = URL.createObjectURL(manualAudio);
    setAudioUrl(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [manualAudio]);

  useEffect(() => {
    if (isOpen) {
      setFeedbackType('bug');
      setPriority('P2');
      setLabels([]);
      setDescription('');
      setIsSubmitting(false);
      setManualScreenshot(null);
      setManualVideo(null);
      setManualFile(null);
      setManualAudio(null);
      setIsDraggingOver(false);
      setZoomedImage(null);
      dragCounterRef.current = 0;
      setSelectedIntegrations({ local: true, jira: false, sheets: false });
      setTimeout(() => descriptionRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const toggleLabel = (label) => {
    setLabels((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]);
  };

  const toggleIntegration = (key) => {
    setSelectedIntegrations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * Route any file (from picker, paste, drop, mic) into the right slot.
   * Audio gets its own slot so voice memos coexist with screenshots.
   * Last-write-wins per slot.
   */
  const handleFile = useCallback((file) => {
    if (!file) {
      setManualScreenshot(null);
      setManualVideo(null);
      setManualFile(null);
      setManualAudio(null);
      return;
    }
    const type = file.type || '';
    if (type.startsWith('image/')) {
      const r = new FileReader();
      r.onloadend = () => setManualScreenshot(r.result);
      r.readAsDataURL(file);
    } else if (type.startsWith('video/')) {
      setManualVideo(file);
    } else if (type.startsWith('audio/')) {
      setManualAudio(file);
    } else {
      setManualFile(file);
    }
  }, []);

  /**
   * Extract any image (and other binary) from clipboard items and route
   * to handleFile. Returns true if anything was intercepted so the host
   * can preventDefault to skip the text-paste default.
   */
  const handlePaste = useCallback((event) => {
    const items = event?.clipboardData?.items;
    if (!items || !items.length) return false;
    let intercepted = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const file = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
      if (!file) continue;
      handleFile(file);
      intercepted = true;
    }
    if (intercepted && typeof event.preventDefault === 'function') event.preventDefault();
    return intercepted;
  }, [handleFile]);

  const handleDragEnter = useCallback((event) => {
    if (!event?.dataTransfer?.types?.includes?.('Files')) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDraggingOver(true);
  }, []);

  const handleDragOver = useCallback((event) => {
    if (!event?.dataTransfer?.types?.includes?.('Files')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event) => {
    if (!event?.dataTransfer?.types?.includes?.('Files')) return;
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((event) => {
    const files = event?.dataTransfer?.files;
    if (!files || !files.length) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
      return false;
    }
    event.preventDefault();
    for (let i = 0; i < files.length; i++) handleFile(files[i]);
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    return true;
  }, [handleFile]);

  const handleSubmit = () => {
    if (!description.trim() || isSubmitting) return;
    const feedbackData = {
      feedback: description.trim(),
      type: feedbackType,
      severity: priority,
      labels,
      screenshot: screenshot || manualScreenshot,
      videoBlob: videoBlob || manualVideo,
      audioBlob: manualAudio,
      attachment: manualFile,
      eventLogs: eventLogs || [],
      timestamp: new Date().toISOString(),
      url: window.location.href,
      component: elementInfo?.reactComponent || elementInfo?.tagName,
      elementInfo,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      userName,
      userEmail,
      userAvatar: userAvatar || null,
      selectedIntegrations,
      dotPosition: clickPosition || null,
    };
    onClose();
    if (onAsyncSubmit) onAsyncSubmit(feedbackData);
    else if (onSubmit) onSubmit(feedbackData);
  };

  const activeMedia = screenshot || manualScreenshot || videoBlob || manualVideo;
  const activeImage = screenshot || manualScreenshot;

  return {
    description, setDescription,
    feedbackType, setFeedbackType,
    priority, setPriority,
    labels, toggleLabel,
    selectedIntegrations, toggleIntegration,
    manualScreenshot, manualVideo, manualFile, manualAudio,
    setManualAudio,
    handleFile,
    handlePaste,
    handleDragEnter, handleDragOver, handleDragLeave, handleDrop,
    isDraggingOver,
    zoomedImage, setZoomedImage,
    videoUrl, audioUrl,
    isSubmitting,
    activeMedia, activeImage,
    descriptionRef,
    screenshotInputRef,
    handleSubmit,
  };
}
