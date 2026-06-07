import React from 'react';
import { useTranslation } from 'react-i18next';
import VideoPlayer from '../components/VideoPlayer';

interface Props {
  videoId: string;
}

export default function EmbedPlayer({ videoId }: Props) {
  const { t } = useTranslation();

  if (!videoId) {
    return <div style={{ color: 'white', padding: '20px' }}>{t('videoUnavailable', { ns: 'embed' })}</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black' }}>
      <VideoPlayer videoId={videoId} token={null} isEmbed={true} />
    </div>
  );
}