import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import api from '../api/client';

interface EmbedVideo {
  id: string;
  status: string;
  stream_url: string | null;
  branding?: {
    primary_color?: string | null;
  };
}

const EmbedMessage: React.FC<{ message: string; isLoading?: boolean }> = ({ message, isLoading = false }) => (
  <div className="embed-frame-message" role={isLoading ? 'status' : 'alert'}>
    {isLoading && <div className="spinner embed-frame-spinner" />}
    <div>{message}</div>
  </div>
);

const EmbedPlayer: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<EmbedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setErrorMessage(null);
    setVideo(null);

    if (!videoId) {
      setErrorMessage('Video unavailable');
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    api.get<EmbedVideo>(`/public/videos/${videoId}`)
      .then(({ data }) => {
        if (cancelled) return;

        if (data.status === 'processing') {
          setErrorMessage('This video is still processing.');
          return;
        }

        if (data.status === 'failed') {
          setErrorMessage('This video could not be processed.');
          return;
        }

        if (data.status !== 'ready' || !data.stream_url) {
          setErrorMessage('Video unavailable');
          return;
        }

        setVideo(data);
      })
      .catch((error) => {
        if (cancelled) return;

        const status = error?.response?.status;
        if (status === 403) {
          setErrorMessage('This video is private.');
        } else if (status === 404) {
          setErrorMessage('Video unavailable');
        } else {
          setErrorMessage('Failed to load video. Please try again later.');
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
  }, [videoId]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black' }}>
      {isLoading && <EmbedMessage message="Loading video..." isLoading />}
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
};

export default EmbedPlayer;
