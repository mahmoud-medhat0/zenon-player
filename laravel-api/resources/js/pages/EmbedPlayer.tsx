import { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import VideoPlayer from '../components/VideoPlayer';

interface Props {
  videoId: string;
}

interface EmbedVideo {
  id: string;
  status: string;
  stream_url: string | null;
  branding?: {
    primary_color?: string | null;
  };
}

function EmbedMessage({ message, isLoading = false }: { message: string; isLoading?: boolean }) {
  return (
    <div className="embed-frame-message" role={isLoading ? 'status' : 'alert'}>
      {isLoading && <div className="spinner embed-frame-spinner" />}
      <div>{message}</div>
    </div>
  );
}

export default function EmbedPlayer({ videoId }: Props) {
  const { t } = useTranslation();
  const [video, setVideo] = useState<EmbedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setErrorMessage(null);
    setVideo(null);

    if (!videoId) {
      setErrorMessage(t('embed.videoUnavailable'));
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    axios.get<EmbedVideo>(`/api/public/videos/${videoId}${token ? `?token=${token}` : ''}`)
      .then(({ data }) => {
        if (cancelled) return;

        if (data.status === 'processing') {
          setErrorMessage(t('embed.videoProcessing'));
          return;
        }

        if (data.status === 'failed') {
          setErrorMessage(t('embed.videoFailed'));
          return;
        }

        if (data.status !== 'ready' || !data.stream_url) {
          setErrorMessage(t('embed.videoUnavailable'));
          return;
        }

        setVideo(data);
      })
      .catch((error) => {
        if (cancelled) return;

        const status = error?.response?.status;
        if (status === 403) {
          setErrorMessage(t('embed.videoPrivate'));
        } else if (status === 404) {
          setErrorMessage(t('embed.videoUnavailable'));
        } else {
          setErrorMessage(t('embed.failedToLoad'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, t]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, backgroundColor: 'black' }}>
      {isLoading && <EmbedMessage message={t('embed.loadingVideo')} isLoading />}
      {!isLoading && errorMessage && <EmbedMessage message={errorMessage} />}
      {!isLoading && video && (
        <VideoPlayer
          videoId={video.id}
          token={null}
          isEmbed={true}
          streamUrl={video.stream_url}
          primaryColor={video.branding?.primary_color || '#4f46e5'}
        />
      )}
    </div>
  );
}
