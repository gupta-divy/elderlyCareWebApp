import type { AppRole } from '../../contexts/AuthContext';

export function getHomeRoute(role: AppRole | null | undefined) {
  return role === 'parent' ? '/parent' : '/child';
}

