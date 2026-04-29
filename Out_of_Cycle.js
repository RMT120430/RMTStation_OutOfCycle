// ==UserScript==
// @name         OutOfCycle
// @namespace    https://github.com/RMT120430/RMTStation_OutOfCycle
// @version      3.5.0
// @description  Fix and optimize YouTube playlist shuffle behavior
// @author       RMT120430
// @license      MIT
// @homepageURL  https://github.com/RMT120430/RMTStation_OutOfCycle
// @icon         https://github.com/RMT120430/RMTStation_OutOfCycle/blob/main/icon128.png?raw=true
// @match        https://*.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'OutOfCycle_v3.5.0';
  const NEAR_END_THRESHOLD = 1.5;
  const DEBUG = false;
  const SCROLL_INTERVAL_MS = 1000;
  const MAX_QUEUE = 10000;
  const SCROLL_STABLE_REQUIRED = 4;

  let state = {
    active: false,
    playlistId: null,
    queue: [],
    currentIndex: 0,
  };

  let lastUrl = location.href;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getParam(key) {
    return new URLSearchParams(location.search).get(key);
  }

  function isPlaylistPage() {
    return !!getParam('list') && !!getParam('v');
  }

  function isStandalonePlaylistPage() {
    return location.pathname === '/playlist' && !!getParam('list');
  }

  function log(...args) {
    if (DEBUG) console.log('[YTTRUESHUFFLE]  yttrueshuffle.user.js:45 - Out_of_Cycle.js:49', ...args);
  }

  function fisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const currentListId = getParam('list');
      if (
        saved &&
        typeof saved.active === 'boolean' &&
        typeof saved.currentIndex === 'number' &&
        Array.isArray(saved.queue) &&
        saved.queue.every(v => typeof v === 'string') &&
        typeof saved.playlistId === 'string' &&
        saved.playlistId === currentListId
      ) {
        state = saved;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function getExpectedVideoCount() {
    const elements = document.querySelectorAll('.ytContentMetadataViewModelMetadataText');
    for (const el of elements) {
      const match = (el.textContent || '').match(/([\d,]+)\s*(?:部影片|videos?)/i);
      if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return null;
  }

  // ─── /playlist page: bounce scroll to load all items ────────────────────────
  async function scrollToLoadAllFromPlaylistPage() {
    setStatus('Preparing to load playlist...');
    log('Bounce-scrolling to load all playlist items');

  let stableCount = 0;
    const start = Date.now();
    const MAX_WAIT_TIME = 120000;
    const expectedCount = getExpectedVideoCount();

    while (stableCount < SCROLL_STABLE_REQUIRED && Date.now() - start < MAX_WAIT_TIME) {
      const countBeforeBounce = document.querySelectorAll('ytd-playlist-video-list-renderer ytd-playlist-video-renderer').length;
      for (let i = 0; i < 5; i++) {
       const items = document.querySelectorAll('ytd-playlist-video-list-renderer ytd-playlist-video-renderer');
        if (items.length > 0) {
          items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
        await sleep(500);
        window.scrollBy({ top: -500, behavior: 'smooth' });
        await sleep(600);
      }

    // Final scroll to bottom after bounce cycles
      const latest = document.querySelectorAll('ytd-playlist-video-list-renderer ytd-playlist-video-renderer');
      if (latest.length > 0) {
        latest[latest.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      await sleep(SCROLL_INTERVAL_MS);

      const items = document.querySelectorAll('ytd-playlist-video-list-renderer ytd-playlist-video-renderer');
      const currentCount = items.length;

      if (expectedCount && currentCount >= expectedCount) {
        log(`Reached expected video count: ${currentCount} / ${expectedCount}`);
        break; 
      }

      if (currentCount > 0) {
        const lastItem = items[currentCount - 1];
        const indexEl = lastItem.querySelector('yt-formatted-string#index');
        const indexText = indexEl ? indexEl.textContent.trim() : '';

        if (/^\d+$/.test(indexText)) {
          const continuation = lastItem.parentElement.querySelector('ytd-continuation-item-renderer');
          if (!continuation || continuation.hasAttribute('hidden')) {
            log(`Structurally reached end of playlist. Last item index: ${indexText}`);
            break;
          }
        }
      }

      if (currentCount > 0 && currentCount === countBeforeBounce) {
        stableCount++;
      } else {
        stableCount = 0;
        setStatus(`Scrolling... ${currentCount}${expectedCount ? ` / ${expectedCount}` : ''} videos`);
      }
    }

  window.scrollTo(0, 0);
    const finalCount = document.querySelectorAll('ytd-playlist-video-list-renderer ytd-playlist-video-renderer').length;
    log('Playlist page fully loaded. Total items:', finalCount);
  }

  // ─── /playlist page: collect videoIds ────────────────────────────────────────
  function collectVideoIdsFromPlaylistPage() {
    const seen = new Set();
    const ids =[];
    document.querySelectorAll(
      'ytd-playlist-video-list-renderer ytd-playlist-video-renderer a#video-title[href*="watch?v="]'
    ).forEach(a => {
      try {
        const url = new URL(a.href, location.origin);
        const v = url.searchParams.get('v');
        if (v && !seen.has(v)) { seen.add(v); ids.push(v); }
      } catch (e) {}
    });
    if (ids.length > MAX_QUEUE) ids.length = MAX_QUEUE;
    log(`Found ${ids.length} video IDs from playlist page`);
    return ids;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────
  function clickPlaylistItem(videoId) {
    const anchors = document.querySelectorAll(
      'ytd-playlist-panel-video-renderer a[href*="watch?v="]'
    );
    for (const a of anchors) {
      try {
        const url = new URL(a.href, location.origin);
        if (url.searchParams.get('v') === videoId) {
          log('Clicking playlist item for:', videoId);
          a.click();
          return true;
        }
      } catch (e) {}
    }
    log('Playlist item not visible, navigating directly');
    const params = new URLSearchParams(location.search);
    params.set('v', videoId);
    location.assign('/watch?' + params.toString());
    return false;
  }

  // ─── Core ─────────────────────────────────────────────────────────────────────
  function playNext() {
    if (!state.active || state.queue.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.queue.length;
    if (state.currentIndex === 0) {
      log('Full cycle complete — reshuffling');
      state.queue = fisherYates(state.queue);
    }
    saveState();
    updateUI();
    clickPlaylistItem(state.queue[state.currentIndex]);
  }

    function playPrevious() {
    if (!state.active || state.queue.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
    saveState();
    updateUI();
    clickPlaylistItem(state.queue[state.currentIndex]);
  }

  function attachVideoListeners() {
    const video = document.querySelector('video');
    if (!video || video._tsAttached) return;
    video._tsAttached = true;

    video.addEventListener('timeupdate', () => {
      if (!state.active) return;
      const remaining = video.duration - video.currentTime;
      if (remaining > 0 && remaining <= NEAR_END_THRESHOLD && !video._tsTriggered) {
        video._tsTriggered = true;
        log('Near end — triggering next');
        playNext();
      }
    });

    video.addEventListener('ended', () => {
      if (!state.active || video._tsTriggered) return;
      video._tsTriggered = false;
      playNext();
    });

    video.addEventListener('loadstart', () => {
      video._tsTriggered = false;
    });

    log('Video listeners attached');
  }

  async function startShuffle() {
    if (state.active) return;

    if (!isStandalonePlaylistPage()) {
      const listId = getParam('list');
      if (listId) location.assign(`/playlist?list=${listId}`);
      return;
    }

    state.active = true;
    setStatus('Loading playlist...');

    await scrollToLoadAllFromPlaylistPage();
    const ids = collectVideoIdsFromPlaylistPage();

    if (ids.length === 0) {
      setStatus('❌ No videos found. Please expand the playlist.');
      state.active = false;
      return;
    }

    state.queue = fisherYates(ids);
    state.playlistId = getParam('list');
    saveState();
    location.assign(`/watch?v=${state.queue[0]}&list=${state.playlistId}`);
  }

  // ─── UI ───────────────────────────────────────────────────────────────────────
  let ui = null;

  function createUI() {
    if (document.getElementById('yts-panel')) return;

    if (!document.getElementById('yts-style')) {
      const style = document.createElement('style');
      style.id = 'yts-style';
      style.textContent = `
#yts-panel {
  position: fixed; bottom: 88px; right: 24px; z-index: 99999;
  background: #EEEFE0; border: 1.5px solid #92A7CE; border-radius: 0px;
  padding: 20px 22px; min-width: 320px;
  font-family: 'Courier New', 'Segoe UI', monospace;
  font-size: 16px; color: #73708E;
  box-shadow: 0 8px 24px rgba(115,112,142,.18);
}
#yts-panel.collapsed { min-width: auto; padding: 14px; }
#yts-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 18px; font-weight: bold; color: #7780A6; cursor: pointer;
}
#yts-status { margin-top: 10px; margin-bottom: 14px; font-size: 14px; color: #677D6A; }
#yts-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding-top: 0px; padding-bottom: 14px; }
#yts-panel button {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 0px; border: 1px solid #B6C1D7;
  background: #DEE1D8; color: #73708E; font-size: 15px; cursor: pointer;
}
#yts-panel button:hover { background: #D1D8BE; border-color: #7780A6; color: #437057; }
.yts-hidden { display: none !important; }
.yts-icon { width: 18px; height: 18px; fill: currentColor; }
      `;
      document.head.appendChild(style);
    }

    ui = document.createElement('div');
    ui.id = 'yts-panel';

    function createIcon(pathData) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'yts-icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      svg.appendChild(path);
      return svg;
    }

    const header = document.createElement('div');
    header.id = 'yts-header';
    const headerTitle = document.createElement('span');
    headerTitle.textContent = 'Out Of Cycle';
    header.appendChild(headerTitle);
    header.appendChild(createIcon('M7 10l5 5 5-5z'));

    const status = document.createElement('div');
    status.id = 'yts-status';
    status.textContent = 'Idle';

    const btnStart = document.createElement('button');
    btnStart.id = 'yts-start';
    btnStart.appendChild(createIcon('M8 5v14l11-7z'));
    btnStart.appendChild(document.createTextNode(' START'));

    const actions = document.createElement('div');
    actions.id = 'yts-actions';
    actions.style.display = 'none';

    const btnPrev = document.createElement('button');
    btnPrev.id = 'yts-prev';
    btnPrev.appendChild(createIcon('M6 6h2v12H6zm3.5 6l8.5 6V6z'));
    btnPrev.appendChild(document.createTextNode(' PREV'));

    const btnNext = document.createElement('button');
    btnNext.id = 'yts-next';
    btnNext.appendChild(createIcon('M6 5v14l8-7zM14 5v14h2V5z'));
    btnNext.appendChild(document.createTextNode(' NEXT'));

    const btnStop = document.createElement('button');
    btnStop.id = 'yts-stop';
    btnStop.appendChild(createIcon('M6 6h12v12H6z'));
    btnStop.appendChild(document.createTextNode(' STOP'));

    const btnReshuffle = document.createElement('button');
    btnReshuffle.id = 'yts-reshuffle';
    btnReshuffle.appendChild(createIcon('M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z'));
    btnReshuffle.appendChild(document.createTextNode(' RESHUFFLE'));

    let collapsed = false;
    header.onclick = () => {
      collapsed = !collapsed;
      ui.classList.toggle('collapsed', collapsed);
      status.classList.toggle('yts-hidden', collapsed);
      btnStart.classList.toggle('yts-hidden', collapsed);
      actions.classList.toggle('yts-hidden', collapsed);
    };

    actions.appendChild(btnPrev);
    actions.appendChild(btnNext);
    actions.appendChild(btnStop);
    actions.appendChild(btnReshuffle);

    ui.appendChild(header);
    ui.appendChild(status);
    ui.appendChild(btnStart);
    ui.appendChild(actions);
    document.body.appendChild(ui);

    btnStart.onclick = async () => {
      btnStart.style.display = 'none';
      await startShuffle();
      if (state.active) {
        actions.style.display = 'grid';
      } else {
        btnStart.style.display = 'block';
      }
    };

    btnPrev.onclick = playPrevious;
    btnNext.onclick = playNext;

    btnStop.onclick = () => {
      state.active = false;
      actions.style.display = 'none';
      btnStart.style.display = 'block';
      setStatus('Stopped');
    };

    btnReshuffle.onclick = () => {
      if (state.queue.length === 0) return;
      state.queue = fisherYates(state.queue);
      state.currentIndex = 0;
      saveState();
      setStatus(`Reshuffled — ${state.queue.length} tracks`);
      clickPlaylistItem(state.queue[0]);
    };
  }

  function setStatus(msg) {
    const el = document.getElementById('yts-status');
    if (el) el.textContent = msg;
  }

  function updateUI() {
    if (!ui || state.queue.length === 0) return;
    setStatus(`Track ${state.currentIndex + 1} / ${state.queue.length}`);
  }

  // ─── Page lifecycle ───────────────────────────────────────────────────────────
  function onNavigate() {
    if (!isPlaylistPage()) return;

    setTimeout(() => attachVideoListeners(), 1500);

    if (state.active && state.queue.length > 0) {
      const currentV = getParam('v');
      const idx = state.queue.indexOf(currentV);
      if (idx >= 0 && idx !== state.currentIndex) {
        state.currentIndex = idx;
        saveState();
      }
      updateUI();
    }
  }

  function init() {
    if (!isPlaylistPage() && !isStandalonePlaylistPage()) return;

    setTimeout(() => {
      createUI();
      attachVideoListeners();

      if (loadState()) {
        state.active = true;
        const startBtn = document.getElementById('yts-start');
        const actionsEl = document.getElementById('yts-actions');
        if (startBtn) startBtn.style.display = 'none';
        if (actionsEl) actionsEl.style.display = 'grid';
        updateUI();
        setStatus(`↩ Resumed: ${state.currentIndex + 1} / ${state.queue.length}`);
        log('Session restored');
      }
    }, 2000);
  }

  window.addEventListener('yt-navigate-finish', () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onNavigate();
    }
    if ((isPlaylistPage() || isStandalonePlaylistPage()) && !document.getElementById('yts-panel')) {
      init();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();