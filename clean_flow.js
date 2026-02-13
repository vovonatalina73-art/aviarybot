import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const flowPath = path.join(__dirname, 'flow.json');

try {
    const data = fs.readFileSync(flowPath, 'utf8');
    const flow = JSON.parse(data);

    const nodeIds = new Set(flow.nodes.map(n => n.id));
    const initialEdgeCount = flow.edges.length;

    // Filter edges where both source and target nodes exist
    flow.edges = flow.edges.filter(edge => {
        return nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });

    const finalEdgeCount = flow.edges.length;
    console.log(`Removed ${initialEdgeCount - finalEdgeCount} invalid edges.`);

    fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2));
    console.log('flow.json cleaned successfully.');

} catch (err) {
    console.error('Error cleaning flow.json:', err);
}
