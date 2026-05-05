/* eslint-disable */
// Shared PixDock primitives — used across all 5 variations.

const { useState, useEffect, useRef, useMemo } = React;

// ─── LED dot ───
function Led({ tone = 'green', size = 'md', blink = false, style }) {
  const cls = ['pd-led'];
  if (size === 'sm') cls.push('sm');
  if (size === 'lg') cls.push('lg');
  cls.push(`pd-led-${tone}`);
  if (blink) cls.push('pd-blink');
  return <span className={cls.join(' ')} style={style} />;
}

// ─── HP-bar gauge ───
function Gauge({ value, max = 1, tone, width = 60, height = 10, segmented = false, segs = 12 }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const t = tone || (pct < 0.6 ? 'ok' : pct < 0.85 ? 'warn' : 'crit');
  const fillTone = t === 'ok' ? '' : t === 'warn' ? 'warn' : 'crit';
  if (segmented) {
    const lit = Math.round(pct * segs);
    return (
      <span className="pd-segs" style={{ width, height }}>
        {Array.from({ length: segs }).map((_, i) => (
          <span key={i} className={i < lit ? 'on' : ''} />
        ))}
      </span>
    );
  }
  return (
    <span className="pd-gauge" style={{ width, height }}>
      <span className={`pd-gauge-fill ${fillTone}`} style={{ width: `${pct * 100}%` }} />
    </span>
  );
}

// ─── Sparkline (steps, no smoothing) ───
function Sparkline({ data, width = 80, height = 20, color = 'var(--green)', fill = false }) {
  const max = Math.max(...data, 0.01);
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * stepX).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`);
  const path = 'M ' + pts.join(' L ');
  const area = `${path} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block', shapeRendering: 'crispEdges' }}>
      {fill && <path d={area} fill={color} fillOpacity="0.18" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Bar chart (chunky) ───
function Bars({ data, width = 80, height = 24, color = 'var(--green)', gap = 1 }) {
  const max = Math.max(...data, 0.01);
  const w = (width - gap * (data.length - 1)) / data.length;
  return (
    <svg width={width} height={height} style={{ display: 'block', shapeRendering: 'crispEdges' }}>
      {data.map((v, i) => {
        const h = Math.max(1, (v / max) * height);
        return <rect key={i} x={i * (w + gap)} y={height - h} width={w} height={h} fill={color} />;
      })}
    </svg>
  );
}

// ─── Pixel star (decoration) ───
function Star({ size = 8, color = 'var(--yellow)' }) {
  const px = size / 5;
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" style={{ shapeRendering: 'crispEdges' }}>
      <rect x="2" y="0" width="1" height="5" fill={color} />
      <rect x="0" y="2" width="5" height="1" fill={color} />
      <rect x="1" y="1" width="3" height="3" fill={color} />
    </svg>
  );
}

// ─── ASCII corner box (renders any rect) ───
function AsciiBox({ children, color = 'var(--text-dim)', style }) {
  return (
    <div style={{
      border: `1px solid ${color}`,
      padding: '6px 8px',
      position: 'relative',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Pulse-ticker (for live data feel) ───
function useTicker(intervalMs = 1500) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(x => x + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

// ─── Live clock ───
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmtClock(d) {
  return d.toTimeString().slice(0, 8);
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// ─── Common: container action button ───
function ActionBtn({ icon, tone = 'blue', onClick, disabled, title, size = 18 }) {
  const [hover, setHover] = useState(false);
  const toneColor = `var(--${tone})`;
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size,
        background: hover ? toneColor : 'var(--bg-panel)',
        border: `2px solid ${hover ? toneColor : 'var(--border)'}`,
        color: hover ? 'var(--bg-dark)' : 'var(--text-dim)',
        fontSize: size * 0.55,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: hover ? `0 0 6px ${toneColor}` : 'none',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        lineHeight: 1,
      }}
    >{icon}</button>
  );
}

// ─── Container row helpers ───
function stateLed(state) {
  if (state === 'running') return 'green';
  if (state === 'exited' || state === 'dead') return 'red';
  return 'yellow';
}

// ─── Pixel scroll-shadow inset wrapper ───
function PixelScroll({ children, maxHeight, style }) {
  return (
    <div style={{
      maxHeight,
      overflow: 'auto',
      ...style,
    }}>{children}</div>
  );
}

// ─── Marquee (auto-scrolling text band) ───
function Marquee({ children, speed = 22, style }) {
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', ...style }}>
      <div style={{
        display: 'inline-block',
        animation: `pd-marq ${speed}s linear infinite`,
        paddingLeft: '100%',
      }}>{children}</div>
    </div>
  );
}

// Inject keyframes once
(function injectKf() {
  if (document.getElementById('pd-kf')) return;
  const s = document.createElement('style');
  s.id = 'pd-kf';
  s.textContent = `
    @keyframes pd-marq { from { transform: translateX(0); } to { transform: translateX(-100%); } }
    @keyframes pd-shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
    @keyframes pd-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, {
  Led, Gauge, Sparkline, Bars, Star, AsciiBox,
  ActionBtn, PixelScroll, Marquee,
  useTicker, useClock, fmtClock, fmtDate, stateLed,
});
