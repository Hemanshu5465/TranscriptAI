import "@testing-library/jest-dom/vitest";

// jsdom lacks IntersectionObserver (motion's whileInView touches it)
if (typeof window.IntersectionObserver === "undefined") {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
  }
  const ctor = IO as unknown as typeof window.IntersectionObserver;
  window.IntersectionObserver = ctor;
  globalThis.IntersectionObserver = ctor;
}

// jsdom lacks matchMedia
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
