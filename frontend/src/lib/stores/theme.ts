import { writable } from 'svelte/store';

export type DashboardTheme = 'faithful' | 'command' | 'arcade' | 'mainframe' | 'gameboy';

export const currentTheme = writable<DashboardTheme>('faithful');
export const crtEnabled = writable<boolean>(true);
export const crtIntensity = writable<number>(0.6);

// Restore from localStorage if in browser
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('pd_theme') as DashboardTheme;
  if (['faithful', 'command', 'arcade', 'mainframe', 'gameboy'].includes(savedTheme)) {
    currentTheme.set(savedTheme);
  }
  const savedCrt = localStorage.getItem('pd_crt');
  if (savedCrt !== null) {
    crtEnabled.set(savedCrt === 'true');
  }
  const savedIntensity = localStorage.getItem('pd_crt_intensity');
  if (savedIntensity !== null) {
    crtIntensity.set(parseFloat(savedIntensity));
  }

  currentTheme.subscribe(v => localStorage.setItem('pd_theme', v));
  crtEnabled.subscribe(v => localStorage.setItem('pd_crt', String(v)));
  crtIntensity.subscribe(v => {
    localStorage.setItem('pd_crt_intensity', String(v));
    document.documentElement.style.setProperty('--crt', String(v));
  });
}
