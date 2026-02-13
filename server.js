import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mongoose from 'mongoose';
import { MongoStore } from 'wwebjs-mongo';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Import Models
import { Lead } from './src/models/Lead.js';
import { Flow } from './src/models/Flow.js';
import { Financial } from './src/models/Financial.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client, RemoteAuth, MessageMedia, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("CRITICAL: MONGO_URI is not defined in environment variables.");
    // We do not crash, but DB functions will fail.
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB Connection Error:', err));
}

ffmpeg.setFfmpegPath(ffmpegPath);

// --- LOGGING SETUP ---
const logStream = fs.createWriteStream(path.join(__dirname, 'debug.log'), { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;

function fileLog(...args) {
    const timestamp = new Date().toISOString();
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logStream.write(`[${timestamp}] [INFO] ${msg}\n`);
    originalLog.apply(console, [`[${timestamp}]`, ...args]);
}

function fileError(...args) {
    const timestamp = new Date().toISOString();
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logStream.write(`[${timestamp}] [ERROR] ${msg}\n`);
    originalError.apply(console, [`[${timestamp}]`, ...args]);
}

console.log = fileLog;
console.error = fileError;
// ---------------------

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let currentFlow = null;
// leads are now in DB
// financials are now in DB

// Load Flow from DB
async function loadFlow() {
    try {
        const flowDoc = await Flow.findOne({ active: true }).sort({ updatedAt: -1 });
        if (flowDoc) {
            currentFlow = flowDoc; // Keep structure as is
            console.log('Flow loaded from MongoDB');
        } else {
            console.log('No active flow found in MongoDB');
        }
    } catch (err) {
        console.error('Error loading flow from DB:', err);
    }
}
loadFlow();

// Load Financials from DB (helper)
async function getFinancials() {
    try {
        let fin = await Financial.findOne();
        if (!fin) {
            fin = await Financial.create({ adSpend: 0, totalSales: 0, salesCount: 0 });
        }
        return fin;
    } catch (err) {
        console.error('Error fetching financials:', err);
        return { adSpend: 0, totalSales: 0, salesCount: 0 };
    }
}


const store = new MongoStore({ mongoose: mongoose });
const client = new Client({
    authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Important for some cloud environments
            '--disable-gpu'
        ],
        timeout: 60000
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected');
    if (client.info) {
        socket.emit('ready');
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
    io.emit('qr', qr);
});

client.on('ready', () => {
    console.log('Client is ready!');
    io.emit('ready');
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
    io.emit('authenticated');
});

const sessions = {};
const processedMessages = new Set();
const sessionLocks = new Set();

client.on('message', async msg => {
    console.log(`[DEBUG] Raw message receive. From: ${msg.from}, Type: ${msg.type}, Body: ${msg.body.substring(0, 50)}`);
    if (!currentFlow) {
        console.log('No flow loaded. Please save a flow in the dashboard.');
        return;
    }

    // --- DEDUPLICATION LOGIC ---
    if (processedMessages.has(msg.id.id)) {
        console.log(`Ignoring duplicate message: ${msg.id.id}`);
        return;
    }
    processedMessages.add(msg.id.id);
    setTimeout(() => processedMessages.delete(msg.id.id), 60000); // Clear after 60s
    // ---------------------------

    const chatId = msg.from;
    console.log(`Received message from ${chatId}: type=${msg.type}, body=${msg.body}`);

    const ignoredTypes = ['e2e_notification', 'call_log', 'protocol', 'ciphertext'];
    if (ignoredTypes.includes(msg.type)) {
        console.log(`Ignoring system message type: ${msg.type}`);
        return;
    }

    // --- LEADS & BLOCKING LOGIC ---
    // --- LEADS & BLOCKING LOGIC ---
    const now = Date.now();
    let lead = await Lead.findOne({ chatId: chatId });

    if (lead) {
        // 1. Check if completed
        if (lead.status === 'completed') {
            console.log(`Ignoring message from ${chatId} (Status: Completed)`);
            return;
        }

        // 2. Check Cooldown (4 Hours)
        const COOLDOWN_HOURS = 4;
        const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

        if (!sessions[chatId] && (now - new Date(lead.lastInteraction).getTime() < COOLDOWN_MS)) {
            console.log(`(Cooldown active) Message from ${chatId} ignored. Wait ${COOLDOWN_HOURS}h.`);
            return;
        }
        // Update existing lead
        lead.lastInteraction = now;
        lead.lastMessage = msg.body;
        if (lead.status !== 'completed') {
            lead.status = 'in_progress';
        }
    } else {
        // New Lead
        lead = new Lead({
            chatId,
            phone: chatId.replace('@c.us', ''),
            status: 'in_progress',
            firstInteraction: now,
            lastInteraction: now,
            lastMessage: msg.body
        });
    }
    await lead.save();
    // -----------------------------

    if (!sessions[chatId]) {
        // --- SESSION LOCKING ---
        if (sessionLocks.has(chatId)) {
            console.log(`Ignoring message from ${chatId} (Session start locked - race condition prevention)`);
            return;
        }
        sessionLocks.add(chatId);
        setTimeout(() => sessionLocks.delete(chatId), 2000); // Release lock after 2s
        // -----------------------

        const startNode = currentFlow.nodes.find(n => n.type === 'start');
        if (startNode) {
            console.log(`Starting flow for ${chatId}`);
            sessions[chatId] = { currentNodeId: startNode.id };
            await processNode(chatId, startNode.id);
        }
        return;
    }

    const session = sessions[chatId];
    const currentNode = currentFlow.nodes.find(n => n.id === session.currentNodeId);

    if (!currentNode) {
        console.log(`Node ${session.currentNodeId} not found (flow changed?). Resetting session for ${chatId}.`);
        delete sessions[chatId];

        // Restart flow immediately
        const startNode = currentFlow.nodes.find(n => n.type === 'start');
        if (startNode) {
            console.log(`Restarting flow for ${chatId}`);
            sessions[chatId] = { currentNodeId: startNode.id };
            await processNode(chatId, startNode.id);
        }
        return;
    }

    if (currentNode) {
        const edges = currentFlow.edges.filter(e => e.source === currentNode.id);

        if (edges.length > 0) {
            if (currentNode.type === 'menu') {
                let selectedOptionId = null;

                // Handle Poll Response
                if (msg.type === 'poll_response') {
                    console.log('Received poll_response via message event');
                    if (msg.selectedOptions && msg.selectedOptions.length > 0) {
                        const vote = msg.selectedOptions[0].name;
                        console.log('Poll Vote:', vote);
                        const options = currentNode.data.options || [];
                        const matchedOption = options.find(opt => opt.label.toLowerCase() === vote.toLowerCase());
                        if (matchedOption) selectedOptionId = matchedOption.id;
                    }
                }
                // Handle Text Response
                else {
                    const options = currentNode.data.options || [];
                    const cleanBody = msg.body.trim().toLowerCase();

                    console.log(`Checking text match for: '${cleanBody}' against options:`, options.map(o => o.label));

                    // 1. Exact match
                    let matchedOption = options.find(opt => opt.label.toLowerCase() === cleanBody);

                    // 2. Partial match
                    if (!matchedOption) {
                        matchedOption = options.find(opt => {
                            const cleanLabel = opt.label.toLowerCase().replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim();
                            return cleanLabel.includes(cleanBody) || cleanBody.includes(cleanLabel);
                        });
                    }

                    // 3. Number match
                    if (!matchedOption) {
                        const index = parseInt(cleanBody) - 1;
                        if (!isNaN(index) && options[index]) {
                            matchedOption = options[index];
                        }
                    }

                    if (matchedOption) {
                        console.log(`Matched option: ${matchedOption.label}`);
                        selectedOptionId = matchedOption.id;
                    } else {
                        console.log('No match found.');
                    }
                }

                if (selectedOptionId) {
                    const matchingEdge = edges.find(e => e.sourceHandle === selectedOptionId);
                    if (matchingEdge) {
                        const nextNodeId = matchingEdge.target;
                        sessions[chatId].currentNodeId = nextNodeId;
                        await processNode(chatId, nextNodeId);
                        return;
                    }
                }

                if (msg.type !== 'poll_response') {
                    await simulateTyping(chatId, 1000);
                    await client.sendMessage(chatId, "Opção inválida. Por favor, tente novamente.", { sendSeen: false });
                    await processNode(chatId, currentNode.id);
                }

            } else {
                // If NOT a menu, ignore the message.
                // The bot is likely processing an auto-advance node (content, delay, media).
                console.log(`Ignoring message from ${chatId} because bot is in state: ${currentNode.type}`);
                return;
            }
        } else {
            // No edges from this node? End of flow?
            delete sessions[chatId];
        }
    }
});

// Handle Poll Votes
client.on('vote_update', async (vote) => {
    console.log('Received vote_update:', vote);
    const chatId = vote.voter;

    if (!sessions[chatId] || !currentFlow) return;

    const session = sessions[chatId];
    const currentNode = currentFlow.nodes.find(n => n.id === session.currentNodeId);

    if (currentNode && currentNode.type === 'menu') {
        const edges = currentFlow.edges.filter(e => e.source === currentNode.id);
        const options = currentNode.data.options || [];

        let selectedOptionId = null;

        if (vote.selectedOptions && vote.selectedOptions.length > 0) {
            const voteName = vote.selectedOptions[0].name;
            console.log(`Vote from ${chatId}: ${voteName}`);

            const matchedOption = options.find(opt => opt.label.toLowerCase() === voteName.toLowerCase());
            if (matchedOption) {
                selectedOptionId = matchedOption.id;
            }
        }

        if (selectedOptionId) {
            const matchingEdge = edges.find(e => e.sourceHandle === selectedOptionId);
            if (matchingEdge) {
                console.log(`Advancing flow to node ${matchingEdge.target}`);
                const nextNodeId = matchingEdge.target;
                sessions[chatId].currentNodeId = nextNodeId;
                await processNode(chatId, nextNodeId);
            }
        } else {
            console.log('Vote did not match any option or was a deselect');
        }
    }
});

// Simulation Helpers
async function simulateTyping(chatId, duration) {
    const chat = await client.getChatById(chatId);
    await chat.sendStateTyping();
    await new Promise(resolve => setTimeout(resolve, duration));
    await chat.clearState();
}

async function simulateRecording(chatId, duration) {
    const chat = await client.getChatById(chatId);
    await chat.sendStateRecording();
    await new Promise(resolve => setTimeout(resolve, duration));
    await chat.clearState();
}

async function convertAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('error', (err) => {
                console.error('FFmpeg conversion error:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('FFmpeg conversion finished');
                if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                    resolve(outputPath);
                } else {
                    reject(new Error('Converted file is empty or missing'));
                }
            })
            .save(outputPath);
    });
}

async function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-vcodec libx264',
                '-profile:v baseline',
                '-level 3.0',
                '-vf scale=-2:720', // Resize to 720p height, auto width
                '-crf 28',
                '-preset fast',
                '-acodec aac',
                '-b:a 64k',
                '-movflags +faststart',
                '-pix_fmt yuv420p'
            ])
            .on('error', (err) => {
                console.error('FFmpeg video compression error:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('FFmpeg video compression finished');
                resolve(outputPath);
            })
            .save(outputPath);
    });
}

async function safeSendMessage(chatId, media, options = {}, retries = 2) {
    try {
        return await client.sendMessage(chatId, media, { ...options, sendSeen: false });
    } catch (err) {
        if (retries > 0) {
            console.log(`Send failed, retrying... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, 2000));
            return await safeSendMessage(chatId, media, options, retries - 1);
        }
        throw err;
    }
}

async function processMediaNode(chatId, node) {
    let tempFilePath = null;
    let compressedFilePath = null;

    try {
        const mimetype = node.data.media.split(';')[0].split(':')[1];
        let extension = mimetype.split('/')[1];
        if (mimetype === 'application/pdf') extension = 'pdf';

        // Fix for some common extensions if needed
        if (mimetype === 'image/jpeg') extension = 'jpg';
        if (mimetype === 'image/png') extension = 'png';
        if (mimetype === 'video/mp4') extension = 'mp4';

        const tempFileName = `temp_media_${Date.now()}.${extension}`;
        tempFilePath = path.join(__dirname, tempFileName);
        const base64Data = node.data.media.split(',')[1].replace(/\s/g, '');

        fs.writeFileSync(tempFilePath, base64Data, 'base64');

        let finalPath = tempFilePath;
        const stats = fs.statSync(tempFilePath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        if (fileSizeInMB > 16 && (extension === 'mp4' || mimetype.startsWith('video/'))) {
            console.log(`Video is too large (${fileSizeInMB.toFixed(2)}MB). Compressing...`);
            const compressedFileName = `compressed_video_${Date.now()}.mp4`;
            compressedFilePath = path.join(__dirname, compressedFileName);

            try {
                await compressVideo(tempFilePath, compressedFilePath);
                finalPath = compressedFilePath;
                const newStats = fs.statSync(finalPath);
                console.log(`Compression complete. New size: ${(newStats.size / 1024 / 1024).toFixed(2)}MB`);
            } catch (compErr) {
                console.error('Compression failed, trying original file:', compErr);
                // Fallback to original file
            }
        }

        const media = MessageMedia.fromFilePath(finalPath);
        if (extension === 'mp4') {
            media.mimetype = 'video/mp4';
        }
        if (node.data.fileName) {
            media.filename = node.data.fileName;
        }

        console.log(`Sending media: ${media.mimetype}, Size: ${media.data.length} chars`);

        let caption = node.data.label;
        if (caption === `Enviar ${extension.toUpperCase()}` || caption === 'PDF Node' || caption === 'Image Node' || caption === 'Video Node') {
            caption = undefined;
        }

        if (extension === 'mp4' || mimetype.startsWith('video/')) {
            caption = "Clique para assistir";
        }

        try {
            await safeSendMessage(chatId, media, {
                caption: caption
            });
        } catch (sendError) {
            console.error('Primary send failed after retries:', sendError);
            if (media.mimetype.startsWith('video/')) {
                console.log('Retrying as document (last resort)...');
                await client.sendMessage(chatId, media, {
                    sendMediaAsDocument: true,
                    caption: caption,
                    sendSeen: false
                });
            } else {
                throw sendError;
            }
        }

    } catch (error) {
        console.error(`Error sending media (${node.type}):`, error);
        await client.sendMessage(chatId, "⚠️ Erro ao enviar mídia.", { sendSeen: false });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        if (compressedFilePath && fs.existsSync(compressedFilePath)) {
            fs.unlinkSync(compressedFilePath);
        }
    }
}

async function processNode(chatId, nodeId) {
    const node = currentFlow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    console.log(`Processing node ${node.type} for ${chatId}`);

    try {
        switch (node.type) {
            case 'start':
                await autoAdvance(chatId, nodeId);
                break;

            case 'content':
                const text = node.data.label || '...';
                const typingTime = Math.min(Math.max(text.length * 50, 1000), 5000);

                await simulateTyping(chatId, typingTime);
                await client.sendMessage(chatId, text, { sendSeen: false });
                await autoAdvance(chatId, nodeId);
                break;

            case 'menu':
                const options = node.data.options || [];
                const usePoll = node.data.usePoll === true;

                console.log(`Processing Menu Node: usePoll=${usePoll}, options=${options.length}`);
                await simulateTyping(chatId, 3000);

                if (usePoll && options.length >= 2) {
                    if (!Poll) {
                        throw new Error('Poll class not available');
                    }

                    try {
                        const poll = new Poll('Escolha uma opção:', options.map(opt => opt.label));
                        const sendPromise = client.sendMessage(chatId, poll, { sendSeen: false });
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Poll send timeout')), 10000));
                        await Promise.race([sendPromise, timeoutPromise]);
                    } catch (pollError) {
                        console.error('Error sending poll, falling back to text:', pollError);
                        let message = "Escolha uma opção:\n\n";
                        options.forEach((opt, i) => {
                            message += `${i + 1}. ${opt.label}\n`;
                        });
                        await client.sendMessage(chatId, message, { sendSeen: false });
                    }
                } else {
                    let message = "Escolha uma opção:\n\n";
                    options.forEach((opt, i) => {
                        message += `${i + 1}. ${opt.label}\n`;
                    });
                    await client.sendMessage(chatId, message, { sendSeen: false });
                }
                break;

            case 'delay':
                const ms = (node.data.delay || 5) * 1000;
                await new Promise(resolve => setTimeout(resolve, ms));
                await autoAdvance(chatId, nodeId);
                break;

            case 'audio':
                if (node.data.media) {
                    await simulateRecording(chatId, 3000);
                    let tempFilePath = null;
                    let convertedFilePath = null;

                    try {
                        const mimetype = node.data.media.split(';')[0].split(':')[1];
                        console.log(`Processing audio node. Mimetype: ${mimetype}`);

                        let extension = 'ogg';
                        if (mimetype === 'audio/mpeg') extension = 'mp3';
                        else if (mimetype === 'audio/mp4') extension = 'm4a';
                        else if (mimetype === 'audio/wav') extension = 'wav';

                        const tempFileName = `temp_audio_${Date.now()}.${extension}`;
                        tempFilePath = path.join(__dirname, tempFileName);
                        const base64Data = node.data.media.split(',')[1].replace(/\s/g, '');
                        fs.writeFileSync(tempFilePath, base64Data, 'base64');
                        console.log(`Saved temp audio: ${tempFilePath} (${fs.statSync(tempFilePath).size} bytes)`);

                        let finalPath = tempFilePath;
                        // Always convert to OGG Opus for WhatsApp Voice Messages
                        if (extension !== 'ogg' || true) { // Force conversion to ensure codec compatibility
                            const convertedFileName = `converted_audio_${Date.now()}.ogg`;
                            convertedFilePath = path.join(__dirname, convertedFileName);
                            console.log(`Converting to OGG Opus: ${convertedFilePath}`);
                            await convertAudio(tempFilePath, convertedFilePath);
                            finalPath = convertedFilePath;
                        }

                        if (!fs.existsSync(finalPath) || fs.statSync(finalPath).size === 0) {
                            throw new Error('Final audio file is empty or missing');
                        }

                        const media = MessageMedia.fromFilePath(finalPath);
                        console.log(`Sending audio media. mimetype: ${media.mimetype}, size: ${media.data ? media.data.length : 'null'}`);

                        // Ensure mimetype is set correctly for voice
                        media.mimetype = 'audio/ogg; codecs=opus';

                        const sendPromise = client.sendMessage(chatId, media, { sendAudioAsVoice: true, sendSeen: false });
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Audio send timeout')), 20000));
                        await Promise.race([sendPromise, timeoutPromise]);
                        console.log('Audio sent successfully');

                    } catch (audioError) {
                        console.error('Error sending audio (Primary):', audioError);

                        // Fallback: Send as document/normal audio
                        try {
                            const fallbackPath = convertedFilePath || tempFilePath;
                            if (fallbackPath && fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).size > 0) {
                                console.log('Attempting fallback send (Audio as Document)...');
                                const media = MessageMedia.fromFilePath(fallbackPath);
                                await client.sendMessage(chatId, media, { sendAudioAsVoice: false, sendSeen: false });
                                console.log('Fallback audio sent successfully');
                            } else {
                                console.error('No valid file for fallback.');
                                await client.sendMessage(chatId, "⚠️ Erro ao enviar áudio (Arquivo corrompido).", { sendSeen: false });
                            }
                        } catch (fallbackError) {
                            console.error('Final audio send failure:', fallbackError);
                            await client.sendMessage(chatId, "⚠️ Não consegui enviar o áudio. (Erro técnico)", { sendSeen: false });
                        }
                    } finally {
                        if (tempFilePath && fs.existsSync(tempFilePath)) {
                            try { fs.unlinkSync(tempFilePath); } catch (e) { }
                        }
                        if (convertedFilePath && fs.existsSync(convertedFilePath)) {
                            try { fs.unlinkSync(convertedFilePath); } catch (e) { }
                        }
                    }
                }
                await autoAdvance(chatId, nodeId);
                break;

            case 'image':
            case 'video':
            case 'pdf':
                if (node.data.media) {
                    await simulateTyping(chatId, 2000);
                    await processMediaNode(chatId, node);
                }
                await autoAdvance(chatId, nodeId);
                break;
        }
    } catch (error) {
        console.error('Error processing node:', error);
        if (node.type === 'menu') {
            let message = "Escolha uma opção (digite o nome):\n";
            if (node.data.options) {
                node.data.options.forEach((opt) => {
                    message += `- ${opt.label}\n`;
                });
            }
            await client.sendMessage(chatId, message, { sendSeen: false });
        }
    }
}

async function autoAdvance(chatId, nodeId) {
    console.log(`Auto-advancing from node ${nodeId} for ${chatId}`);
    const edges = currentFlow.edges.filter(e => e.source === nodeId);
    if (edges.length > 0) {
        const nextNodeId = edges[0].target;
        sessions[chatId].currentNodeId = nextNodeId;
        await processNode(chatId, nextNodeId);
    } else {
        delete sessions[chatId];
    }
}

app.post('/api/save-flow', async (req, res) => {
    currentFlow = req.body;
    try {
        // Upsert flow
        await Flow.findOneAndUpdate({ active: true }, currentFlow, { upsert: true, new: true });
        console.log('Flow saved to MongoDB');
    } catch (err) {
        console.error('Error saving flow to DB:', err);
    }
    res.json({ success: true, message: 'Flow saved successfully' });
});

app.get('/api/status', (req, res) => {
    res.json({
        ready: !!client.info,
        flowLoaded: !!currentFlow
    });
});

app.get('/api/flow', (req, res) => {
    res.json(currentFlow || null);
});

// Leads API
app.get('/api/leads', async (req, res) => {
    try {
        const leads = await Lead.find();
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

app.post('/api/leads/:chatId/status', async (req, res) => {
    const { chatId } = req.params;
    const { status } = req.body;
    try {
        const lead = await Lead.findOneAndUpdate({ chatId }, { status }, { new: true });
        if (lead) {
            res.json({ success: true, lead });
        } else {
            res.status(404).json({ error: 'Lead not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error updating lead' });
    }
});

// Replaced by new block above

app.post('/api/trigger-flow', async (req, res) => {
    const { chatId } = req.body;
    if (!currentFlow) return res.status(400).json({ error: 'No flow loaded' });
    const startNode = currentFlow.nodes.find(n => n.type === 'start');
    if (!startNode) return res.status(400).json({ error: 'No start node' });

    console.log(`Manually triggering flow for ${chatId}`);
    sessions[chatId] = { currentNodeId: startNode.id };
    await processNode(chatId, startNode.id);
    res.json({ success: true });
});

// Financials API
app.get('/api/financials', async (req, res) => {
    const fin = await getFinancials();
    res.json(fin);
});

app.post('/api/financials', async (req, res) => {
    const { adSpend, totalSales, salesCount } = req.body;
    try {
        const fin = await Financial.findOneAndUpdate({}, {
            adSpend: Number(adSpend) || 0,
            totalSales: Number(totalSales) || 0,
            salesCount: Number(salesCount) || 0
        }, { upsert: true, new: true });
        console.log('Financials updated:', fin);
        res.json({ success: true, data: fin });
    } catch (err) {
        res.status(500).json({ error: 'Error saving financials' });
    }
});

// Ping Endpoint for Keep-Alive
app.get('/api/ping', (req, res) => {
    res.send('Pong');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    client.initialize();

    // KEEP-ALIVE MECHANISM
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log(`Setting up Keep-Alive ping to: ${SELF_URL}/api/ping`);

    // Ping every 14 minutes (14 * 60 * 1000 = 840000 ms)
    setInterval(() => {
        console.log('Sending Keep-Alive Ping...');
        axios.get(`${SELF_URL}/api/ping`)
            .then(() => console.log('Keep-Alive Ping successful'))
            .catch(err => console.error('Keep-Alive Ping failed:', err.message));
    }, 840000); // 14 minutes
});
