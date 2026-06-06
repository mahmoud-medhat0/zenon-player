import React from 'react';
import { useParams } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';

const EmbedPlayer: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();

  if (!videoId) {
    return <div style={{ color: 'white', padding: '20px' }}>Invalid video ID</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'black' }}>
      <VideoPlayer 
        videoId={videoId} 
        token={null} 
        isEmbed={true}
      />
    </div>
  );
};

export default EmbedPlayer;
