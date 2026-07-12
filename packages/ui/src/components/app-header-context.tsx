"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const DEFAULT_SCROLL_CONTAINER_SELECTOR = "[data-app-scroll-container]";

// Height of the header (h-16 = 64px). Showing/hiding the header resizes the
// scroll container by this amount, so we treat it as a dead zone near the
// bottom and as the transition guard window basis.
const HEADER_HEIGHT = 64;
// Matches the header's `transition-transform duration-300` (plus a small
// buffer). While the layout is animating, the scroll container is being
// resized, which nudges scrollTop; we must ignore that self-induced movement.
const TRANSITION_GUARD_MS = 350;

function useAutoHideOnScroll(enabled: boolean, selector: string): boolean {
  const [scrollHidden, setScrollHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setScrollHidden(false);
      return;
    }

    let scrollContainer: HTMLElement | null = null;
    let lastScrollTop = 0;
    let rafId = 0;
    // Mirror of the hidden state usable inside the listener without stale
    // closures, plus a timestamp guarding the show/hide transition.
    let hidden = false;
    let guardUntil = 0;

    const setHidden = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      // Ignore scroll events caused by the container resize that this state
      // change triggers, preventing a hide/show feedback loop at page edges.
      guardUntil = performance.now() + TRANSITION_GUARD_MS;
      setScrollHidden(next);
    };

    const onScroll = () => {
      if (!scrollContainer) return;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = scrollContainer!;
        const scrollTop = el.scrollTop;

        // During the header transition the container is resizing, which moves
        // scrollTop on its own. Track position but don't act on it.
        if (performance.now() < guardUntil) {
          lastScrollTop = scrollTop;
          return;
        }

        const delta = scrollTop - lastScrollTop;
        const distanceToBottom = el.scrollHeight - el.clientHeight - scrollTop;

        if (scrollTop <= 8) {
          setHidden(false);
        } else if (delta > 4 && distanceToBottom > HEADER_HEIGHT) {
          // Only hide when there is room to keep scrolling past the header.
          // Hiding within a header's height of the bottom would clamp
          // scrollTop and bounce the header open/closed.
          setHidden(true);
        } else if (delta < -4) {
          setHidden(false);
        }

        lastScrollTop = scrollTop;
      });
    };

    const attach = () => {
      scrollContainer = document.querySelector(selector);
      if (!scrollContainer) return false;

      lastScrollTop = scrollContainer.scrollTop;
      scrollContainer.addEventListener("scroll", onScroll, { passive: true });
      return true;
    };

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    if (!attach()) {
      retryTimer = setTimeout(() => {
        attach();
      }, 0);
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      cancelAnimationFrame(rafId);
      scrollContainer?.removeEventListener("scroll", onScroll);
    };
  }, [enabled, selector]);

  return scrollHidden;
}

type AppHeaderVisibilityContextValue = {
  visible: boolean;
};

const AppHeaderVisibilityContext =
  createContext<AppHeaderVisibilityContextValue | null>(null);

export type AppHeaderVisibilityProviderProps = {
  children: ReactNode;
  autoHideOnScroll?: boolean;
  scrollContainerSelector?: string;
};

export function AppHeaderVisibilityProvider({
  children,
  autoHideOnScroll = false,
  scrollContainerSelector = DEFAULT_SCROLL_CONTAINER_SELECTOR,
}: AppHeaderVisibilityProviderProps) {
  const scrollHidden = useAutoHideOnScroll(
    autoHideOnScroll,
    scrollContainerSelector,
  );

  return (
    <AppHeaderVisibilityContext.Provider value={{ visible: !scrollHidden }}>
      {children}
    </AppHeaderVisibilityContext.Provider>
  );
}

export function useAppHeaderVisible(): boolean {
  const context = useContext(AppHeaderVisibilityContext);
  return context?.visible ?? true;
}
