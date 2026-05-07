import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// ─── Module Mocks (hoisted by vitest before all imports) ──────────────────────

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

vi.mock('$lib/stores/swarm', () => ({
  addToast: vi.fn(),
}));

import html2canvas from 'html2canvas';
import { addToast } from '$lib/stores/swarm';
import { exportScenePNG, isExporting } from './export';

// ─── Browser API mocks ────────────────────────────────────────────────────────

const mockCreateObjectURL = vi.fn(() => 'blob:fake-url');
const mockRevokeObjectURL = vi.fn();
globalThis.URL.createObjectURL = mockCreateObjectURL;
globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a fake captured canvas with a working toBlob stub. */
function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.toBlob = (cb: BlobCallback) => cb(new Blob(['fake-png'], { type: 'image/png' }));
  return c;
}

/** Appends a .scene-canvas div to document.body and returns it. */
function appendSceneCanvas(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'scene-canvas';
  document.body.appendChild(el);
  return el;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportScenePNG', () => {
  beforeEach(() => {
    isExporting.set(false);
    mockCreateObjectURL.mockReset().mockReturnValue('blob:fake-url');
    mockRevokeObjectURL.mockReset();
    vi.mocked(html2canvas).mockReset().mockImplementation(() => Promise.resolve(makeCanvas()));
    vi.mocked(addToast).mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // 1 ──────────────────────────────────────────────────────────────────────────
  it('creates an offscreen clone and invokes html2canvas when .scene-canvas is present', async () => {
    appendSceneCanvas();

    await exportScenePNG();

    expect(html2canvas).toHaveBeenCalledOnce();
  });

  // 2 ──────────────────────────────────────────────────────────────────────────
  it('anonymizes .rack-name labels in the clone so original project names do not appear', async () => {
    const scene = appendSceneCanvas();
    const label = document.createElement('span');
    label.className = 'rack-name';
    label.textContent = 'my-secret-project';
    scene.appendChild(label);

    await exportScenePNG();

    const captured = vi.mocked(html2canvas).mock.calls[0][0] as HTMLElement;
    const cloneLabel = captured.querySelector('.rack-name');
    expect(cloneLabel?.textContent).not.toBe('my-secret-project');
    expect(cloneLabel?.textContent).toBe('ALPHA');
  });

  // 3 ──────────────────────────────────────────────────────────────────────────
  it('removes the canvas particle overlay from the clone before capture', async () => {
    const scene = appendSceneCanvas();
    scene.appendChild(document.createElement('canvas'));

    await exportScenePNG();

    const captured = vi.mocked(html2canvas).mock.calls[0][0] as HTMLElement;
    expect(captured.querySelector('canvas')).toBeNull();
  });

  // 4 ──────────────────────────────────────────────────────────────────────────
  it('passes a clone to html2canvas, not the original .scene-canvas element', async () => {
    const original = appendSceneCanvas();

    await exportScenePNG();

    const captured = vi.mocked(html2canvas).mock.calls[0][0] as HTMLElement;
    expect(captured).not.toBe(original);
    expect(captured.className).toBe('scene-canvas');
  });

  // 5 ──────────────────────────────────────────────────────────────────────────
  it('triggers a download link with filename pixdock-server-room.png', async () => {
    appendSceneCanvas();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });

    await exportScenePNG();

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('pixdock-server-room.png');
  });

  // 6 ──────────────────────────────────────────────────────────────────────────
  it('removes the offscreen wrapper from DOM after capture so no clone lingers', async () => {
    const scene = appendSceneCanvas();

    await exportScenePNG();

    // Wrapper + clone were removed in finally; only the original scene remains
    expect(document.body.children).toHaveLength(1);
    expect(document.body.firstElementChild).toBe(scene);
  });

  // 7 ──────────────────────────────────────────────────────────────────────────
  it('calls URL.revokeObjectURL to release the blob after download', async () => {
    appendSceneCanvas();

    await exportScenePNG();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  // 8 ──────────────────────────────────────────────────────────────────────────
  it('sets isExporting to true during html2canvas capture and false once done', async () => {
    appendSceneCanvas();
    let duringCapture = false;

    vi.mocked(html2canvas).mockImplementationOnce(() => {
      duringCapture = get(isExporting);
      return Promise.resolve(makeCanvas());
    });

    await exportScenePNG();

    expect(duringCapture).toBe(true);
    expect(get(isExporting)).toBe(false);
  });

  // 9 ──────────────────────────────────────────────────────────────────────────
  it('shows a warning toast when html2canvas throws an error', async () => {
    appendSceneCanvas();
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('render error'));

    await exportScenePNG();

    expect(addToast).toHaveBeenCalledWith(
      'Export may not capture all visual effects',
      'warning',
    );
  });

  // 10 ─────────────────────────────────────────────────────────────────────────
  it('does not crash and shows an error toast when .scene-canvas is absent from DOM', async () => {
    // No .scene-canvas appended

    await expect(exportScenePNG()).resolves.toBeUndefined();

    expect(html2canvas).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('Scene canvas not found', 'error');
  });
});
