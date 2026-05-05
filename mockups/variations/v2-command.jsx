/* eslint-disable */
// V2 — Command Center: dense flight-deck. Mission-control vibe.
// Single-screen multi-panel layout: live HUD up top, fleet map left, services
// center, container telemetry right, event log bottom. No scrolling.

const { useState: useState2 } = React;

function V2Command() {
  const { NODES, SERVICES, CONTAINERS, IMAGES, FLEET_STATS, EVENTS, spark } = window.PD;
  const tick = useTicker(1500);
  const clock = useClock();
  const [hot, setHot] = useState2('web_app.5');

  return (
    <div className="pd-frame pd-crt" style={{ background: '#040810' }}>
      <div className="pd-crt-screen" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* TOP COMMAND BAR */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '4px solid var(--border)', background: 'linear-gradient(180deg, #0a1024, #060a18)' }}>
          <div style={{ padding: '10px 14px', borderRight: '2px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>[</span>
            <span style={{ color: 'var(--blue)', fontSize: 11, textShadow: '0 0 8px var(--blue-glow)' }}>PX</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>]</span>
            <span style={{ fontSize: 12, letterSpacing: 2 }}>COMMAND</span>
          </div>

          {/* mission clock + 8 big numeric tiles */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', borderRight: '2px solid var(--border)' }}>
            {[
              { l: 'MODE', v: 'SWARM', c: 'var(--yellow)' },
              { l: 'NODES', v: `${FLEET_STATS.readyNodes}/${FLEET_STATS.totalNodes}`, c: 'var(--green)' },
              { l: 'SVCS', v: `${FLEET_STATS.healthyServices}/${FLEET_STATS.totalServices}`, c: 'var(--green)' },
              { l: 'CTR', v: `${FLEET_STATS.runningContainers}/${FLEET_STATS.totalContainers}`, c: 'var(--green)' },
              { l: 'REPL', v: `${FLEET_STATS.totalReplicas}/${FLEET_STATS.desiredReplicas}`, c: 'var(--cyan)' },
              { l: 'CPU', v: `${Math.round(FLEET_STATS.cpuAvg * 100)}%`, c: 'var(--blue)' },
              { l: 'MEM', v: `${Math.round(FLEET_STATS.memAvg * 100)}%`, c: 'var(--purple)' },
              { l: 'IMG', v: FLEET_STATS.totalImages, c: 'var(--magenta)' },
            ].map(t => (
              <div key={t.l} style={{ padding: '6px 10px', borderRight: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 6, color: 'var(--text-dim)', letterSpacing: 1 }}>{t.l}</span>
                <span style={{ fontSize: 13, color: t.c, textShadow: `0 0 6px ${t.c}` }}>{t.v}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 8 }}>
              <Led tone="green" blink /> WS LINK
            </span>
            <span className="pd-vt" style={{ fontSize: 18, color: 'var(--green)', textShadow: '0 0 6px var(--green-glow)' }}>{fmtClock(clock)}</span>
          </div>
        </div>

        {/* MAIN GRID */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 320px', gridTemplateRows: '1fr 220px', gap: 6, padding: 6, minHeight: 0 }}>

          {/* LEFT: NODES */}
          <div className="pd-pixel-border" style={{ padding: 10, gridRow: '1 / 2', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PanelTitle tone="blue" left="◆ NODES" right={`${FLEET_STATS.readyNodes}/${FLEET_STATS.totalNodes}`} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', paddingRight: 2 }}>
              {NODES.map(n => (
                <div key={n.id} style={{ background: 'var(--bg-dark)', border: '2px solid var(--border)', padding: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Led tone="green" blink={n.id === 'n5'} />
                    <span style={{ fontSize: 9 }}>{n.hostname}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 8, color: n.role === 'manager' ? 'var(--yellow)' : 'var(--text-dim)' }}>
                      {n.role === 'manager' ? '★ MGR' : '● WRK'}
                    </span>
                  </div>
                  <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 5 }}>{n.ip} · {n.cpus}c · {n.memGB}G</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 7, color: 'var(--text-dim)', width: 26 }}>CPU</span>
                    <Gauge value={n.cpuLoad} width={140} segmented segs={14} />
                    <span style={{ fontSize: 7, color: 'var(--text)', marginLeft: 'auto' }}>{Math.round(n.cpuLoad * 100)}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 7, color: 'var(--text-dim)', width: 26 }}>MEM</span>
                    <Gauge value={n.memUsed / n.memGB} width={140} segmented segs={14} />
                    <span style={{ fontSize: 7, color: 'var(--text)', marginLeft: 'auto' }}>{n.memUsed.toFixed(1)}G</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER: SERVICES MATRIX */}
          <div className="pd-pixel-border" style={{ padding: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PanelTitle tone="green" left="◆ SERVICE MATRIX" right={`${FLEET_STATS.healthyServices}/${FLEET_STATS.totalServices} HEALTHY`} />

            {/* node × service grid */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)', fontSize: 6, color: 'var(--text-dim)', borderBottom: '1px dashed var(--border)', paddingBottom: 4, marginBottom: 4, letterSpacing: 1 }}>
                <span>SERVICE</span>
                {NODES.map(n => <span key={n.id} style={{ textAlign: 'center' }}>{n.hostname.replace('-0', '·')}</span>)}
              </div>
              {SERVICES.map(svc => {
                const tasksByNode = {};
                CONTAINERS.filter(c => c.name.startsWith(svc.stack + '_' + svc.name)).forEach(c => {
                  tasksByNode[c.node] = (tasksByNode[c.node] || 0) + 1;
                });
                return (
                  <div key={svc.id} style={{ display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)', alignItems: 'center', padding: '5px 0', borderBottom: '1px dotted rgba(58,58,92,0.5)', fontSize: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Led tone="green" size="sm" />
                      <span style={{ color: 'var(--text)' }}>{svc.stack}_{svc.name}</span>
                    </span>
                    {NODES.map(n => {
                      const count = tasksByNode[n.hostname] || 0;
                      return (
                        <div key={n.id} style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 2 }}>
                          {count > 0 ? Array.from({ length: count }).map((_, i) => (
                            <span key={i} style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--green)', boxShadow: '0 0 4px var(--green-glow)' }} />
                          )) : <span style={{ color: 'var(--text-faint)', fontSize: 8 }}>·</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* sparkline strip */}
            <div style={{ borderTop: '2px solid var(--border)', marginTop: 6, paddingTop: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { l: 'REQ/S', c: 'var(--green)', v: 1842, d: spark(11 + tick, 28, 0.6, 0.3) },
                { l: 'CPU%',  c: 'var(--blue)',  v: 41,   d: spark(22 + tick, 28, 0.42, 0.2) },
                { l: 'MEM%',  c: 'var(--purple)',v: 38,   d: spark(33 + tick, 28, 0.4, 0.15) },
                { l: 'NET MB',c: 'var(--cyan)',  v: 124,  d: spark(44 + tick, 28, 0.5, 0.4) },
              ].map(s => (
                <div key={s.l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6, color: 'var(--text-dim)' }}>
                    <span>{s.l}</span>
                    <span style={{ color: s.c, fontSize: 8 }}>{s.v}</span>
                  </div>
                  <Sparkline data={s.d} width={140} height={20} color={s.c} fill />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: TARGET INSPECTOR */}
          <div className="pd-pixel-border" style={{ padding: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PanelTitle tone="yellow" left="◆ TARGET" right={hot} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 8, overflow: 'auto' }}>
              <div style={{ background: 'var(--bg-dark)', padding: 8, border: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Row k="ID" v="c·a8f3d2…" />
                <Row k="IMAGE" v="pixdock/web:1.4.2" />
                <Row k="NODE" v="worker-03" />
                <Row k="STATE" v={<span style={{ color: 'var(--green)' }}>RUNNING</span>} />
                <Row k="UPTIME" v="6h 12m" />
                <Row k="PORTS" v=":3000/tcp" />
              </div>

              <div style={{ background: 'var(--bg-dark)', padding: 8, border: '2px solid var(--border)' }}>
                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 4 }}>CPU · 24% / 200% LIM</div>
                <Bars data={spark(91 + tick, 22, 0.3, 0.3)} width={260} height={28} color="var(--blue)" />
              </div>
              <div style={{ background: 'var(--bg-dark)', padding: 8, border: '2px solid var(--border)' }}>
                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 4 }}>MEM · 309MB / 512MB</div>
                <Bars data={spark(108 + tick, 22, 0.6, 0.1)} width={260} height={28} color="var(--purple)" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 'auto' }}>
                {[
                  { i: '≡', t: 'LOGS', c: 'blue' },
                  { i: '↻', t: 'RESTART', c: 'yellow' },
                  { i: '■', t: 'STOP', c: 'red' },
                  { i: '⊕', t: 'EXEC', c: 'green' },
                ].map(b => (
                  <button key={b.t} style={{
                    background: 'var(--bg-panel)',
                    border: `2px solid var(--${b.c})`,
                    color: `var(--${b.c})`,
                    fontSize: 7, padding: '8px 4px', letterSpacing: 1,
                  }}>{b.i} {b.t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM-LEFT: CONTAINER LIST */}
          <div className="pd-pixel-border" style={{ padding: 10, gridColumn: '1 / 3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PanelTitle tone="green" left="◆ TASK ROSTER" right={`${FLEET_STATS.runningContainers} RUNNING`} />
            <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0, alignContent: 'start', columnGap: 8, rowGap: 0 }}>
              {CONTAINERS.map(c => (
                <div key={c.id}
                  onClick={() => setHot(c.name)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '12px 1.4fr 1fr 36px 36px',
                    alignItems: 'center', gap: 8,
                    padding: '4px 6px', fontSize: 7,
                    background: hot === c.name ? 'var(--bg-panel-light)' : 'transparent',
                    borderLeft: hot === c.name ? '2px solid var(--blue)' : '2px solid transparent',
                    cursor: 'pointer',
                    borderBottom: '1px dotted rgba(58,58,92,0.5)',
                  }}>
                  <Led tone="green" size="sm" />
                  <span style={{ color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{c.node}</span>
                  <span style={{ color: 'var(--blue)', textAlign: 'right' }}>{Math.round(c.cpu * 100)}%</span>
                  <span style={{ color: 'var(--purple)', textAlign: 'right' }}>{c.mem}M</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM-RIGHT: EVENT LOG */}
          <div className="pd-pixel-border" style={{ padding: 10, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PanelTitle tone="purple" left="◆ EVENT LOG" right="LIVE" />
            <div className="pd-mono" style={{ flex: 1, overflow: 'auto', fontSize: 9, lineHeight: 1.5 }}>
              {EVENTS.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0' }}>
                  <span style={{ color: 'var(--text-faint)' }}>{e.t}</span>
                  <span style={{ color: e.lvl === 'OK' ? 'var(--green)' : 'var(--blue)', width: 28 }}>{e.lvl}</span>
                  <span style={{ color: 'var(--text)' }}>{e.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelTitle({ tone = 'blue', left, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 5, marginBottom: 8 }}>
      <span style={{ fontSize: 8, color: `var(--${tone})`, letterSpacing: 2 }}>{left}</span>
      <span style={{ fontSize: 7, color: 'var(--text-dim)', letterSpacing: 1 }}>{right}</span>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7 }}>
      <span style={{ color: 'var(--text-dim)' }}>{k}</span>
      <span style={{ color: 'var(--text)' }}>{v}</span>
    </div>
  );
}

window.V2Command = V2Command;
