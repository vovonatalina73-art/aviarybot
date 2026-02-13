import mongoose from 'mongoose';

const FlowSchema = new mongoose.Schema({
    nodes: [{ type: mongoose.Schema.Types.Mixed }], // Storing nodes as mixed because structure varies
    edges: [{ type: mongoose.Schema.Types.Mixed }],
    viewport: { type: mongoose.Schema.Types.Mixed },
    active: { type: Boolean, default: true } // To easily find the current flow
}, { timestamps: true });

export const Flow = mongoose.model('Flow', FlowSchema);
