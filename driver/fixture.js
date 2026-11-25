'use strict';
(() => {
  const slot = new URLSearchParams(location.search).get('slot');
  if (slot === 'A' || slot === 'B') localStorage.setItem('kasm_probe', slot);
  document.getElementById('storage').textContent = `Local storage: ${localStorage.getItem('kasm_probe') || 'unset'}`;
  let inputEvents = 0;
  document.addEventListener('input', () => {
    document.getElementById('events').textContent = `Input events: ${++inputEvents}`;
  });
  document.getElementById('send').addEventListener('click', () => {
    const textarea = document.getElementById('composer').value;
    const richText = document.getElementById('rich-composer').innerText;
    document.getElementById('sent').textContent = `Sent placeholder: ${textarea || richText || ''}`;
  });
})();
