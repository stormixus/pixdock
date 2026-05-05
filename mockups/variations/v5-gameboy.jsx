/* eslint-disable */
// V5 — Game Boy Mono: 4-tone palette, low density, oversized pixels.
// Charming and minimal. Single column, big sprites, a calmer info display.

function V5GameBoy() {
  const { NODES, SERVICES, CONTAINERS, FLEET_STATS, EVENTS, spark } = window.PD;
  const tick = useTicker(700);
  const clock = useClock();

  const C0 = '#0f380f';   // darkest
  const C1 = '#306230';   // dark
  const C2 = '#8bac0f';   // light
  const C3 = '#9bbc0f';   // lightest (bg)

  return (
    <div className="pd-frame pd-crt" style={{ background: C3, color: C0, '--crt': 0.35 }}>
      <div className="pd-crt-screen" style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-pixel)', fontSize: 9, padding: 14 }}>

        {/* TITLE CARD */}
        <div style={{
          border: `4px solid ${C0}`,
          padding: '12px 14px',
          background: C2,
          marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: `4px 4px 0 ${C1}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bigsprite color={C0} bg={C2} />
            <div>
              <div style={{ fontSize: 14, color: C0, letterSpacing: 2 }}>PIXDOCK</div>
              <div style={{ fontSize: 7, color: C1, letterSpacing: 1, marginTop: 3 }}>FLEET ADVENTURE</div>
            </div>
          </div>
          <div style={{ fontSize: 8, color: C0, textAlign: 'right' }}>
            <div>{fmtClock(clock)}</div>
            <div style={{ marginTop: 3, fontSize: 7, color: C1 }}>● ● ● ●</div>
          </div>
        </div>

        {/* PARTY STATUS */}
        <div style={{
          border: `4px solid ${C0}`,
          background: '#c1d680',
          padding: 12, marginBottom: 14,
          boxShadow: `4px 4px 0 ${C1}`,
        }}>
          <Hdr c0={C0} title="◆ STATUS" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <Stat c0={C0} c1={C1} label="HOSTS" v={FLEET_STATS.totalNodes} sub="ALL READY" />
            <Stat c0={C0} c1={C1} label="SERVICES" v={FLEET_STATS.totalServices} sub="ALL HEALTHY" />
            <Stat c0={C0} c1={C1} label="CONTAINERS" v={FLEET_STATS.runningContainers} sub="RUNNING" />
            <Stat c0={C0} c1={C1} label="IMAGES" v={FLEET_STATS.totalImages} sub="LOADED" />
          </div>
        </div>

        {/* NODES — party members */}
        <div style={{
          border: `4px solid ${C0}`,
          background: '#c1d680',
          padding: 12, marginBottom: 14,
          boxShadow: `4px 4px 0 ${C1}`,
        }}>
          <Hdr c0={C0} title="◆ PARTY" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {NODES.map((n, i) => (
              <div key={n.id} style={{ border: `3px solid ${C0}`, background: C3, padding: 8, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  <Mug c0={C0} c1={C1} c2={C2} blink={(tick + i) % 5 === 0} role={n.role} />
                </div>
                <div style={{ fontSize: 8, color: C0 }}>{n.hostname.toUpperCase()}</div>
                <div style={{ fontSize: 6, color: C1, marginTop: 2 }}>LV.{n.cpus}</div>
                <div style={{ marginTop: 6, fontSize: 6, color: C1, textAlign: 'left' }}>HP</div>
                <div style={{ height: 8, border: `2px solid ${C0}`, background: C3, position: 'relative' }}>
                  <div style={{ height: '100%', width: `${(1 - n.cpuLoad) * 100}%`, background: C0 }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 6, color: C1, textAlign: 'left' }}>MP</div>
                <div style={{ height: 8, border: `2px solid ${C0}`, background: C3, position: 'relative' }}>
                  <div style={{ height: '100%', width: `${(1 - n.memUsed / n.memGB) * 100}%`, background: C1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SERVICES — quest log */}
        <div style={{
          border: `4px solid ${C0}`,
          background: '#c1d680',
          padding: 12, marginBottom: 14,
          boxShadow: `4px 4px 0 ${C1}`,
        }}>
          <Hdr c0={C0} title="◆ QUESTS" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SERVICES.map(s => (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: '20px 1fr 1.6fr 70px',
                alignItems: 'center', gap: 10,
                padding: '5px 8px',
                background: C3,
                border: `2px solid ${C0}`,
                fontSize: 8,
              }}>
                <span style={{ color: C0 }}>★</span>
                <span style={{ color: C0 }}>{s.stack.toUpperCase()}/{s.name}</span>
                <span style={{ color: C1, fontSize: 7 }}>{s.image}</span>
                <span style={{ color: C0, textAlign: 'right' }}>{s.running}/{s.desired} ✓</span>
              </div>
            ))}
          </div>
        </div>

        {/* DIALOG BOX */}
        <div style={{
          border: `4px solid ${C0}`,
          background: '#c1d680',
          padding: '14px 16px',
          boxShadow: `4px 4px 0 ${C1}`,
          position: 'relative',
        }}>
          <div style={{ fontSize: 10, color: C0, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 6 }}>* You found <b>{FLEET_STATS.runningContainers} containers</b> running peacefully.</div>
            <div style={{ marginBottom: 6 }}>* All {FLEET_STATS.totalServices} services report healthy.</div>
            <div>* The fleet rests at <b>{fmtClock(clock)}</b>.</div>
          </div>
          <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 12, color: C0 }} className="pd-blink">▼</div>
        </div>

        {/* D-PAD HINT */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 7, color: C1, letterSpacing: 1 }}>
          <span>↑↓←→ NAVIGATE</span>
          <span>Ⓐ INSPECT</span>
          <span>Ⓑ BACK</span>
          <span>SELECT MENU</span>
          <span>START PAUSE</span>
        </div>
      </div>
    </div>
  );
}

function Hdr({ c0, title }) {
  return (
    <div style={{ borderBottom: `2px solid ${c0}`, paddingBottom: 4, marginBottom: 10, fontSize: 10, color: c0, letterSpacing: 2 }}>
      {title}
    </div>
  );
}

function Stat({ c0, c1, label, v, sub }) {
  return (
    <div style={{ borderRight: `2px dashed ${c1}`, padding: '0 6px' }}>
      <div style={{ fontSize: 7, color: c1, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 22, color: c0, lineHeight: 1.1, margin: '4px 0' }}>{v}</div>
      <div style={{ fontSize: 6, color: c1 }}>{sub}</div>
    </div>
  );
}

function Mug({ c0, c1, c2, blink, role }) {
  return (
    <svg width="48" height="40" viewBox="0 0 12 10" style={{ shapeRendering: 'crispEdges' }}>
      {role === 'manager' && <rect x="5" y="0" width="2" height="1" fill={c0} />}
      <rect x="3" y="1" width="6" height="6" fill={c1} />
      <rect x="2" y="2" width="1" height="4" fill={c0} />
      <rect x="9" y="2" width="1" height="4" fill={c0} />
      <rect x="3" y="1" width="6" height="1" fill={c0} />
      <rect x="3" y="6" width="6" height="1" fill={c0} />
      {!blink ? <>
        <rect x="4" y="3" width="1" height="1" fill={c0} />
        <rect x="7" y="3" width="1" height="1" fill={c0} />
      </> : <>
        <rect x="4" y="3" width="1" height="1" fill={c2} />
        <rect x="7" y="3" width="1" height="1" fill={c2} />
      </>}
      <rect x="4" y="5" width="4" height="1" fill={c0} />
      <rect x="3" y="7" width="6" height="2" fill={c1} />
      <rect x="3" y="7" width="1" height="2" fill={c0} />
      <rect x="8" y="7" width="1" height="2" fill={c0} />
      <rect x="3" y="9" width="6" height="1" fill={c0} />
    </svg>
  );
}

function Bigsprite({ color, bg }) {
  return (
    <svg width="44" height="44" viewBox="0 0 11 11" style={{ shapeRendering: 'crispEdges' }}>
      <rect x="0" y="0" width="11" height="11" fill={bg} />
      <rect x="2" y="1" width="7" height="9" fill={color} />
      <rect x="1" y="2" width="1" height="7" fill={color} />
      <rect x="9" y="2" width="1" height="7" fill={color} />
      <rect x="3" y="3" width="2" height="2" fill={bg} />
      <rect x="6" y="3" width="2" height="2" fill={bg} />
      <rect x="4" y="7" width="3" height="1" fill={bg} />
      <rect x="0" y="5" width="1" height="2" fill={color} />
      <rect x="10" y="5" width="1" height="2" fill={color} />
    </svg>
  );
}

window.V5GameBoy = V5GameBoy;
