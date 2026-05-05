/* eslint-disable */
// V4 — Mainframe Console: monochrome amber phosphor, dense ASCII grid.
// VT323 typography, table-heavy, IBM 3270 vibes.

const { useState: useState4 } = React;

function V4Mainframe() {
  const { NODES, SERVICES, CONTAINERS, FLEET_STATS, EVENTS, spark } = window.PD;
  const tick = useTicker(1000);
  const clock = useClock();
  const amber = '#ffb000';
  const dim = '#a87300';
  const faint = '#5a3a00';

  return (
    <div className="pd-frame pd-crt" style={{ background: '#0a0500', color: amber, '--crt': 0.7 }}>
      <div className="pd-crt-screen pd-vt" style={{ height: '100%', overflow: 'auto', padding: 12, fontSize: 16, lineHeight: 1.15 }}>

        {/* ASCII HEADER */}
        <pre style={{ color: amber, margin: 0, textShadow: `0 0 6px ${amber}`, fontSize: 14, lineHeight: 1.05 }}>{`
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║  PIXDOCK / MAINFRAME 0.2.0   ·   TERMINAL 01   ·   ${fmtDate(clock)}   ${fmtClock(clock)}   ·   USR: ROOT   ·   SWARM ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝`}</pre>

        {/* TOP STATUS LINE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, border: `1px solid ${dim}`, marginTop: 8 }}>
          {[
            ['NODES', `${FLEET_STATS.readyNodes}/${FLEET_STATS.totalNodes}`],
            ['SVCS',  `${FLEET_STATS.healthyServices}/${FLEET_STATS.totalServices}`],
            ['TASKS', `${FLEET_STATS.runningContainers}/${FLEET_STATS.totalContainers}`],
            ['REPL',  `${FLEET_STATS.totalReplicas}/${FLEET_STATS.desiredReplicas}`],
            ['IMG',   FLEET_STATS.totalImages],
            ['CPU',   `${Math.round(FLEET_STATS.cpuAvg * 100)}%`],
            ['MEM',   `${Math.round(FLEET_STATS.memAvg * 100)}%`],
          ].map(([k, v], i) => (
            <div key={k} style={{ padding: '6px 10px', borderRight: i < 6 ? `1px solid ${faint}` : 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: dim }}>{k}</span>
              <span style={{ color: amber, textShadow: `0 0 5px ${amber}` }}>{v}</span>
            </div>
          ))}
        </div>

        {/* TWO-COLUMN: NODE TABLE + SERVICE TABLE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div>
            <Banner color={amber} text="NODE.TABLE" sub={`${NODES.length} ROWS`} />
            <div style={{ border: `1px solid ${dim}`, padding: '4px 8px' }}>
              <Hd cols={['HOST', 'IP', 'ROLE', 'CPU', 'MEM', 'UP']} widths={[2.1, 1.7, 0.9, 1, 1, 1]} dim={dim} />
              {NODES.map(n => (
                <Cell key={n.id} cols={[
                  <><span style={{ color: amber }}>●</span> {n.hostname}</>,
                  n.ip,
                  n.role.toUpperCase(),
                  `${Math.round(n.cpuLoad * 100)}%`,
                  `${n.memUsed.toFixed(0)}/${n.memGB}G`,
                  n.uptime,
                ]} widths={[2.1, 1.7, 0.9, 1, 1, 1]} amber={amber} />
              ))}
            </div>
          </div>

          <div>
            <Banner color={amber} text="SERVICE.TABLE" sub={`${SERVICES.length} ROWS`} />
            <div style={{ border: `1px solid ${dim}`, padding: '4px 8px' }}>
              <Hd cols={['STACK', 'NAME', 'IMG', 'REPL', 'PORT']} widths={[1, 1.3, 2, 0.9, 0.9]} dim={dim} />
              {SERVICES.map(s => (
                <Cell key={s.id} cols={[
                  s.stack,
                  s.name,
                  s.image.split(':')[0].split('/').slice(-1)[0],
                  `${s.running}/${s.desired}`,
                  s.ports.join(','),
                ]} widths={[1, 1.3, 2, 0.9, 0.9]} amber={amber} />
              ))}
            </div>
          </div>
        </div>

        {/* CONTAINER MEGA-TABLE */}
        <div style={{ marginTop: 14 }}>
          <Banner color={amber} text="TASK.TABLE" sub={`${CONTAINERS.length} ROWS · FILTER: ALL`} />
          <div style={{ border: `1px solid ${dim}`, padding: '4px 8px' }}>
            <Hd cols={['ID', 'NAME', 'STACK', 'IMAGE', 'NODE', 'STATE', 'CPU%', 'MEMMB', 'UP']} widths={[0.6, 2.2, 0.9, 2.4, 1.1, 0.9, 0.7, 0.8, 0.7]} dim={dim} />
            {CONTAINERS.map(c => (
              <Cell key={c.id} cols={[
                c.id,
                c.name,
                c.stack,
                c.image,
                c.node,
                <span style={{ color: amber, textShadow: `0 0 4px ${amber}` }}>RUNNING</span>,
                Math.round(c.cpu * 100),
                c.mem,
                c.uptime,
              ]} widths={[0.6, 2.2, 0.9, 2.4, 1.1, 0.9, 0.7, 0.8, 0.7]} amber={amber} />
            ))}
          </div>
        </div>

        {/* ASCII BAR CHART */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Banner color={amber} text="LOAD.BY.NODE" sub="REAL-TIME" />
            <div style={{ border: `1px solid ${dim}`, padding: 8 }}>
              {NODES.map(n => (
                <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 50px', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                  <span>{n.hostname}</span>
                  <span style={{ color: amber }}>
                    {'█'.repeat(Math.max(1, Math.round(n.cpuLoad * 32)))}
                    <span style={{ color: faint }}>{'░'.repeat(Math.max(0, 32 - Math.round(n.cpuLoad * 32)))}</span>
                  </span>
                  <span style={{ color: dim, textAlign: 'right' }}>{Math.round(n.cpuLoad * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Banner color={amber} text="EVENT.STREAM" sub="TAIL -F" />
            <div style={{ border: `1px solid ${dim}`, padding: 8, height: '100%' }}>
              {EVENTS.map((e, i) => (
                <div key={i} style={{ padding: '1px 0' }}>
                  <span style={{ color: faint }}>{e.t}</span>{' '}
                  <span style={{ color: e.lvl === 'OK' ? amber : dim, textShadow: e.lvl === 'OK' ? `0 0 4px ${amber}` : 'none' }}>[{e.lvl}]</span>{' '}
                  <span>{e.msg}</span>
                </div>
              ))}
              <div style={{ color: amber, textShadow: `0 0 6px ${amber}` }} className="pd-blink">▮</div>
            </div>
          </div>
        </div>

        {/* COMMAND LINE */}
        <div style={{ marginTop: 14, border: `1px solid ${dim}`, padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: amber, textShadow: `0 0 4px ${amber}` }}>pixdock@swarm:~$</span>
          <span style={{ color: amber }}>docker service ls --filter mode=replicated</span>
          <span style={{ color: amber }} className="pd-blink">█</span>
          <span style={{ marginLeft: 'auto', color: dim, fontSize: 14 }}>F1 HELP · F3 STOP · F5 REFRESH · F10 EXIT</span>
        </div>
      </div>
    </div>
  );
}

function Banner({ color, text, sub }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${color}`, padding: '2px 4px', marginBottom: 4 }}>
      <span style={{ color, textShadow: `0 0 6px ${color}`, letterSpacing: 1 }}>━━ {text} ━━</span>
      <span style={{ color: '#a87300' }}>{sub}</span>
    </div>
  );
}

function Hd({ cols, widths, dim }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: widths.map(w => `${w}fr`).join(' '), gap: 8, color: dim, borderBottom: `1px dashed ${dim}`, paddingBottom: 2, marginBottom: 2, letterSpacing: 1 }}>
      {cols.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  );
}

function Cell({ cols, widths, amber }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: widths.map(w => `${w}fr`).join(' '), gap: 8, padding: '1px 0', color: amber }}>
      {cols.map((c, i) => <span key={i} style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c}</span>)}
    </div>
  );
}

window.V4Mainframe = V4Mainframe;
