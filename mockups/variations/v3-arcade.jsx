/* eslint-disable */
// V3 — Arcade Cabinet: theatrical, chunky, scoreboard-style.
// Big sprite-y status displays, neon glows, "INSERT COIN"-style copy.

const { useState: useState3 } = React;

function V3Arcade() {
  const { NODES, SERVICES, CONTAINERS, FLEET_STATS, EVENTS, spark } = window.PD;
  const tick = useTicker(900);
  const clock = useClock();

  const score = FLEET_STATS.runningContainers * 1000 + FLEET_STATS.healthyServices * 100;

  return (
    <div className="pd-frame pd-crt" style={{ background: '#05010a', '--crt': 0.85 }}>
      <div className="pd-crt-screen" style={{ height: '100%', overflow: 'auto' }}>

        {/* MARQUEE BAND */}
        <div style={{
          background: 'linear-gradient(180deg, #2a0050 0%, #6b18a8 50%, #2a0050 100%)',
          borderBottom: '4px solid var(--magenta)',
          padding: '8px 0',
          textAlign: 'center',
          color: '#fff5ff',
          fontSize: 16,
          letterSpacing: 6,
          textShadow: '0 0 12px #f0abfc, 0 0 4px #fff',
        }}>
          ★ ★ ★ &nbsp; PIXDOCK ARCADE &nbsp; ★ &nbsp; FLEET ONLINE &nbsp; ★ ★ ★
        </div>

        {/* SCOREBOARD */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 8, background: '#0a0218' }}>
          <div style={{
            border: '4px solid var(--cyan)',
            background: '#000018',
            padding: 12,
            textAlign: 'center',
            boxShadow: 'inset 0 0 18px rgba(103, 232, 249, 0.3), 0 0 12px var(--cyan)',
          }}>
            <div style={{ fontSize: 8, color: 'var(--cyan)', letterSpacing: 2, marginBottom: 6 }}>1UP · OPERATOR</div>
            <div className="pd-vt" style={{ fontSize: 36, color: 'var(--cyan)', textShadow: '0 0 14px var(--cyan), 0 0 4px #fff', letterSpacing: 2 }}>
              {String(score).padStart(7, '0')}
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 4, letterSpacing: 1 }}>FLEET SCORE</div>
          </div>
          <div style={{
            border: '4px solid var(--yellow)',
            background: '#000018',
            padding: 12,
            textAlign: 'center',
            boxShadow: 'inset 0 0 18px rgba(251, 191, 36, 0.3), 0 0 12px var(--yellow)',
          }}>
            <div style={{ fontSize: 8, color: 'var(--yellow)', letterSpacing: 2, marginBottom: 6 }}>HI-SCORE</div>
            <div className="pd-vt" style={{ fontSize: 36, color: 'var(--yellow)', textShadow: '0 0 14px var(--yellow), 0 0 4px #fff', letterSpacing: 2 }}>
              0099900
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 4, letterSpacing: 1 }}>UPTIME 47D 6H</div>
          </div>
          <div style={{
            border: '4px solid var(--green)',
            background: '#000018',
            padding: 12,
            textAlign: 'center',
            boxShadow: 'inset 0 0 18px rgba(74, 222, 128, 0.3), 0 0 12px var(--green)',
          }}>
            <div style={{ fontSize: 8, color: 'var(--green)', letterSpacing: 2, marginBottom: 6 }}>TIME</div>
            <div className="pd-vt" style={{ fontSize: 36, color: 'var(--green)', textShadow: '0 0 14px var(--green), 0 0 4px #fff', letterSpacing: 2 }}>
              {fmtClock(clock)}
            </div>
            <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 4, letterSpacing: 1 }}>SWARM · {FLEET_STATS.totalNodes} NODES</div>
          </div>
        </div>

        {/* PLAYER PANELS — Nodes as fighters */}
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--magenta)', textShadow: '0 0 8px var(--magenta)', letterSpacing: 3 }}>★ FIGHTERS</span>
            <span style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, var(--magenta), transparent)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {NODES.map((n, i) => {
              const cpuHP = Math.max(0.1, 1 - n.cpuLoad);
              const memHP = Math.max(0.1, 1 - n.memUsed / n.memGB);
              const tone = n.role === 'manager' ? 'var(--yellow)' : i % 2 === 0 ? 'var(--cyan)' : 'var(--magenta)';
              return (
                <div key={n.id} style={{
                  border: `4px solid ${tone}`,
                  background: 'linear-gradient(180deg, rgba(0,0,30,0.9), rgba(20,0,40,0.9))',
                  padding: 10,
                  boxShadow: `0 0 10px ${tone}, inset 0 0 12px rgba(0,0,0,0.6)`,
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ color: tone, fontSize: 10, textShadow: `0 0 6px ${tone}` }}>{n.role === 'manager' ? '★' : '●'}</span>
                    <span style={{ fontSize: 9, color: '#fff' }}>{n.hostname.toUpperCase()}</span>
                  </div>
                  {/* Sprite portrait — pixel mug */}
                  <div style={{
                    width: '100%',
                    aspectRatio: '1.4',
                    background: `repeating-linear-gradient(45deg, ${tone}22 0 4px, transparent 4px 8px), #000018`,
                    border: `2px solid ${tone}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    marginBottom: 8,
                  }}>
                    <NodeMug tone={tone} role={n.role} blink={(tick + i) % 4 === 0} />
                  </div>

                  <div style={{ fontSize: 7, color: 'var(--text-dim)', marginBottom: 3 }}>HP · CPU</div>
                  <Gauge value={cpuHP} width={'100%'} height={12} tone={cpuHP > 0.4 ? 'ok' : 'warn'} />
                  <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 6, marginBottom: 3 }}>MP · MEM</div>
                  <Gauge value={memHP} width={'100%'} height={12} tone={memHP > 0.4 ? 'ok' : 'warn'} />

                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 7 }}>
                    <span style={{ color: 'var(--text-dim)' }}>LV.{n.cpus}</span>
                    <span style={{ color: 'var(--green)' }}>READY</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STAGE: STACKS as worlds */}
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--cyan)', textShadow: '0 0 8px var(--cyan)', letterSpacing: 3 }}>★ STAGES</span>
            <span style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, var(--cyan), transparent)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {window.PD.STACKS.map((stack, si) => {
              const svcs = SERVICES.filter(s => s.stack === stack);
              const ctrs = CONTAINERS.filter(c => c.stack === stack);
              const ok = svcs.every(s => s.running >= s.desired);
              return (
                <div key={stack} style={{
                  border: '4px solid var(--green)',
                  background: 'linear-gradient(180deg, #000020, #001028)',
                  boxShadow: '0 0 12px var(--green-glow), inset 0 0 16px rgba(0,0,0,0.7)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'linear-gradient(90deg, rgba(74,222,128,0.18), transparent)',
                    borderBottom: '2px solid var(--green)',
                  }}>
                    <span style={{ fontSize: 11, color: '#caffd5', letterSpacing: 2, textShadow: '0 0 6px var(--green)' }}>
                      STAGE {si + 1} — {stack.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 8, color: ok ? 'var(--green)' : 'var(--red)' }}>
                      {ok ? '★ CLEAR' : 'BOSS'}
                    </span>
                  </div>
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {svcs.map(s => (
                      <div key={s.id} style={{
                        display: 'grid',
                        gridTemplateColumns: '14px 1fr 1.4fr auto',
                        alignItems: 'center', gap: 10,
                        padding: '6px 8px',
                        background: 'rgba(0,0,0,0.45)',
                        border: '2px solid #1a3a4a',
                        fontSize: 8,
                      }}>
                        <Led tone="green" />
                        <span style={{ color: '#fff' }}>{s.name.toUpperCase()}</span>
                        <Gauge value={s.running} max={s.desired} width={'100%'} height={10} segmented segs={Math.max(s.desired, 4)} />
                        <span style={{ fontSize: 8, color: 'var(--green)', textShadow: '0 0 4px var(--green)' }}>×{s.running}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 7, color: 'var(--text-dim)', textAlign: 'right' }}>
                      ENEMIES: {ctrs.length} CLEARED
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTAINER ARMY ROW */}
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--yellow)', textShadow: '0 0 8px var(--yellow)', letterSpacing: 3 }}>★ ARMY ({FLEET_STATS.runningContainers})</span>
            <span style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, var(--yellow), transparent)' }} />
          </div>

          <div style={{
            background: '#000018',
            border: '4px solid var(--yellow)',
            padding: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(11, 1fr)',
            gap: 6,
            boxShadow: '0 0 12px var(--yellow-glow), inset 0 0 14px rgba(0,0,0,0.6)',
          }}>
            {CONTAINERS.map((c, i) => (
              <div key={c.id} title={c.name} style={{
                aspectRatio: 1,
                background: i % 2 ? '#001a08' : '#001020',
                border: '2px solid var(--green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                animation: `pd-bob 1.${i % 9}s ease-in-out infinite`,
              }}>
                <Sprite seed={i} />
                <span style={{ position: 'absolute', bottom: -1, right: 1, fontSize: 6, color: 'var(--yellow)' }}>{c.id.slice(1)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, textAlign: 'center', fontSize: 9, color: 'var(--magenta)', letterSpacing: 3, textShadow: '0 0 6px var(--magenta)' }} className="pd-blink">
            ▶ PRESS START TO DEPLOY ◀
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeMug({ tone, role, blink }) {
  // Tiny pixel-art portrait — abstract, no copyrighted shapes
  return (
    <svg width="56" height="40" viewBox="0 0 14 10" style={{ shapeRendering: 'crispEdges' }}>
      <rect x="3" y="1" width="8" height="6" fill={tone} opacity="0.85" />
      <rect x="2" y="2" width="1" height="4" fill={tone} />
      <rect x="11" y="2" width="1" height="4" fill={tone} />
      <rect x="5" y="3" width="1" height="1" fill="#000" />
      <rect x="8" y="3" width="1" height="1" fill="#000" />
      {!blink && <>
        <rect x="5" y="3" width="1" height="1" fill="#fff" />
        <rect x="8" y="3" width="1" height="1" fill="#fff" />
      </>}
      <rect x="5" y="5" width="4" height="1" fill="#000" />
      {role === 'manager' && <rect x="6" y="0" width="2" height="1" fill="var(--yellow)" />}
      <rect x="3" y="7" width="8" height="2" fill={tone} opacity="0.5" />
    </svg>
  );
}

function Sprite({ seed }) {
  // Procedural pixel sprite — symmetric blob
  const colors = ['var(--green)', 'var(--cyan)', 'var(--magenta)', 'var(--yellow)', 'var(--blue)'];
  const c = colors[seed % colors.length];
  const r = (n) => ((seed * 7 + n * 13) % 100) / 100;
  return (
    <svg width="28" height="28" viewBox="0 0 7 7" style={{ shapeRendering: 'crispEdges' }}>
      {[0,1,2,3].map(y => [0,1,2,3].map(x => {
        const on = r(y * 4 + x) > 0.45;
        if (!on) return null;
        return <g key={`${x}-${y}`}>
          <rect x={x} y={y + 1} width="1" height="1" fill={c} />
          <rect x={6 - x} y={y + 1} width="1" height="1" fill={c} />
        </g>;
      }))}
    </svg>
  );
}

window.V3Arcade = V3Arcade;
