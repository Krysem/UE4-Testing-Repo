'use strict';

const initSite = () => {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navigation = document.getElementById('primary-navigation');

  if (navToggle && navigation) {
    const closeNavigation = () => {
      navToggle.setAttribute('aria-expanded', 'false');
      navigation.dataset.open = 'false';
      document.body.classList.remove('nav-open');
    };

    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      navToggle.setAttribute('aria-expanded', String(nextState));
      navigation.dataset.open = String(nextState);
      document.body.classList.toggle('nav-open', nextState);
    });

    navigation.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLAnchorElement) {
        closeNavigation();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeNavigation();
      }
    });
  }

  const footerYear = document.getElementById('current-year');
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear().toString();
  }

  const sequenceSection = document.querySelector('[data-sequence-section]');
  const canvas = document.getElementById('product-sequence');
  if (!sequenceSection || !(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    return;
  }

  const frameCount = Number.parseInt(canvas.dataset.frameCount || '1', 10);
  const filePrefix = canvas.dataset.filePrefix || '';
  const fileExtension = canvas.dataset.fileExtension || '.jpg';
  const preloadRadius = Number.parseInt(canvas.dataset.preloadCount || '6', 10);
  const baseWidth = Number.parseInt(canvas.getAttribute('width') || '1920', 10);
  const baseHeight = Number.parseInt(canvas.getAttribute('height') || '1080', 10);

  let cssWidth = baseWidth;
  let cssHeight = baseHeight;
  let targetFrameIndex = 1;
  let currentFrameIndex = 0;
  let scheduledRender = 0;
  let sectionIsActive = false;

  const progressBar = sequenceSection.querySelector('[data-scroll-progress]');
  const instructionLabel = sequenceSection.querySelector('[data-scroll-instruction]');
  const statusLabel = sequenceSection.querySelector('[data-sequence-status]');

  const frameCache = new Map();
  const loadingPromises = new Map();
  const pendingWarmup = new Set();

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggleReducedMotionState = (state) => {
    document.body.classList.toggle('motion-reduced', state);
    if (statusLabel instanceof HTMLElement) {
      statusLabel.setAttribute('aria-hidden', state ? 'false' : 'true');
    }
  };

  toggleReducedMotionState(reducedMotionQuery.matches);

  reducedMotionQuery.addEventListener('change', (event) => {
    toggleReducedMotionState(event.matches);
    if (!event.matches) {
      updateTargetFromScroll(true);
    } else if (progressBar instanceof HTMLElement) {
      progressBar.style.transform = 'scaleX(0)';
    }
  });

  const getFramePath = (index) => {
    return `${filePrefix}${String(index).padStart(4, '0')}${fileExtension}`;
  };

  const loadFrame = (index) => {
    if (frameCache.has(index)) {
      return Promise.resolve(frameCache.get(index));
    }
    if (loadingPromises.has(index)) {
      return loadingPromises.get(index);
    }

    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = getFramePath(index);
      image.onload = () => {
        frameCache.set(index, image);
        loadingPromises.delete(index);
        resolve(image);
      };
      image.onerror = (error) => {
        loadingPromises.delete(index);
        console.error(`Failed to load frame ${index}`, error);
        reject(error);
      };
    });

    loadingPromises.set(index, promise);
    return promise;
  };

  const clearCanvas = () => {
    context.clearRect(0, 0, cssWidth, cssHeight);
  };

  const drawImage = (image) => {
    clearCanvas();

    const ratio =
      image.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : baseWidth / baseHeight;

    let renderWidth = cssWidth;
    let renderHeight = renderWidth / ratio;

    if (renderHeight > cssHeight) {
      renderHeight = cssHeight;
      renderWidth = renderHeight * ratio;
    }

    const offsetX = (cssWidth - renderWidth) / 2;
    const offsetY = (cssHeight - renderHeight) / 2;

    context.drawImage(image, offsetX, offsetY, renderWidth, renderHeight);
  };

  const resizeCanvas = () => {
    const container = canvas.parentElement;
    if (!container) {
      return;
    }

    const aspect = baseWidth / baseHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    let width = containerWidth;
    let height = width / aspect;

    if (height > containerHeight) {
      height = containerHeight;
      width = height * aspect;
    }

    cssWidth = Math.max(width, 1);
    cssHeight = Math.max(height, 1);

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingQuality = 'high';

    if (currentFrameIndex > 0) {
      const cached = frameCache.get(currentFrameIndex);
      if (cached) {
        drawImage(cached);
      }
    }
  };

  const scheduleWarmup = (index) => {
    if (frameCache.has(index) || loadingPromises.has(index) || pendingWarmup.has(index)) {
      return;
    }

    pendingWarmup.add(index);

    const load = () => {
      pendingWarmup.delete(index);
      loadFrame(index).catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(load, { timeout: 600 });
    } else {
      window.setTimeout(load, 120);
    }
  };

  const warmupNeighborhood = (index) => {
    if (frameCount <= 1) {
      return;
    }

    const start = Math.max(1, index - preloadRadius);
    const end = Math.min(frameCount, index + preloadRadius);

    for (let i = start; i <= end; i += 1) {
      if (i !== index) {
        scheduleWarmup(i);
      }
    }
  };

  const setProgress = (progress) => {
    if (progressBar instanceof HTMLElement) {
      const clamped = Math.min(Math.max(progress, 0), 1);
      progressBar.style.transform = `scaleX(${clamped})`;
    }
  };

  const requestRender = () => {
    if (scheduledRender) {
      return;
    }

    scheduledRender = window.requestAnimationFrame(() => {
      scheduledRender = 0;
      const index = targetFrameIndex;
      loadFrame(index)
        .then((image) => {
          if (index !== targetFrameIndex) {
            requestRender();
            return;
          }

          drawImage(image);
          currentFrameIndex = index;
          warmupNeighborhood(index);
        })
        .catch(() => {});
    });
  };

  const updateTargetFromScroll = (force = false) => {
    if (reducedMotionQuery.matches && !force) {
      return;
    }

    if (!sectionIsActive && !force) {
      return;
    }

    const rect = sequenceSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollableDistance = rect.height + viewportHeight;
    const rawProgress = (viewportHeight - rect.top) / scrollableDistance;
    const progress = Math.min(Math.max(rawProgress, 0), 1);

    setProgress(progress);

    const nextFrame = Math.min(
      frameCount,
      Math.max(1, Math.round(progress * (frameCount - 1) + 1)),
    );

    if (nextFrame !== targetFrameIndex || force) {
      targetFrameIndex = nextFrame;
      requestRender();
    }
  };

  const handleScroll = () => {
    updateTargetFromScroll();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target === sequenceSection) {
          sectionIsActive = entry.isIntersecting;
          if (sectionIsActive && !reducedMotionQuery.matches) {
            updateTargetFromScroll(true);
          }
        }
      });
    },
    { threshold: 0.25 },
  );

  observer.observe(sequenceSection);

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (!reducedMotionQuery.matches) {
      updateTargetFromScroll();
    }
  });

  loadFrame(1)
    .then((image) => {
      drawImage(image);
      currentFrameIndex = 1;
      warmupNeighborhood(1);
    })
    .catch(() => {
      if (instructionLabel instanceof HTMLElement) {
        instructionLabel.textContent = 'Preview currently unavailable';
      }
    });

  resizeCanvas();

  if (reducedMotionQuery.matches) {
    setProgress(0);
    loadFrame(1).catch(() => {});
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSite);
} else {
  initSite();
}
