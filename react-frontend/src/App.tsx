import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import EmbedPlayer from './components/EmbedPlayer';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/embed/:videoId" element={<EmbedPlayer />} />
    </Routes>
  );
}

export default App;
