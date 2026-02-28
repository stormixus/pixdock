import { mount } from 'svelte';
import { containers, nodes, dockerMode } from '../src/lib/stores/swarm.ts';
import CanvasRoom from '../src/lib/components/CanvasRoom.svelte';

containers.set([
  {id:'foo', state:'running', project:'test'},
  {id:'bar', state:'running', project:'test'},
  {id:'baz', state:'exited', project:'test'}
]);
nodes.set([
  {hostname: 'worker-1', status: 'ready'},
  {hostname: 'worker-2', status: 'ready'}
]);
dockerMode.set('swarm');

const app = mount(CanvasRoom, {
  target: document.getElementById('app')
});
