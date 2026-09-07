import { brightenFeedback, configureBrightpixels } from '../index.js';
import { glowCards } from './card-glow.js?v=20260907-story1';
import './tron-trail.js?v=20260907-story1';
import './overload.js?v=20260907-story1';
import './narrative.js?v=20260907-story1';
import { fireConfetti } from './confetti-cannon.js?v=20260907-story1';
const $ = (id) => document.getElementById(id), root = document.documentElement;
brightenFeedback(document.querySelectorAll('button'));
glowCards('.dn-window');
let salvos = 0;
$('confetti-fire').addEventListener('click', event => {
  fireConfetti(event.currentTarget);
  $('confetti-status').textContent = `NEON SALVO ${String(++salvos).padStart(2, '0')} · ready to fire again`;
});
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const previous = read('dreamnet-visits', 0);
const visits = Math.min(999999, (Number.isSafeInteger(previous) && previous >= 0 ? previous : 0) + 1);
$('visits').textContent = String(visits).padStart(6, '0'); save('dreamnet-visits', visits);
for (const button of document.querySelectorAll('[data-sky-choice]')) button.addEventListener('click', () => {
  root.dataset.sky = button.dataset.skyChoice;
  for (const choice of document.querySelectorAll('[data-sky-choice]')) choice.setAttribute('aria-pressed', String(choice === button));
});
$('hdr').addEventListener('change', () => configureBrightpixels({ enabled: $('hdr').checked }));
$('motion').addEventListener('change', () => root.toggleAttribute('data-still', !$('motion').checked));
for (const button of document.querySelectorAll('.dn-collapse')) button.addEventListener('click', () => {
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(expanded));
  button.firstChild.textContent = expanded ? '−' : '+';
  button.closest('.dn-window').querySelector('.dn-window-body').hidden = !expanded;
  button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} welcome window`);
});
$('drive').addEventListener('click', () => {
  const driving = $('drive').getAttribute('aria-pressed') !== 'true';
  $('drive').setAttribute('aria-pressed', String(driving)); $('scene').dataset.driving = String(driving);
  $('drive-status').textContent = driving ? 'Cruising. No destination required.' : 'Parked at the edge of a dream.';
  document.querySelector('.dn-moon').pulse({ intensity: 16, duration: 1500 });
});
let stars = 0;
$('adopt').addEventListener('click', () => {
  if (stars >= 20) { $('adopt-status').textContent = 'Your sky is full. Start fresh for more stars.'; return; }
  const star = document.createElement('span'); star.className = 'dn-adopted-star'; star.textContent = '✧';
  star.style.left = `${8 + (stars * 37 % 80)}%`; star.style.top = `${10 + (stars * 19 % 65)}%`;
  $('adopted-stars').append(star); stars++;
  $('adopt-status').textContent = `${stars} ${stars === 1 ? 'star' : 'stars'} in your sky.`;
});
$('clear-stars').addEventListener('click', () => { stars = 0; $('adopted-stars').replaceChildren(); $('adopt-status').textContent = '0 stars in your sky.'; });
let entries = read('dreamnet-guestbook', []);
entries = Array.isArray(entries) ? entries.filter((item) => item && typeof item.name === 'string' && typeof item.note === 'string').slice(-8).map(({ name, note }) => ({ name: name.slice(0,24), note: note.slice(0,160) })) : [];
function render() {
  $('guest-entries').replaceChildren(...entries.map(({name, note}) => {
    const entry = document.createElement('div'); entry.className = 'dn-entry';
    const title = document.createElement('strong'); title.textContent = `✧ ${name}`;
    const message = document.createElement('p'); message.textContent = note;
    entry.append(title, message); return entry;
  }));
}
$('guest-form').addEventListener('submit', (event) => {
  event.preventDefault(); const name = $('guest-name').value.trim(), note = $('guest-note').value.trim();
  if (!name || !note) { $('guest-status').textContent = 'Give your transmission a name and a note.'; return; }
  entries = [...entries, { name, note }].slice(-8); render();
  $('guest-status').textContent = save('dreamnet-guestbook', entries) ? 'Saved in this browser. Future you says hello.' : 'Added for this visit. Browser storage is unavailable.';
  $('guest-note').value = '';
});
$('clear-guest').addEventListener('click', () => { entries = []; render(); const stored = save('dreamnet-guestbook', entries); $('guest-status').textContent = stored ? 'Your local guestbook is clear.' : 'Cleared for this visit. Browser storage is unavailable.'; });
render();
document.addEventListener('visibilitychange', () => { if (document.hidden) root.setAttribute('data-still', ''); else root.toggleAttribute('data-still', !$('motion').checked); });
