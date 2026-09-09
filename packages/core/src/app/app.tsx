import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AssetsPage } from './routes/assets.tsx';
import { FrameView } from './routes/frame-view.tsx';
import { Home } from './routes/home.tsx';
import { HomeShell } from './routes/home-shell.tsx';
import { ThemeDetail } from './routes/theme-detail.tsx';
import { Themes } from './routes/themes.tsx';

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* Frames, themes and assets share one sidebar; a canvas has its own chrome. */}
        <Route element={<HomeShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/themes/:themeId" element={<ThemeDetail />} />
          <Route path="/assets" element={<AssetsPage />} />
        </Route>
        <Route path="/f/:fileId" element={<FrameView />} />
      </Routes>
    </BrowserRouter>
  );
}
