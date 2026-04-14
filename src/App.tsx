import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MarketingApp from './marketing/MarketingApp';
import { AdminApp } from './admin/AdminApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 官网：保持原有逻辑与 UI，不受后台影响 */}
        <Route path="/" element={<MarketingApp />} />

        {/* 后台：仅 /admin/* 命中，完全隔离 */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
