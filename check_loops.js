import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLOW_FILE = path.join(__dirname, 'flow.json');

try {
    const data = fs.readFileSync(FLOW_FILE, 'utf8');
    const flow = JSON.parse(data);
    const nodes = flow.nodes;
    const edges = flow.edges;

    console.log(`Loaded ${nodes.length} nodes and ${edges.length} edges.`);

    const autoAdvanceTypes = ['start', 'content', 'delay', 'image', 'video', 'audio'];
    const blockingTypes = ['menu'];

    // Build adjacency list for auto-advancing nodes only
    const adj = {};
    nodes.forEach(n => {
        if (autoAdvanceTypes.includes(n.type)) {
            adj[n.id] = [];
        }
    });

    edges.forEach(e => {
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);

        if (sourceNode && targetNode && autoAdvanceTypes.includes(sourceNode.type)) {
            // We only care if the TARGET is also auto-advancing (or if it loops back to an auto-advancing chain)
            // Actually, if the source is auto-advancing, it WILL go to target.
            // If target is blocking, the chain stops.
            // If target is auto-advancing, the chain continues.
            // So we want to find cycles in the subgraph of auto-advancing nodes.
            // But wait, if A (auto) -> B (menu) -> A (auto), that's NOT an infinite loop because B blocks.
            // So we only include edges where BOTH source and target are auto-advancing?
            // No, if A (auto) -> B (auto), that's a link.
            // If A (auto) -> C (menu), that's a dead end for the "auto-advance loop" search.

            if (autoAdvanceTypes.includes(targetNode.type)) {
                if (!adj[e.source]) adj[e.source] = [];
                adj[e.source].push(e.target);
            }
        }
    });

    // DFS to find cycles
    const visited = new Set();
    const recursionStack = new Set();
    let cycleFound = false;

    function detectCycle(nodeId, path = []) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);

        const neighbors = adj[nodeId] || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (detectCycle(neighbor, path)) return true;
            } else if (recursionStack.has(neighbor)) {
                console.log('CYCLE DETECTED!');
                console.log('Path:', path.concat(neighbor).join(' -> '));

                // Print node details
                path.concat(neighbor).forEach(id => {
                    const n = nodes.find(node => node.id === id);
                    console.log(`Node ${id}: ${n.type} - ${n.data.label || ''}`);
                });
                cycleFound = true;
                return true;
            }
        }

        recursionStack.delete(nodeId);
        path.pop();
        return false;
    }

    Object.keys(adj).forEach(nodeId => {
        if (!visited.has(nodeId)) {
            detectCycle(nodeId);
        }
    });

    if (!cycleFound) {
        console.log('No infinite auto-advance loops found.');
    }

} catch (err) {
    console.error('Error:', err);
}
