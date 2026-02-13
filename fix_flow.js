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

    console.log('Original Flow: Nodes:', flow.nodes.length, 'Edges:', flow.edges.length);

    const nodeIds = new Set(flow.nodes.map(n => n.id));

    // 1. Filter broken edges
    const validEdges = flow.edges.filter(edge => {
        const sourceExists = nodeIds.has(edge.source);
        const targetExists = nodeIds.has(edge.target);
        if (!sourceExists || !targetExists) {
            console.log(`Removing broken edge: ${edge.id} (Source: ${edge.source}, Target: ${edge.target})`);
            return false;
        }
        return true;
    });

    // 2. Fix Node Data
    const fixedNodes = flow.nodes.map(node => {
        const newNode = { ...node };
        if (newNode.data) {
            // Fix Delay
            if (newNode.data.delay !== undefined) {
                const originalDelay = newNode.data.delay;
                let newDelay = 2; // Default 2 seconds

                if (typeof originalDelay === 'number') {
                    newDelay = originalDelay;
                } else if (typeof originalDelay === 'string') {
                    const parsed = parseFloat(originalDelay);
                    if (!isNaN(parsed)) {
                        newDelay = parsed;
                    } else {
                        // If it's text (e.g. "Hello..."), it was likely a bug. Reset to default.
                        console.log(`Node ${node.id}: Resetting invalid delay "${originalDelay.substring(0, 20)}..." to 2`);
                        newDelay = 2;
                    }
                }
                newNode.data.delay = newDelay;
            }
        }
        return newNode;
    });

    const newFlow = {
        ...flow,
        nodes: fixedNodes,
        edges: validEdges
    };

    fs.writeFileSync(FLOW_FILE, JSON.stringify(newFlow, null, 2));
    console.log('Flow fixed and saved. New Nodes:', newFlow.nodes.length, 'New Edges:', newFlow.edges.length);

} catch (err) {
    console.error('Error fixing flow.json:', err);
}
