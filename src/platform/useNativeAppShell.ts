import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { useLocation, useNavigate } from 'react-router-dom';
import { platformServices } from '.';

const nativeHomePaths = new Set(['/login', '/signup', '/parent', '/child']);

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

export function useNativeAppShell() {
  const navigate = useNavigate();
  const location = useLocation();

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

    return () => {
      isMounted = false;
      handles.forEach((handle) => void handle.remove());
    };
  }, [navigate]);

  useEffect(() => {
    if (!platformServices.platform.isAndroid || !Capacitor.isPluginAvailable('App')) return;

    let isMounted = true;
    let backButtonHandle: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.addListener('backButton', (event) => {
      if (event.canGoBack && !nativeHomePaths.has(location.pathname)) {
        navigate(-1);
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
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!platformServices.platform.isNative || !Capacitor.isPluginAvailable('Keyboard')) return;

    let isMounted = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const root = document.documentElement;

    if (platformServices.platform.isIos) {
      void Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => undefined);
    }

    void Keyboard.addListener('keyboardWillShow', (info) => {
      root.classList.add('keyboard-open');
      root.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    }).then((handle) => {
      if (isMounted) handles.push(handle);
      else void handle.remove();
    });

    void Keyboard.addListener('keyboardWillHide', () => {
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--keyboard-height');
    }).then((handle) => {
      if (isMounted) handles.push(handle);
      else void handle.remove();
    });

    return () => {
      isMounted = false;
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--keyboard-height');
      handles.forEach((handle) => void handle.remove());
    };
  }, []);
}
