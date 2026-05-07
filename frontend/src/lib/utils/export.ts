import html2canvas from 'html2canvas';
import { writable } from 'svelte/store';
import { addToast } from '$lib/stores/swarm';
import { UI_STRINGS } from '$lib/constants/strings';

// ─── ANON LABELS ───────────────────────────────────────────────────────────────
const ANON_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const ANON_IMAGE = 'pixel-service:v1';

// ─── LOADING STATE ─────────────────────────────────────────────────────────────
export const isExporting = writable<boolean>(false);

// ─── HELPERS ───────────────────────────────────────────────────────────────────

/** Replace all text content of matched elements in `root` with cycling anon labels. */
function anonymizeElements(root: HTMLElement, selector: string, labels: string[]): void {
  const els = root.querySelectorAll<HTMLElement>(selector);
  els.forEach((el, i) => {
    el.textContent = labels[i % labels.length];
  });
}

/** Anonymize rack labels and list-row text nodes in the cloned DOM. */
function anonymizeClone(clone: HTMLElement): void {
  // Rack name labels (e.g. "MYPROJECT")
  anonymizeElements(clone, '.rack-name', ANON_NAMES.map(n => n.toUpperCase()));

  // Project names in the detail list
  anonymizeElements(clone, '.row-main', ANON_NAMES.map(n => n.toUpperCase()));

  // Image names in list rows (row-sub)
  const subs = clone.querySelectorAll<HTMLElement>('.row-sub');
  subs.forEach(el => {
    el.textContent = ANON_IMAGE;
  });
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────────

export async function exportScenePNG(): Promise<void> {
  const source = document.querySelector<HTMLElement>('.scene-canvas');
  if (!source) {
    addToast('Scene canvas not found', 'error');
    return;
  }

  isExporting.set(true);

  // Offscreen container
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
  document.body.appendChild(wrapper);

  let objectUrl = '';

  try {
    // 1. Clone scene into offscreen wrapper
    const clone = source.cloneNode(true) as HTMLElement;
    wrapper.appendChild(clone);

    // 2. Anonymize names in the clone only
    anonymizeClone(clone);

    // 3. Remove particle canvas overlay from clone (won't render anyway)
    const particleCanvas = clone.querySelector('canvas');
    if (particleCanvas) particleCanvas.remove();

    // 4. Capture with html2canvas
    const canvas = await html2canvas(clone, {
      backgroundColor: '#0a0e1a',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // 5. Convert to blob and trigger download
    await new Promise<void>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('toBlob returned null')); return; }
        objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = 'pixdock-server-room.png';
        a.click();
        resolve();
      }, 'image/png');
    });
  } catch {
    addToast(UI_STRINGS.EXPORT_ERROR, 'warning');
  } finally {
    // 6. Cleanup
    wrapper.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    isExporting.set(false);
  }
}
