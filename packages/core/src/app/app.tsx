import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from './lib/i18n.tsx';
import { AssetsPage } from './routes/assets.tsx';
import { FrameAssets } from './routes/frame-assets.tsx';
import { FrameView } from './routes/frame-view.tsx';
import { Home } from './routes/home.tsx';
import { HomeShell } from './routes/home-shell.tsx';
import { ThemeDetail } from './routes/theme-detail.tsx';
import { Themes } from './routes/themes.tsx';

export function App() {
  return (
    <LocaleProvider>
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
          <Route path="/f/:fileId/assets" element={<FrameAssets />} />
        </Routes>
      </BrowserRouter>
    </LocaleProvider>
  );
}
