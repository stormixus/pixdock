/* eslint-disable */
// Mock fleet — healthy state per user request

const NODES = [
  { id: 'n1', hostname: 'manager-01', role: 'manager', status: 'ready', availability: 'active', ip: '10.0.1.10', cpus: 16, memGB: 64, cpuLoad: 0.42, memUsed: 28.4, uptime: '47d 6h' },
  { id: 'n2', hostname: 'worker-01',  role: 'worker',  status: 'ready', availability: 'active', ip: '10.0.1.11', cpus: 8,  memGB: 32, cpuLoad: 0.61, memUsed: 19.1, uptime: '47d 6h' },
  { id: 'n3', hostname: 'worker-02',  role: 'worker',  status: 'ready', availability: 'active', ip: '10.0.1.12', cpus: 8,  memGB: 32, cpuLoad: 0.38, memUsed: 14.7, uptime: '12d 2h' },
  { id: 'n4', hostname: 'worker-03',  role: 'worker',  status: 'ready', availability: 'active', ip: '10.0.1.13', cpus: 8,  memGB: 32, cpuLoad: 0.55, memUsed: 17.9, uptime: '12d 2h' },
  { id: 'n5', hostname: 'edge-01',    role: 'worker',  status: 'ready', availability: 'active', ip: '10.0.2.20', cpus: 4,  memGB: 16, cpuLoad: 0.23, memUsed: 6.2,  uptime: '3d 14h' },
];

const SERVICES = [
  { id: 's1', stack: 'web',         name: 'nginx',      image: 'nginx:1.27-alpine',     running: 4, desired: 4, ports: [80, 443] },
  { id: 's2', stack: 'web',         name: 'app',        image: 'pixdock/web:1.4.2',     running: 6, desired: 6, ports: [3000] },
  { id: 's3', stack: 'api',         name: 'gateway',    image: 'kong:3.6',              running: 3, desired: 3, ports: [8000] },
  { id: 's4', stack: 'api',         name: 'auth',       image: 'pixdock/auth:0.9',      running: 2, desired: 2, ports: [4000] },
  { id: 's5', stack: 'data',        name: 'postgres',   image: 'postgres:16-alpine',    running: 1, desired: 1, ports: [5432] },
  { id: 's6', stack: 'data',        name: 'redis',      image: 'redis:7-alpine',        running: 3, desired: 3, ports: [6379] },
  { id: 's7', stack: 'monitoring',  name: 'prometheus', image: 'prom/prometheus:2.51',  running: 1, desired: 1, ports: [9090] },
  { id: 's8', stack: 'monitoring',  name: 'grafana',    image: 'grafana/grafana:10.4',  running: 1, desired: 1, ports: [3001] },
  { id: 's9', stack: 'monitoring',  name: 'loki',       image: 'grafana/loki:2.9',      running: 1, desired: 1, ports: [3100] },
];

const CONTAINERS = [
  { id: 'c01', name: 'web_nginx.1',     image: 'nginx:1.27-alpine',    state: 'running', stack: 'web',        node: 'edge-01',   uptime: '3d',  cpu: 0.04, mem: 42 },
  { id: 'c02', name: 'web_nginx.2',     image: 'nginx:1.27-alpine',    state: 'running', stack: 'web',        node: 'worker-01', uptime: '3d',  cpu: 0.06, mem: 48 },
  { id: 'c03', name: 'web_nginx.3',     image: 'nginx:1.27-alpine',    state: 'running', stack: 'web',        node: 'worker-02', uptime: '3d',  cpu: 0.05, mem: 44 },
  { id: 'c04', name: 'web_nginx.4',     image: 'nginx:1.27-alpine',    state: 'running', stack: 'web',        node: 'worker-03', uptime: '3d',  cpu: 0.05, mem: 41 },
  { id: 'c05', name: 'web_app.1',       image: 'pixdock/web:1.4.2',    state: 'running', stack: 'web',        node: 'worker-01', uptime: '6h',  cpu: 0.21, mem: 312 },
  { id: 'c06', name: 'web_app.2',       image: 'pixdock/web:1.4.2',    state: 'running', stack: 'web',        node: 'worker-01', uptime: '6h',  cpu: 0.18, mem: 304 },
  { id: 'c07', name: 'web_app.3',       image: 'pixdock/web:1.4.2',    state: 'running', stack: 'web',        node: 'worker-02', uptime: '6h',  cpu: 0.24, mem: 318 },
  { id: 'c08', name: 'web_app.4',       image: 'pixdock/web:1.4.2',    state: 'running', stack: 'web',        node: 'worker-02', uptime: '6h',  cpu: 0.22, mem: 309 },
  { id: 'c09', name: 'web_app.5',       image: 'pixdock/web:1.4.2',    state: 'running', stack: 'web',        node: 'worker-03', uptime: '6h',  cpu: 0.19, mem: 297 },
  { id: 'c10', name: 'web_app.6',       image: 'pixdock/web:1.4.2',    state: 'running', stack: 'web',        node: 'worker-03', uptime: '6h',  cpu: 0.20, mem: 301 },
  { id: 'c11', name: 'api_gateway.1',   image: 'kong:3.6',             state: 'running', stack: 'api',        node: 'manager-01',uptime: '2d',  cpu: 0.09, mem: 188 },
  { id: 'c12', name: 'api_gateway.2',   image: 'kong:3.6',             state: 'running', stack: 'api',        node: 'worker-01', uptime: '2d',  cpu: 0.11, mem: 192 },
  { id: 'c13', name: 'api_gateway.3',   image: 'kong:3.6',             state: 'running', stack: 'api',        node: 'worker-02', uptime: '2d',  cpu: 0.08, mem: 184 },
  { id: 'c14', name: 'api_auth.1',      image: 'pixdock/auth:0.9',     state: 'running', stack: 'api',        node: 'worker-01', uptime: '1d',  cpu: 0.07, mem: 144 },
  { id: 'c15', name: 'api_auth.2',      image: 'pixdock/auth:0.9',     state: 'running', stack: 'api',        node: 'worker-03', uptime: '1d',  cpu: 0.08, mem: 148 },
  { id: 'c16', name: 'data_postgres.1', image: 'postgres:16-alpine',   state: 'running', stack: 'data',       node: 'manager-01',uptime: '47d', cpu: 0.13, mem: 928 },
  { id: 'c17', name: 'data_redis.1',    image: 'redis:7-alpine',       state: 'running', stack: 'data',       node: 'manager-01',uptime: '47d', cpu: 0.04, mem: 112 },
  { id: 'c18', name: 'data_redis.2',    image: 'redis:7-alpine',       state: 'running', stack: 'data',       node: 'worker-02', uptime: '12d', cpu: 0.03, mem: 108 },
  { id: 'c19', name: 'data_redis.3',    image: 'redis:7-alpine',       state: 'running', stack: 'data',       node: 'worker-03', uptime: '12d', cpu: 0.03, mem: 110 },
  { id: 'c20', name: 'mon_prometheus.1',image: 'prom/prometheus:2.51', state: 'running', stack: 'monitoring', node: 'manager-01',uptime: '47d', cpu: 0.06, mem: 412 },
  { id: 'c21', name: 'mon_grafana.1',   image: 'grafana/grafana:10.4', state: 'running', stack: 'monitoring', node: 'manager-01',uptime: '47d', cpu: 0.05, mem: 184 },
  { id: 'c22', name: 'mon_loki.1',      image: 'grafana/loki:2.9',     state: 'running', stack: 'monitoring', node: 'worker-01', uptime: '47d', cpu: 0.04, mem: 168 },
];

const STACKS = ['web', 'api', 'data', 'monitoring'];

const IMAGES = [
  { name: 'nginx:1.27-alpine',     size: 47,  used: 4 },
  { name: 'pixdock/web:1.4.2',     size: 184, used: 6 },
  { name: 'pixdock/auth:0.9',      size: 92,  used: 2 },
  { name: 'kong:3.6',              size: 312, used: 3 },
  { name: 'postgres:16-alpine',    size: 238, used: 1 },
  { name: 'redis:7-alpine',        size: 41,  used: 3 },
  { name: 'prom/prometheus:2.51',  size: 268, used: 1 },
  { name: 'grafana/grafana:10.4',  size: 412, used: 1 },
  { name: 'grafana/loki:2.9',      size: 196, used: 1 },
];

// Sparkline helpers — deterministic pseudo-random sequences
function spark(seed, n = 24, base = 0.5, amp = 0.25) {
  const out = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    out.push(Math.max(0.05, Math.min(0.98, base + (r - 0.5) * amp * 2 + Math.sin(i / 3) * amp * 0.4)));
  }
  return out;
}

const FLEET_STATS = {
  totalNodes: NODES.length,
  readyNodes: NODES.filter(n => n.status === 'ready').length,
  totalServices: SERVICES.length,
  healthyServices: SERVICES.filter(s => s.running >= s.desired).length,
  totalContainers: CONTAINERS.length,
  runningContainers: CONTAINERS.filter(c => c.state === 'running').length,
  totalImages: IMAGES.length,
  totalReplicas: SERVICES.reduce((a, s) => a + s.running, 0),
  desiredReplicas: SERVICES.reduce((a, s) => a + s.desired, 0),
  cpuAvg: NODES.reduce((a, n) => a + n.cpuLoad, 0) / NODES.length,
  memAvg: NODES.reduce((a, n) => a + n.memUsed / n.memGB, 0) / NODES.length,
};

const EVENTS = [
  { t: '14:32:08', lvl: 'INFO',  msg: 'svc web_app scaled 4→6'                },
  { t: '14:31:54', lvl: 'OK',    msg: 'task web_app.5 → running on worker-03' },
  { t: '14:31:52', lvl: 'OK',    msg: 'task web_app.6 → running on worker-03' },
  { t: '14:30:11', lvl: 'INFO',  msg: 'image pulled pixdock/web:1.4.2'        },
  { t: '14:28:03', lvl: 'OK',    msg: 'node edge-01 joined swarm'             },
  { t: '14:22:47', lvl: 'INFO',  msg: 'health check passed: api_auth'         },
  { t: '14:18:16', lvl: 'OK',    msg: 'rolling update completed: web_nginx'   },
  { t: '14:12:09', lvl: 'INFO',  msg: 'cleanup: 3 dangling images pruned'     },
  { t: '14:04:31', lvl: 'OK',    msg: 'task data_redis.2 → running'           },
];

window.PD = { NODES, SERVICES, CONTAINERS, STACKS, IMAGES, FLEET_STATS, EVENTS, spark };
