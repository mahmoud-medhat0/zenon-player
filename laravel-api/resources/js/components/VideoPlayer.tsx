import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Loader2, RotateCcw, RotateCw } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  token: string | null;
  onClose?: () => void;
  isEmbed?: boolean;
  primaryColor?: string;
  streamUrl?: string | null;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function VideoPlayer({ videoId, token, onClose, isEmbed = false, primaryColor, streamUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const [levels, setLevels] = useState<number[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState<'forward' | 'backward' | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resolvedStreamUrl = streamUrl ?? `/api/videos/${videoId}/stream/playlist.m3u8`;
    let hls: Hls | null = null;
    let objectUrl: string | null = null;
    let nativeMetadataHandler: (() => void) | null = null;
    let networkRecoveryAttempts = 0;
    let mediaRecoveryAttempts = 0;

    setPlaybackError(null);
    setIsBuffering(true);
    setLevels([]);
    setSelectedLevel(-1);

    const showPlaybackError = (message: string) => {
      setPlaybackError(message);
      setIsBuffering(false);
      if (hls) {
        hls.destroy();
        hls = null;
        hlsRef.current = null;
      }
    };

    if (!resolvedStreamUrl) {
      showPlaybackError('This video is not ready to play yet.');
      return;
    }

    if (Hls.isSupported()) {
      hls = new Hls();
      hlsRef.current = hls;

      hls.loadSource(resolvedStreamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels.map((l: any) => l.height));
        video.play().then(() => setIsPlaying(true)).catch(e => console.error("Autoplay prevented:", e));
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRecoveryAttempts < 2) {
                networkRecoveryAttempts += 1;
                hls?.startLoad();
                return;
              }
              showPlaybackError('The video stream could not be loaded. It may be private, unavailable, or blocked by the network.');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRecoveryAttempts < 1) {
                mediaRecoveryAttempts += 1;
                hls?.recoverMediaError();
                return;
              }
              showPlaybackError('This video cannot be played in the current browser.');
              break;
            default:
              showPlaybackError('Playback failed. Please try again later.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      if (token) {
        fetch(resolvedStreamUrl, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            return res.blob();
          })
          .then(blob => {
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
        video.play().then(() => setIsPlaying(true)).catch(e => console.error("Autoplay prevented:", e));
      };
      video.addEventListener('loadedmetadata', nativeMetadataHandler);
    } else {
      showPlaybackError('This browser cannot play this video stream.');
    }

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleVideoError = () => {
      showPlaybackError('The video stream could not be loaded. It may be private, unavailable, or blocked by the network.');
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleVideoError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleVideoError);
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
  }, [videoId, token, streamUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (video && !playbackError) {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(() => {
          setPlaybackError('Playback could not start. Please try again.');
          setIsBuffering(false);
        });
      }
    }
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

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setIsQualityMenuOpen(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
      setIsQualityMenuOpen(false);
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
      style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#000', borderRadius: isFullscreen || isEmbed ? '0' : '12px', width: isEmbed ? '100vw' : undefined, height: isEmbed ? '100vh' : undefined, '--primary': primaryColor || '#4f46e5' } as React.CSSProperties}
    >
      {isBuffering && !playbackError && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <Loader2 className="spinner" size={48} color="#4f46e5" />
        </div>
      )}

      {playbackError && (
        <div className="player-error-overlay" role="alert">
          <AlertTriangle className="player-error-icon" size={34} />
          <div className="player-error-title">Video unavailable</div>
          <div className="player-error-message">{playbackError}</div>
          <button className="player-error-retry" type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
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
        onClick={togglePlay}
        playsInline
        style={{ width: '100%', height: '100%', outline: 'none', objectFit: 'contain', cursor: 'pointer' }}
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

            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="controls-right">
            {levels.length > 0 && (
              <div className="quality-selector-container">
                <button
                  className="control-btn quality-btn"
                  onClick={(e) => { e.stopPropagation(); setIsQualityMenuOpen(!isQualityMenuOpen); }}
                >
                  <Settings size={20} />
                  <span className="quality-label">{selectedLevel === -1 ? 'Auto' : `${levels[selectedLevel]}p`}</span>
                </button>

                {isQualityMenuOpen && (
                  <div className="quality-menu">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQualityChange(-1); }}
                      className={`quality-menu-item ${selectedLevel === -1 ? 'active' : ''}`}
                    >
                      <span>Auto</span>
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
