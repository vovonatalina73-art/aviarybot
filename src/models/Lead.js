import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true },
    phone: { type: String },
    status: { type: String, default: 'in_progress' }, // in_progress, completed
    firstInteraction: { type: Date, default: Date.now },
    lastInteraction: { type: Date, default: Date.now },
    lastMessage: { type: String },
    // Add other fields from your JSON if they exist (name, email, etc.)
}, { timestamps: true });

export const Lead = mongoose.model('Lead', LeadSchema);
