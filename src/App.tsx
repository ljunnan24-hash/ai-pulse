import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminApp } from './admin/AdminApp';
import { SiteLayout } from './layouts/SiteLayout';
import AboutPage from './pages/AboutPage';
import ArchivePage from './pages/ArchivePage';
import EventDetailPage from './pages/EventDetailPage';
import HomePage from './pages/HomePage';
import RankingsPage from './pages/RankingsPage';
import WeeklyLatestPage from './pages/WeeklyLatestPage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import SubscribePage from './pages/SubscribePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />

        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/weekly/latest" element={<WeeklyLatestPage />} />
          <Route path="/weekly/:date" element={<WeeklyReportPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/subscribe" element={<SubscribePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
