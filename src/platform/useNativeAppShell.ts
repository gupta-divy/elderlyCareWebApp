import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { useLocation, useNavigate } from 'react-router-dom';
import { platformServices } from '.';

const nativeHomePaths = new Set(['/login', '/parent', '/child']);
const ROUTE_RESTORE_KEY = 'setu-route-restore';

function isProtectedAppRoute(path: string) {
  return path === '/parent' || path.startsWith('/parent/') || path === '/child' || path.startsWith('/child/');
}

function routeFromDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'setu:') {
      return `/${parsed.hostname}${parsed.pathname}`.replace(/\/+/g, '/');
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  } catch {
    return null;
  }
}

function getNativeBackFallback(path: string) {
  if (path === '/signup') return '/login';
  if (path.startsWith('/parent/documents/')) return '/parent/documents';
  if (path === '/parent/send-photo' || path.startsWith('/parent/')) return '/parent';
  if (path.startsWith('/child/documents/')) return '/child/documents';
  if (path === '/child/remote-support/join') return '/child/remote-support';
  if (path.startsWith('/child/')) return '/child';
  return null;
}

function hasBrowserHistoryBackEntry() {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === 'number' && state.idx > 0;
}

export function useNativeAppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!platformServices.platform.isNative || !Capacitor.isPluginAvailable('App')) return;

    let isMounted = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    void CapacitorApp.addListener('appUrlOpen', (event) => {
      const route = routeFromDeepLink(event.url);
      if (route) navigate(route);
    }).then((handle) => {
      if (isMounted) handles.push(handle);
      else void handle.remove();
    });

    void CapacitorApp.getLaunchUrl().then((launchUrl) => {
      if (!isMounted || !launchUrl?.url) return;
      const route = routeFromDeepLink(launchUrl.url);
      if (route) navigate(route, { replace: true });
    });

    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive || !isProtectedAppRoute(location.pathname)) return;

      localStorage.setItem(
        ROUTE_RESTORE_KEY,
        JSON.stringify({
          path: `${location.pathname}${location.search}${location.hash}`,
          backgroundedAt: Date.now(),
        }),
      );
    }).then((handle) => {
      if (isMounted) handles.push(handle);
      else void handle.remove();
    });

    return () => {
      isMounted = false;
      handles.forEach((handle) => void handle.remove());
    };
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!platformServices.platform.isAndroid || !Capacitor.isPluginAvailable('App')) return;

    let isMounted = true;
    let backButtonHandle: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.addListener('backButton', (event) => {
      const { pathname } = locationRef.current;

      if (!nativeHomePaths.has(pathname) && (event.canGoBack || hasBrowserHistoryBackEntry())) {
        navigate(-1);
        return;
      }

      const fallbackRoute = getNativeBackFallback(pathname);
      if (fallbackRoute) {
        navigate(fallbackRoute, { replace: true });
        return;
      }

      void CapacitorApp.minimizeApp();
    }).then((handle) => {
      if (isMounted) backButtonHandle = handle;
      else void handle.remove();
    });

    return () => {
      isMounted = false;
      if (backButtonHandle) void backButtonHandle.remove();
    };
  }, [navigate]);

  useEffect(() => {
    if (!platformServices.platform.isNative || !Capacitor.isPluginAvailable('Keyboard')) return;

    let isMounted = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const root = document.documentElement;

    if (platformServices.platform.isIos) {
      void Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => undefined);
    }

    void Keyboard.addListener('keyboardWillShow', () => {
      root.classList.add('keyboard-open');
    }).then((handle) => {
      if (isMounted) handles.push(handle);
      else void handle.remove();
    });

    void Keyboard.addListener('keyboardWillHide', () => {
      root.classList.remove('keyboard-open');
    }).then((handle) => {
      if (isMounted) handles.push(handle);
      else void handle.remove();
    });

    return () => {
      isMounted = false;
      root.classList.remove('keyboard-open');
      handles.forEach((handle) => void handle.remove());
    };
  }, []);
}
