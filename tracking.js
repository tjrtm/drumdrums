// DrumDrums Usage Tracking (privacy-first, localStorage only)
// Tracks app opens for "Most Used" section

(function() {
  const TRACKING_KEY = 'drumdrums_usage_v1';
  
  function getSlugFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/drumdrums\/([^\/]+)\//);
    return match ? match[1] : null;
  }
  
  function trackOpen() {
    const slug = getSlugFromUrl();
    if (!slug || slug === 'featured' || slug === 'log' || slug === 'idea-board') return;
    
    try {
      const data = JSON.parse(localStorage.getItem(TRACKING_KEY) || '{}');
      data[slug] = (data[slug] || 0) + 1;
      localStorage.setItem(TRACKING_KEY, JSON.stringify(data));
    } catch (e) {
      // Silent fail if localStorage unavailable
    }
  }
  
  // Track on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackOpen);
  } else {
    trackOpen();
  }
  
  // Expose getter for main page
  window.getMockupUsage = function() {
    try {
      return JSON.parse(localStorage.getItem(TRACKING_KEY) || '{}');
    } catch (e) {
      return {};
    }
  };
})();
