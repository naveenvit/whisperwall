let currentLat = null;
let currentLng = null;

const statusEl = document.getElementById('status');
const whispersEl = document.getElementById('whispers');
const messageEl = document.getElementById('message');
const postBtn = document.getElementById('post-btn');
const locBtn = document.getElementById('loc-btn');
const refreshBtn = document.getElementById('refresh-btn');
const radiusEl = document.getElementById('radius');

async function init() {
  attachEvents();
  // attempt to get location silently
  tryUseGeolocation();
  // refresh periodically
  setInterval(() => {
    if (currentLat && currentLng) fetchWhispers();
  }, 30000); // every 30s
}

function attachEvents() {
  locBtn.addEventListener('click', tryUseGeolocation);
  postBtn.addEventListener('click', postWhisper);
  refreshBtn.addEventListener('click', () => {
    if (currentLat && currentLng) fetchWhispers();
  });
}

function setStatus(s, isError = false) {
  statusEl.textContent = s;
  statusEl.style.color = isError ? 'crimson' : '';
}

function tryUseGeolocation() {
  setStatus('Getting location…');
  if (!navigator.geolocation) {
    setStatus('Geolocation not available in this browser', true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      setStatus('Location acquired');
      fetchWhispers();
    },
    err => {
      setStatus('Location denied or unavailable — please enable location or refresh to try again', true);
      console.warn(err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function fetchWhispers() {
  setStatus('Loading whispers…');
  const radius = radiusEl.value || 5000;
  try {
    const res = await fetch(`/api/whispers?lat=${currentLat}&lng=${currentLng}&radius=${radius}`);
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    renderWhispers(data);
    setStatus(`Showing ${data.length} whispers within ${radius/1000} km`);
  } catch (err) {
    console.error(err);
    setStatus('Failed to load whispers', true);
  }
}

function renderWhispers(list) {
  whispersEl.innerHTML = '';
  if (!list.length) {
    whispersEl.innerHTML = '<li class="muted">No whispers found nearby.</li>';
    return;
  }
  for (const w of list) {
    const li = document.createElement('li');
    li.className = 'whisper';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = timeAgo(w.createdAt);
    const msg = document.createElement('div');
    // use textContent to avoid XSS (do not use .innerHTML)
    msg.textContent = w.message;
    li.appendChild(meta);
    li.appendChild(msg);
    whispersEl.appendChild(li);
  }
}

function timeAgo(dateStr) {
  const sec = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

async function postWhisper() {
  const message = messageEl.value.trim();
  if (!message) return setStatus('Please write a message before posting.', true);
  if (message.length > 280) return setStatus('Message too long (max 280 chars).', true);
  if (!currentLat || !currentLng) return setStatus('No location available. Click "Use my location" first.', true);

  postBtn.disabled = true;
  setStatus('Posting…');
  try {
    const res = await fetch('/whispers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, lat: currentLat, lng: currentLng })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || 'Failed to post', true);
    } else {
      messageEl.value = '';
      setStatus('Posted! Refreshing list…');
      fetchWhispers();
    }
  } catch (err) {
    console.error(err);
    setStatus('Failed to post', true);
  } finally {
    postBtn.disabled = false;
  }
}

init();
