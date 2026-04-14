import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAdminToken } from './adminToken';

export function RequireAdminAuth({ children }: { children: ReactNode }) {
  const token = getAdminToken();
  const loc = useLocation();
  if (!token) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  return children;
}

