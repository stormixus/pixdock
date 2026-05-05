/* eslint-disable */
// V1 — Faithful: same shape as the existing dashboard, but tightened up.
// Header → System Overview ribbon → Node Rack → Services → Containers → Status bar.
// Pushes retro a bit further with bolder LEDs, scanline reflections, and live counters.

const { useState: useState1, useMemo: useMemo1 } = React;

function V1Faithful() {
  const { NODES, SERVICES, CONTAINERS, STACKS, IMAGES, FLEET_STATS, EVENTS, spark } = window.PD;
  const tick = useTicker(2000);
  const clock = useClock();
  const [filter, setFilter] = useState1('ALL');
  const [search, setSearch] = useState1('');
  const [sel, setSel] = useState1(null);

  const filtered = useMemo1(() => {
    return CONTAINERS.filter(c => {
      const m1 = filter === 'ALL' || (filter === 'RUNNING' && c.state === 'running');
      const m2 = !search || c.name.includes(search) || c.image.includes(search);
      return m1 && m2;
    });
  }, [filter, search]);

  const grouped = useMemo1(() => {
    const m = new Map();
    filtered.forEach(c => {
      if (!m.has(c.stack)) m.set(c.stack, []);
      m.get(c.stack).push(c);
    });
    return [...m.entries()];
  }, [filtered]);

  return (
    <div className="pd-frame pd-crt">
      <div className="pd-crt-screen" style={{ height: '100%', overflow: 'auto', background: 'var(--bg-dark)' }}>
        {/* HEADER */}
        <header className="pd-pixel-border" style={{ margin: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 14, letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 16 }}>[</span>
            <span style={{ color: 'var(--blue)', fontSize: 12, textShadow: '0 0 6px var(--blue-glow)' }}>PX</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 16 }}>]</span>
            <span>PIX<span style={{ color: 'var(--green)', textShadow: '0 0 6px var(--green-glow)' }}>DOCK</span></span>
          </h1>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: 8, color: 'var(--text-dim)' }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Led tone="green" blink /> CONNECTED</span>
            <span style={{ color: 'var(--yellow)', border: '1px solid var(--yellow)', padding: '3px 7px', fontSize: 7 }}>SWARM</span>
            <span>NODES: <span style={{ color: 'var(--text)' }}>{FLEET_STATS.readyNodes}/{FLEET_STATS.totalNodes}</span></span>
            <span>SVCS: <span style={{ color: 'var(--text)' }}>{FLEET_STATS.healthyServices}/{FLEET_STATS.totalServices}</span></span>
            <span>CTR: <span style={{ color: 'var(--green)' }}>{FLEET_STATS.runningContainers}/{FLEET_STATS.totalContainers}</span></span>
            <span style={{ color: 'var(--green)', fontSize: 7, letterSpacing: 1 }}>● LOGGED IN</span>
            <button style={{ fontSize: 7, color: 'var(--red)', border: '1px solid var(--red)', padding: '3px 8px' }}>LOGOUT</button>
          </div>
        </header>

        {/* OVERVIEW RIBBON */}
        <section style={{ margin: 8 }}>
          <h2 style={{ fontSize: 9, color: 'var(--blue)', marginBottom: 8, letterSpacing: 2 }}>▶ SYSTEM OVERVIEW</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'HOSTS',      val: FLEET_STATS.readyNodes, tot: FLEET_STATS.totalNodes, color: 'var(--blue)' },
              { label: 'CONTAINERS', val: FLEET_STATS.runningContainers, tot: FLEET_STATS.totalContainers, color: 'var(--green)' },
              { label: 'SERVICES',   val: FLEET_STATS.healthyServices, tot: FLEET_STATS.totalServices, color: 'var(--green)' },
              { label: 'IMAGES',     val: FLEET_STATS.totalImages, tot: null, color: 'var(--purple)' },
            ].map(s => (
              <div key={s.label} className="pd-pixel-border" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'var(--text-dim)' }}>
                  <span>{s.label}</span>
                  <Led tone={s.color === 'var(--red)' ? 'red' : 'green'} size="sm" />
                </div>
                <div style={{ fontSize: 22, color: s.color, letterSpacing: 1, textShadow: `0 0 8px ${s.color}` }}>
                  {s.val}{s.tot != null && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>/{s.tot}</span>}
                </div>
                <Sparkline data={spark(s.label.length * 7 + tick, 16, 0.55, 0.3)} width={140} height={16} color={s.color} fill />
              </div>
            ))}
          </div>
        </section>

        {/* NODE RACK */}
        <section style={{ margin: 8 }}>
          <h2 style={{ fontSize: 9, color: 'var(--blue)', marginBottom: 8, letterSpacing: 2 }}>▶ SERVER RACK</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {NODES.map(n => (
              <div key={n.id} className="pd-pixel-border" style={{ padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <Led tone="green" />
                  <Led tone="green" />
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: n.role === 'manager' ? 'var(--yellow)' : 'var(--text-dim)' }}>
                    {n.role === 'manager' ? '★' : '●'}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text)', marginBottom: 2 }}>{n.hostname}</div>
                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 8 }}>{n.ip}</div>
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: 6, fontSize: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>CPU</span>
                    <Gauge value={n.cpuLoad} width={50} segmented segs={10} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>MEM</span>
                    <Gauge value={n.memUsed / n.memGB} width={50} segmented segs={10} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-dim)' }}>UP</span>
                    <span style={{ color: 'var(--text)' }}>{n.uptime}</span>
                  </div>
                </div>
                <div style={{ borderTop: '2px solid var(--border)', marginTop: 6, paddingTop: 4, textAlign: 'center', fontSize: 7, color: 'var(--green)' }}>READY</div>
              </div>
            ))}
          </div>
        </section>

        {/* SERVICES */}
        <section style={{ margin: 8 }}>
          <h2 style={{ fontSize: 9, color: 'var(--blue)', marginBottom: 8, letterSpacing: 2 }}>▶ SERVICES</h2>
          {STACKS.map(stack => {
            const svcs = SERVICES.filter(s => s.stack === stack);
            return (
              <div key={stack} className="pd-pixel-border" style={{ padding: 10, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: 5, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--purple)', letterSpacing: 1 }}>{stack.toUpperCase()}</span>
                  <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{svcs.length} svc</span>
                </div>
                {svcs.map(svc => (
                  <div key={svc.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr 110px 1.4fr auto', gap: 10, alignItems: 'center', padding: '4px 8px', background: 'var(--bg-dark)', marginBottom: 3, fontSize: 8 }}>
                    <Led tone="green" />
                    <span>{svc.name}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Gauge value={svc.running} max={svc.desired} width={48} tone="ok" />
                      <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{svc.running}/{svc.desired}</span>
                    </div>
                    <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{svc.image}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {svc.ports.map(p => (
                        <span key={p} style={{ fontSize: 7, color: 'var(--blue)', background: 'rgba(96,165,250,0.1)', padding: '1px 4px', border: '1px solid var(--blue)' }}>:{p}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        {/* CONTAINERS */}
        <section style={{ margin: 8 }}>
          <h2 style={{ fontSize: 9, color: 'var(--blue)', marginBottom: 8, letterSpacing: 2 }}>▶ CONTAINERS</h2>
          <div className="pd-pixel-border" style={{ padding: 8, marginBottom: 6, display: 'flex', gap: 8 }}>
            <input
              placeholder="search by name/image..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'var(--bg-dark)', border: '2px solid var(--border)', color: 'var(--text)', padding: '6px 8px', fontSize: 8, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {['ALL', 'RUNNING', 'STOPPED'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? 'var(--blue)' : 'var(--bg-panel)',
                  color: filter === f ? 'var(--bg-dark)' : 'var(--text-dim)',
                  border: '2px solid var(--border)', borderColor: filter === f ? 'var(--blue)' : 'var(--border)',
                  fontSize: 8, padding: '6px 8px',
                }}>{f}</button>
              ))}
            </div>
          </div>
          {grouped.map(([stack, ctrs]) => (
            <div key={stack} className="pd-pixel-border" style={{ padding: 10, marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border)', paddingBottom: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: 'var(--purple)', letterSpacing: 1 }}>{stack.toUpperCase()}</span>
                <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{ctrs.length} running</span>
              </div>
              {ctrs.map(c => (
                <div key={c.id}
                  onClick={() => setSel(c.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '14px 1.4fr 70px 1.4fr auto auto',
                    alignItems: 'center', gap: 12,
                    padding: '5px 8px', fontSize: 8,
                    background: sel === c.id ? 'var(--bg-panel-light)' : 'var(--bg-dark)',
                    border: sel === c.id ? '1px solid var(--blue)' : '1px solid transparent',
                    marginBottom: 3, cursor: 'pointer',
                  }}>
                  <Led tone={stateLed(c.state)} />
                  <span>{c.name}</span>
                  <span style={{ color: 'var(--green)', fontSize: 7 }}>RUNNING</span>
                  <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{c.image}</span>
                  <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>{c.node}</span>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <ActionBtn icon="≡" tone="blue" title="logs" />
                    <ActionBtn icon="■" tone="red" title="stop" />
                    <ActionBtn icon="↻" tone="yellow" title="restart" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>

        {/* STATUS BAR */}
        <footer style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-panel)', borderTop: '4px solid var(--border)', fontSize: 7, color: 'var(--text-dim)' }}>
          <span>PIXDOCK v0.2.0</span>
          <span>MODE: SWARM</span>
          <span>LAST UPDATE: {fmtClock(clock)}</span>
          <span style={{ color: 'var(--green)' }}>WS: CONNECTED</span>
        </footer>
      </div>
    </div>
  );
}

window.V1Faithful = V1Faithful;
