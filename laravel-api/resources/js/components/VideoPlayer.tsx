import { useEffect, useRef, useState } from 'react';
import Hls, { type ErrorData } from 'hls.js';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Loader2, RotateCcw, RotateCw, Gauge, WifiOff, Wifi, Expand, Shrink } from 'lucide-react';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DOUBLE_CLICK_MS = 300;
const SKIP_SECONDS = 10;

const MAX_NETWORK_RETRIES = 8;
const MAX_MEDIA_RETRIES = 2;
// Buffering longer than this (while online) is treated as a slow connection.
const SLOW_BUFFER_MS = 5000;
// Stalls inside this window count towards "unstable connection".
const STALL_WINDOW_MS = 60000;
const UNSTABLE_STALL_COUNT = 2;
// How long playback must run without stalls before ABR is allowed to climb aggressively again.
const STABLE_RECOVERY_MS = 90000;
const SLOW_NOTICE_MS = 4000;

// Fill (crop) vs. fit (letterbox) when the screen and video shapes differ,
// e.g. a 16:9 video on a 20:9 phone in landscape.
type FitMode = 'contain' | 'cover';
const FIT_MODE_STORAGE_KEY = 'player-fit-mode';
// Below this aspect-ratio difference the bars are too thin to bother.
const MIN_LETTERBOX_RATIO = 0.04;
// Pinch distance change needed to switch between fit and fill.
const PINCH_THRESHOLD = 0.15;

const readStoredFitMode = (): FitMode => {
  try {
    return localStorage.getItem(FIT_MODE_STORAGE_KEY) === 'cover' ? 'cover' : 'contain';
  } catch {
    return 'contain';
  }
};

// ABR bandwidth safety factors: default vs. when the connection is unstable.
const ABR_FACTORS_STABLE = { down: 0.8, up: 0.6 };
const ABR_FACTORS_UNSTABLE = { down: 0.6, up: 0.35 };

type PlaybackErrorKind = 'notReady' | 'unsupported' | 'decode' | 'forbidden' | 'notFound' | 'server' | 'timeout' | 'network' | 'unknown';

interface PlaybackError {
  kind: PlaybackErrorKind;
  // Technical detail shown under the message (HTTP status / hls.js error detail).
  code?: string;
}

const TIMEOUT_DETAILS = new Set<string>([
  Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT,
  Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT,
  Hls.ErrorDetails.FRAG_LOAD_TIMEOUT,
  Hls.ErrorDetails.KEY_LOAD_TIMEOUT,
]);

interface NetworkInformationLike extends EventTarget {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
}

const getConnection = (): NetworkInformationLike | undefined =>
  (navigator as Navigator & { connection?: NetworkInformationLike }).connection;

// Seed the ABR estimator from the browser's connection hint so the first
// fragment is fetched at a quality the connection can actually sustain.
const getInitialBandwidthEstimate = () => {
  const connection = getConnection();
  if (connection?.downlink) {
    return Math.max(connection.downlink * 1_000_000 * 0.7, 150_000);
  }
  if (connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return 150_000;
  if (connection?.effectiveType === '3g') return 700_000;
  return 1_000_000;
};

const getHttpStatus = (data: ErrorData): number | undefined => {
  const status = data.response?.code ?? (data.networkDetails as XMLHttpRequest | undefined)?.status;
  return typeof status === 'number' && status > 0 ? status : undefined;
};

const classifyNetworkError = (status: number | undefined, details: string): PlaybackErrorKind => {
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404 || status === 410) return 'notFound';
  if (status && status >= 500) return 'server';
  if (TIMEOUT_DETAILS.has(details)) return 'timeout';
  return 'network';
};

const isRetryable = (kind: PlaybackErrorKind) => kind === 'server' || kind === 'timeout' || kind === 'network';

const formatErrorCode = (status: number | undefined, details?: string) =>
  [status ? `HTTP ${status}` : null, details].filter(Boolean).join(' · ') || undefined;

interface VideoPlayerProps {
  videoId: string;
  token: string | null;
  onClose?: () => void;
  isEmbed?: boolean;
  primaryColor?: string;
  streamUrl?: string | null;
  thumbnailUrl?: string | null;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function VideoPlayer({ videoId, token, onClose, isEmbed = false, primaryColor, streamUrl, thumbnailUrl }: VideoPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const lastClickRef = useRef<{ time: number; side: 'left' | 'center' | 'right' } | null>(null);
  const playbackRateRef = useRef<number>(1);
  const savedTimeRef = useRef<number>(0);
  const wasPlayingRef = useRef<boolean>(true);
  const isReconnectingRef = useRef<boolean>(false);
  const playbackErrorRef = useRef<PlaybackError | null>(null);
  const networkRetryTimerRef = useRef<number | null>(null);

  const [levels, setLevels] = useState<number[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [autoLevelHeight, setAutoLevelHeight] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [slowNotice, setSlowNotice] = useState<string | null>(null);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState<'forward' | 'backward' | null>(null);
  const [playbackError, setPlaybackError] = useState<PlaybackError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [fitMode, setFitMode] = useState<FitMode>(readStoredFitMode);
  const [isLetterboxed, setIsLetterboxed] = useState(false);
  const pinchStartDistanceRef = useRef<number | null>(null);

  // Keep ref synchronized with state for event listeners
  playbackErrorRef.current = playbackError;
  isReconnectingRef.current = isReconnecting;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resolvedStreamUrl = streamUrl ?? `/api/videos/${videoId}/stream/playlist.m3u8`;
    let hls: Hls | null = null;
    let objectUrl: string | null = null;
    let nativeMetadataHandler: (() => void) | null = null;
    let networkRecoveryAttempts = 0;
    let mediaRecoveryAttempts = 0;
    let levelHeights: number[] = [];
    let stallTimes: number[] = [];
    let isUnstable = false;
    let slowBufferTimer: number | null = null;
    let stableRecoveryTimer: number | null = null;
    let slowNoticeTimer: number | null = null;

    setPlaybackError(null);
    playbackErrorRef.current = null;
    setIsBuffering(true);
    setLevels([]);
    setSelectedLevel(-1);
    setAutoLevelHeight(null);
    setSlowNotice(null);

    const clearTimer = (timer: number | null) => {
      if (timer) clearTimeout(timer);
      return null;
    };

    const setReconnecting = (value: boolean) => {
      setIsReconnecting(value);
      isReconnectingRef.current = value;
    };

    const showPlaybackError = (error: PlaybackError) => {
      console.warn('[VideoPlayer] Playback error:', error);
      setPlaybackError(error);
      playbackErrorRef.current = error;
      setIsBuffering(false);
      setReconnecting(false);
      slowBufferTimer = clearTimer(slowBufferTimer);
      networkRetryTimerRef.current = clearTimer(networkRetryTimerRef.current);
      if (hls) {
        hls.destroy();
        hls = null;
        hlsRef.current = null;
      }
    };

    if (!resolvedStreamUrl) {
      showPlaybackError({ kind: 'notReady' });
      return;
    }

    const flashSlowNotice = (message: string) => {
      setSlowNotice(message);
      slowNoticeTimer = clearTimer(slowNoticeTimer);
      slowNoticeTimer = window.setTimeout(() => setSlowNotice(null), SLOW_NOTICE_MS);
    };

    const applyAbrFactors = (unstable: boolean) => {
      if (!hls) return;
      const factors = unstable ? ABR_FACTORS_UNSTABLE : ABR_FACTORS_STABLE;
      // hls.js reads these from config on every ABR decision, so changing them live takes effect immediately.
      hls.config.abrBandWidthFactor = factors.down;
      hls.config.abrBandWidthUpFactor = factors.up;
    };

    // Called whenever playback stalls or a fragment is too slow. In Auto mode
    // we step one rendition down right away, and if stalls keep happening we
    // make ABR more conservative so it stops bouncing back up to a quality
    // the connection can't hold.
    const handleConnectionStruggle = () => {
      if (!hls || !hls.autoLevelEnabled || !navigator.onLine) return;

      const now = Date.now();
      stallTimes = stallTimes.filter(time => now - time < STALL_WINDOW_MS);
      stallTimes.push(now);

      if (!isUnstable && stallTimes.length >= UNSTABLE_STALL_COUNT) {
        isUnstable = true;
        applyAbrFactors(true);
      }

      stableRecoveryTimer = clearTimer(stableRecoveryTimer);
      stableRecoveryTimer = window.setTimeout(() => {
        isUnstable = false;
        stallTimes = [];
        applyAbrFactors(false);
      }, STABLE_RECOVERY_MS);

      const current = hls.currentLevel >= 0 ? hls.currentLevel : hls.nextLoadLevel;
      const target = Math.max(current - 1, hls.minAutoLevel);
      if (current >= 0 && target < current) {
        hls.nextAutoLevel = target;
        const height = levelHeights[target];
        flashSlowNotice(height ? t('player.slowConnectionLowered', { quality: `${height}p` }) : t('player.slowConnection'));
      } else {
        flashSlowNotice(t('player.slowConnection'));
      }
    };

    const startSlowBufferWatch = () => {
      if (slowBufferTimer) return;
      slowBufferTimer = window.setTimeout(() => {
        slowBufferTimer = null;
        if (!navigator.onLine) return;
        if (hls) {
          handleConnectionStruggle();
        } else {
          flashSlowNotice(t('player.slowConnection'));
        }
      }, SLOW_BUFFER_MS);
    };

    const handleSuccessfulLoad = () => {
      networkRecoveryAttempts = 0;
      mediaRecoveryAttempts = 0;
      setReconnecting(false);
      setIsOffline(false);
      setIsBuffering(false);
      slowBufferTimer = clearTimer(slowBufferTimer);
      networkRetryTimerRef.current = clearTimer(networkRetryTimerRef.current);
    };

    const enterOfflineState = () => {
      setIsOffline(true);
      setReconnecting(true);
      setIsBuffering(true);
      slowBufferTimer = clearTimer(slowBufferTimer);
      networkRetryTimerRef.current = clearTimer(networkRetryTimerRef.current);
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000,

        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 6,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 64000,

        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 64000,

        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 30,

        // Adaptive bitrate: start from the browser's bandwidth hint, measure the
        // first fragment, and keep headroom so a dip doesn't cause a stall.
        startLevel: -1,
        testBandwidth: true,
        abrEwmaDefaultEstimate: getInitialBandwidthEstimate(),
        abrBandWidthFactor: ABR_FACTORS_STABLE.down,
        abrBandWidthUpFactor: ABR_FACTORS_STABLE.up,
        abrMaxWithRealBitrate: true,
        capLevelToPlayerSize: true,

        autoStartLoad: true,
        enableWorker: true,
        lowLatencyMode: false,

        xhrSetup: (xhr) => {
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        levelHeights = data.levels.map(level => level.height);
        setLevels(levelHeights);
        if (savedTimeRef.current > 0 && video) {
          try {
            video.currentTime = savedTimeRef.current;
          } catch (e) {
            console.warn('[VideoPlayer] Could not restore currentTime:', e);
          }
        }
        if (wasPlayingRef.current) {
          video.play().then(() => setIsPlaying(true)).catch(e => console.log('Autoplay prevented:', e));
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setAutoLevelHeight(levelHeights[data.level] ?? null);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, handleSuccessfulLoad);
      hls.on(Hls.Events.FRAG_LOADED, handleSuccessfulLoad);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          // Recoverable hiccups that signal a slow/unstable connection.
          if (
            data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
            data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR
          ) {
            handleConnectionStruggle();
          }
          return;
        }

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR: {
            // Connection dropped: wait for the browser's "online" event instead
            // of burning through retries while there's no network at all.
            if (!navigator.onLine) {
              enterOfflineState();
              return;
            }

            const status = getHttpStatus(data);
            const kind = classifyNetworkError(status, data.details);
            const code = formatErrorCode(status, data.details);

            if (!isRetryable(kind) || networkRecoveryAttempts >= MAX_NETWORK_RETRIES) {
              showPlaybackError({ kind, code });
              return;
            }

            networkRecoveryAttempts += 1;
            setReconnecting(true);
            setIsBuffering(true);

            // Repeated failures on a slow link: fall back to the lowest quality
            // so the next attempt has the best chance of getting through.
            if (networkRecoveryAttempts >= 2 && hls?.autoLevelEnabled && levelHeights.length > 1) {
              hls.nextAutoLevel = hls.minAutoLevel;
              isUnstable = true;
              applyAbrFactors(true);
            }

            const delay = Math.min(1000 * Math.pow(1.5, networkRecoveryAttempts - 1), 8000);
            console.warn(`[VideoPlayer] Network error ${code ?? ''} (attempt ${networkRecoveryAttempts}/${MAX_NETWORK_RETRIES}). Retrying in ${delay}ms...`);

            networkRetryTimerRef.current = clearTimer(networkRetryTimerRef.current);
            networkRetryTimerRef.current = window.setTimeout(() => {
              networkRetryTimerRef.current = null;
              hlsRef.current?.startLoad(savedTimeRef.current > 0 ? savedTimeRef.current : -1);
            }, delay);
            return;
          }

          case Hls.ErrorTypes.MEDIA_ERROR:
            if (mediaRecoveryAttempts < MAX_MEDIA_RETRIES) {
              mediaRecoveryAttempts += 1;
              console.warn(`[VideoPlayer] Media error (attempt ${mediaRecoveryAttempts}/${MAX_MEDIA_RETRIES}). Recovering...`);
              if (mediaRecoveryAttempts === 1) {
                hls?.recoverMediaError();
              } else {
                hls?.swapAudioCodec();
                hls?.recoverMediaError();
              }
              return;
            }
            showPlaybackError({ kind: 'decode', code: data.details });
            break;

          default:
            showPlaybackError({ kind: 'unknown', code: data.details });
            break;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari/iOS) does its own adaptive bitrate switching.
      if (token) {
        fetch(resolvedStreamUrl, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => {
            if (!res.ok) {
              const kind = classifyNetworkError(res.status, '');
              if (!isRetryable(kind)) {
                showPlaybackError({ kind, code: `HTTP ${res.status}` });
                return null;
              }
              throw new Error(`HTTP ${res.status}`);
            }
            return res.blob();
          })
          .then(blob => {
            if (!blob) return;
            objectUrl = URL.createObjectURL(blob);
            video.src = objectUrl;
          })
          .catch(() => {
            video.src = resolvedStreamUrl;
          });
      } else {
        video.src = resolvedStreamUrl;
      }

      nativeMetadataHandler = () => {
        if (savedTimeRef.current > 0) {
          try {
            video.currentTime = savedTimeRef.current;
          } catch {}
        }
        if (wasPlayingRef.current) {
          video.play().then(() => setIsPlaying(true)).catch(e => console.log('Autoplay prevented:', e));
        }
      };
      video.addEventListener('loadedmetadata', nativeMetadataHandler);
    } else {
      showPlaybackError({ kind: 'unsupported' });
    }

    const applyPlaybackRate = () => {
      video.playbackRate = playbackRateRef.current;
    };

    const handleTimeUpdate = () => {
      if (video.currentTime > 0) {
        savedTimeRef.current = video.currentTime;
      }
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => {
      wasPlayingRef.current = true;
      setIsPlaying(true);
    };
    const handlePause = () => {
      if (!isReconnectingRef.current) {
        wasPlayingRef.current = false;
      }
      setIsPlaying(false);
    };
    const handleWaiting = () => {
      setIsBuffering(true);
      startSlowBufferWatch();
    };
    const handlePlaying = () => handleSuccessfulLoad();
    const handleStalled = () => {
      setIsBuffering(true);
      startSlowBufferWatch();
      if (hlsRef.current && !isReconnectingRef.current && navigator.onLine) {
        hlsRef.current.startLoad();
      }
    };

    const handleVideoError = () => {
      // If Hls.js is active, error handling is managed by Hls
      if (hlsRef.current || playbackErrorRef.current) return;

      const mediaError = video.error;
      if (mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        showPlaybackError({ kind: 'unsupported', code: mediaError.message || 'MEDIA_ERR_SRC_NOT_SUPPORTED' });
        return;
      }
      if (mediaError?.code === MediaError.MEDIA_ERR_DECODE) {
        showPlaybackError({ kind: 'decode', code: mediaError.message || 'MEDIA_ERR_DECODE' });
        return;
      }

      if (!navigator.onLine) {
        enterOfflineState();
        return;
      }

      if (networkRecoveryAttempts < MAX_NETWORK_RETRIES) {
        networkRecoveryAttempts += 1;
        setReconnecting(true);
        setIsBuffering(true);
        const delay = Math.min(1000 * Math.pow(1.5, networkRecoveryAttempts - 1), 8000);
        networkRetryTimerRef.current = clearTimer(networkRetryTimerRef.current);
        networkRetryTimerRef.current = window.setTimeout(() => {
          if (savedTimeRef.current > 0) {
            try { video.currentTime = savedTimeRef.current; } catch {}
          }
          video.load();
          if (wasPlayingRef.current) {
            video.play().catch(() => {});
          }
        }, delay);
        return;
      }

      showPlaybackError({ kind: 'network', code: mediaError?.message || 'MEDIA_ERR_NETWORK' });
    };

    const handleOnline = () => {
      console.log('[VideoPlayer] Browser went online. Recovering stream...');
      setIsOffline(false);
      networkRecoveryAttempts = 0;
      mediaRecoveryAttempts = 0;
      if (playbackErrorRef.current) {
        // Only auto-recover from errors that a dropped connection could cause.
        if (!isRetryable(playbackErrorRef.current.kind)) return;
        setPlaybackError(null);
        playbackErrorRef.current = null;
        setIsBuffering(true);
        setReconnecting(true);
        setRetryKey(k => k + 1);
      } else if (hlsRef.current) {
        setReconnecting(true);
        setIsBuffering(true);
        hlsRef.current.startLoad(savedTimeRef.current > 0 ? savedTimeRef.current : -1);
        if (wasPlayingRef.current && videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      } else if (videoRef.current) {
        setRetryKey(k => k + 1);
      }
    };

    const handleOffline = () => {
      console.log('[VideoPlayer] Browser went offline.');
      // Keep playing whatever is already buffered; the overlay only shows once
      // the buffer runs dry or a request fails.
      setIsOffline(true);
    };

    // The browser's own estimate changed (e.g. Wi-Fi → mobile data). If it
    // dropped below what ABR currently assumes, pull the estimate down so the
    // next fragment is requested at a sustainable quality.
    const connection = getConnection();
    const handleConnectionChange = () => {
      const activeHls = hlsRef.current;
      if (!activeHls || !connection?.downlink) return;
      const hinted = connection.downlink * 1_000_000 * 0.7;
      if (hinted < activeHls.bandwidthEstimate) {
        activeHls.bandwidthEstimate = Math.max(hinted, 150_000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connection?.addEventListener('change', handleConnectionChange);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('error', handleVideoError);
    video.addEventListener('loadedmetadata', applyPlaybackRate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connection?.removeEventListener('change', handleConnectionChange);
      networkRetryTimerRef.current = clearTimer(networkRetryTimerRef.current);
      clearTimer(slowBufferTimer);
      clearTimer(stableRecoveryTimer);
      clearTimer(slowNoticeTimer);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('error', handleVideoError);
      video.removeEventListener('loadedmetadata', applyPlaybackRate);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (nativeMetadataHandler) {
        video.removeEventListener('loadedmetadata', nativeMetadataHandler);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, token, streamUrl, retryKey]);

  const handleManualRetry = () => {
    setPlaybackError(null);
    playbackErrorRef.current = null;
    setIsBuffering(true);
    setIsReconnecting(true);
    isReconnectingRef.current = true;
    setRetryKey(k => k + 1);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (video && !playbackError) {
      if (isPlaying) {
        video.pause();
        wasPlayingRef.current = false;
      } else {
        wasPlayingRef.current = true;
        video.play().catch((err) => {
          if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') {
            console.error('Play error:', err);
          }
        });
      }
    }
  };

  // Single click toggles play/pause. A second click on the same side within
  // DOUBLE_CLICK_MS skips 10s (left = back, right = forward) instead.
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const rect = playerContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      togglePlay();
      return;
    }

    const relativeX = (e.clientX - rect.left) / rect.width;
    const side: 'left' | 'center' | 'right' = relativeX < 0.4 ? 'left' : relativeX > 0.6 ? 'right' : 'center';
    const now = Date.now();
    const last = lastClickRef.current;

    if (last && side !== 'center' && last.side === side && now - last.time < DOUBLE_CLICK_MS) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      lastClickRef.current = null;

      if (!playbackError) {
        if (side === 'left') {
          skipBackward();
        } else {
          skipForward();
        }
      }
      return;
    }

    lastClickRef.current = { time: now, side };

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      lastClickRef.current = null;
      togglePlay();
    }, DOUBLE_CLICK_MS);
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    playbackRateRef.current = rate;
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setIsSpeedMenuOpen(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
    setIsMuted(newVolume === 0);
  };

  const skipBackward = () => {
    if (videoRef.current) {
      const newTime = Math.max(videoRef.current.currentTime - 10, 0);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setSkipAnimation('backward');
      setTimeout(() => setSkipAnimation(null), 500);
    }
  };

  const skipForward = () => {
    if (videoRef.current) {
      const newTime = Math.min(videoRef.current.currentTime + 10, duration);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setSkipAnimation('forward');
      setTimeout(() => setSkipAnimation(null), 500);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      if (newMutedState) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Track whether the video's shape differs from the player's (black bars),
  // so the fit/fill toggle is only offered when it would change anything.
  useEffect(() => {
    const container = playerContainerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height || !video.videoWidth || !video.videoHeight) {
        setIsLetterboxed(false);
        return;
      }
      const containerRatio = width / height;
      const videoRatio = video.videoWidth / video.videoHeight;
      setIsLetterboxed(Math.abs(containerRatio - videoRatio) / videoRatio > MIN_LETTERBOX_RATIO);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    video.addEventListener('loadedmetadata', measure);
    video.addEventListener('resize', measure);
    measure();

    return () => {
      observer.disconnect();
      video.removeEventListener('loadedmetadata', measure);
      video.removeEventListener('resize', measure);
    };
  }, []);

  const applyFitMode = (mode: FitMode) => {
    setFitMode(mode);
    try {
      localStorage.setItem(FIT_MODE_STORAGE_KEY, mode);
    } catch {}
  };

  const toggleFitMode = () => applyFitMode(fitMode === 'cover' ? 'contain' : 'cover');

  const getTouchDistance = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  // Pinch out to fill the screen, pinch in to fit the whole video.
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    pinchStartDistanceRef.current = e.touches.length === 2 ? getTouchDistance(e.touches) : null;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const startDistance = pinchStartDistanceRef.current;
    if (startDistance === null || e.touches.length !== 2 || !isLetterboxed) return;

    const scale = getTouchDistance(e.touches) / startDistance;
    if (scale > 1 + PINCH_THRESHOLD && fitMode !== 'cover') {
      applyFitMode('cover');
      pinchStartDistanceRef.current = null;
    } else if (scale < 1 - PINCH_THRESHOLD && fitMode !== 'contain') {
      applyFitMode('contain');
      pinchStartDistanceRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistanceRef.current = null;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsQualityMenuOpen(false);
        setIsSpeedMenuOpen(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
      setIsQualityMenuOpen(false);
      setIsSpeedMenuOpen(false);
    }
  };

  const handleQualityChange = (level: number) => {
    setSelectedLevel(level);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
    }
    setIsQualityMenuOpen(false);
  };

  const playerContent = (
    <div
      className="video-container"
      ref={playerContainerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#000', borderRadius: isFullscreen || isEmbed ? '0' : '12px', width: isEmbed ? '100vw' : undefined, height: isEmbed ? '100vh' : undefined, '--primary': primaryColor || '#4f46e5' } as React.CSSProperties}
    >
      {(isBuffering || isReconnecting) && !playbackError && (
        <div className={`player-loading-overlay ${isReconnecting || isOffline ? 'reconnecting' : ''}`} role="status">
          {isOffline && isBuffering ? (
            <WifiOff size={44} color="#fff" />
          ) : (
            <Loader2 className="spinner" size={48} color={primaryColor || "#4f46e5"} />
          )}
          {isOffline && isBuffering ? (
            <span className="player-reconnecting-text">{t('player.offlineWaiting')}</span>
          ) : isReconnecting ? (
            <span className="player-reconnecting-text">{t('player.reconnecting')}</span>
          ) : null}
        </div>
      )}

      {!playbackError && (slowNotice || (isOffline && !isBuffering)) && (
        <div className="player-network-notice" role="status">
          {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
          <span>{isOffline ? t('player.offlineBuffered') : slowNotice}</span>
        </div>
      )}

      {playbackError && (
        <div className="player-error-overlay" role="alert">
          {playbackError.kind === 'network' || playbackError.kind === 'timeout' ? (
            <WifiOff className="player-error-icon" size={34} />
          ) : (
            <AlertTriangle className="player-error-icon" size={34} />
          )}
          <div className="player-error-title">{t(`player.errors.${playbackError.kind}.title`)}</div>
          <div className="player-error-message">{t(`player.errors.${playbackError.kind}.message`)}</div>
          {playbackError.code && (
            <div className="player-error-code" dir="ltr">{t('player.errorCode', { code: playbackError.code })}</div>
          )}
          {playbackError.kind !== 'unsupported' && playbackError.kind !== 'notFound' && (
            <button className="player-error-retry" type="button" onClick={handleManualRetry}>
              {t('player.tryAgain')}
            </button>
          )}
        </div>
      )}

      {skipAnimation && (
        <div className={`skip-animation ${skipAnimation}`}>
          {skipAnimation === 'forward' ? <RotateCw size={36} /> : <RotateCcw size={36} />}
          <span>10s</span>
        </div>
      )}

      <video
        ref={videoRef}
        onClick={handleVideoClick}
        playsInline
        poster={thumbnailUrl || undefined}
        style={{ width: '100%', height: '100%', outline: 'none', objectFit: isLetterboxed ? fitMode : 'contain', cursor: 'pointer', backgroundColor: 'transparent' }}
      />

      {!playbackError && <div
        className={`custom-controls-bar ${showControls ? 'visible' : 'hidden'}`}
      >
        <div className="progress-container">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="progress-slider"
            style={{ backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%` }}
          />
        </div>

        <div className="controls-row">
          <div className="controls-left">
            <button className="control-btn skip-btn" onClick={skipBackward} title="Rewind 10s">
              <RotateCcw size={24} />
              <span className="skip-text">10</span>
            </button>
            <button className="control-btn" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <button className="control-btn skip-btn" onClick={skipForward} title="Forward 10s">
              <RotateCw size={24} />
              <span className="skip-text">10</span>
            </button>

            <div className="volume-container">
              <button className="control-btn" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
                style={{ backgroundSize: `${(isMuted ? 0 : volume) * 100}% 100%` }}
              />
            </div>

            <div className="time-display" dir="ltr">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="controls-right">
            <div className="quality-selector-container">
              <button
                className="control-btn quality-btn"
                title="Playback speed"
                onClick={(e) => { e.stopPropagation(); setIsQualityMenuOpen(false); setIsSpeedMenuOpen(!isSpeedMenuOpen); }}
              >
                <Gauge size={20} />
                <span className="quality-label">{playbackRate === 1 ? '1x' : `${playbackRate}x`}</span>
              </button>

              {isSpeedMenuOpen && (
                <div className="quality-menu">
                  {PLAYBACK_SPEEDS.map((rate) => (
                    <button
                      key={rate}
                      onClick={(e) => { e.stopPropagation(); handlePlaybackRateChange(rate); }}
                      className={`quality-menu-item ${playbackRate === rate ? 'active' : ''}`}
                    >
                      <span>{rate === 1 ? 'Normal' : `${rate}x`}</span>
                      {playbackRate === rate && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {levels.length > 0 && (
              <div className="quality-selector-container">
                <button
                  className="control-btn quality-btn"
                  onClick={(e) => { e.stopPropagation(); setIsSpeedMenuOpen(false); setIsQualityMenuOpen(!isQualityMenuOpen); }}
                >
                  <Settings size={20} />
                  <span className="quality-label">{selectedLevel === -1 ? (autoLevelHeight ? `${t('player.auto')} (${autoLevelHeight}p)` : t('player.auto')) : `${levels[selectedLevel]}p`}</span>
                </button>

                {isQualityMenuOpen && (
                  <div className="quality-menu">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQualityChange(-1); }}
                      className={`quality-menu-item ${selectedLevel === -1 ? 'active' : ''}`}
                    >
                      <span>{t('player.auto')}{selectedLevel === -1 && autoLevelHeight ? ` (${autoLevelHeight}p)` : ''}</span>
                      {selectedLevel === -1 && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </button>
                    {levels.map((height, index) => (
                      <button
                        key={index}
                        onClick={(e) => { e.stopPropagation(); handleQualityChange(index); }}
                        className={`quality-menu-item ${selectedLevel === index ? 'active' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {height}p
                          {height >= 1080 && <span className="hd-badge">HD</span>}
                        </div>
                        {selectedLevel === index && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isLetterboxed && (
              <button
                className="control-btn"
                onClick={toggleFitMode}
                title={fitMode === 'cover' ? t('player.fitToScreen') : t('player.fillScreen')}
                aria-label={fitMode === 'cover' ? t('player.fitToScreen') : t('player.fillScreen')}
              >
                {fitMode === 'cover' ? <Shrink size={20} /> : <Expand size={20} />}
              </button>
            )}
            <button className="control-btn" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );

  if (isEmbed) {
    return playerContent;
  }

  return (
    <div className="player-modal-overlay" onClick={onClose}>
      <div className="player-modal-content" onClick={e => e.stopPropagation()}>
        <button className="player-close-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        {playerContent}
      </div>
    </div>
  );
}
