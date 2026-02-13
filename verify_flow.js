import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLOW_FILE = path.join(__dirname, 'flow.json');

try {
    if (!fs.existsSync(FLOW_FILE)) {
        console.error('flow.json not found!');
        process.exit(1);
    }

    const data = fs.readFileSync(FLOW_FILE, 'utf8');
    const flow = JSON.parse(data);

    console.log('Flow loaded. Nodes:', flow.nodes.length, 'Edges:', flow.edges.length);

    const nodeIds = new Set(flow.nodes.map(n => n.id));
    const errors = [];

    // Check Edges
    flow.edges.forEach(edge => {
        if (!nodeIds.has(edge.source)) {
            errors.push(`Edge ${edge.id} references missing source node: ${edge.source}`);
        }
        if (!nodeIds.has(edge.target)) {
            errors.push(`Edge ${edge.id} references missing target node: ${edge.target}`);
        }
    });

    // Check Nodes
    flow.nodes.forEach(node => {
        // Check for delay issues
        if (node.data && node.data.delay) {
            if (typeof node.data.delay !== 'number') {
                errors.push(`Node ${node.id} has invalid delay type: ${typeof node.data.delay} (Value: ${node.data.delay})`);
            }
        }

        // Check for empty labels in content nodes
        if (node.type === 'content' && (!node.data.label || node.data.label.trim() === '')) {
            errors.push(`Node ${node.id} (content) has empty label`);
        }
    });

    if (errors.length > 0) {
        console.error('Found errors in flow.json:');
        errors.forEach(e => console.error('- ' + e));
    } else {
        console.log('flow.json looks good!');
    }

} catch (err) {
    console.error('Error processing flow.json:', err);
}
