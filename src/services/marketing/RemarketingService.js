import cron from 'node-cron';
import { Lead } from '../../models/Lead.js';

/**
 * Initializes the Remarketing Service.
 * @param {import('whatsapp-web.js').Client} client - The WhatsApp Client instance.
 */
export const initRemarketing = (client) => {
    console.log('[REMARKETING] Service initialized. Schedule: Every hour.');

    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('[REMARKETING] Running hourly check...');
        const now = new Date();

        // Time thresholds
        const INACTIVE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours
        const MAX_WINDOW = 24 * 60 * 60 * 1000; // 24 hours (don't bug people from last week)

        try {
            // Find leads that are:
            // 1. In progress (not completed, not new)
            // 2. Silent for > 2 hours
            // 3. Haven't been silent for > 24 hours (too old)
            // 4. Haven't received remarketing yet (we need to track this, maybe adapt Logic)

            // Since we don't have a 'remarketingSent' flag in Schema yet, 
            // valid leads are those in 'in_progress' with lastInteraction older than threshold.
            // To avoid spamming, we MUST update their status or a flag after sending.

            const leadsToNudge = await Lead.find({
                status: 'in_progress',
                lastInteraction: {
                    $lte: new Date(now.getTime() - INACTIVE_THRESHOLD),
                    $gte: new Date(now.getTime() - MAX_WINDOW)
                }
            });

            console.log(`[REMARKETING] Found ${leadsToNudge.length} leads to nudge.`);

            for (const lead of leadsToNudge) {
                // Double check to be safe
                if (!lead.chatId) continue;

                console.log(`[REMARKETING] Sending nudge to ${lead.chatId}`);

                // Message text - could be dynamic or from a template
                const nudgeMessage = "Olá! 👋 Notei que você não concluiu seu atendimento. Ficou com alguma dúvida? Posso te ajudar em algo mais?";

                await client.sendMessage(lead.chatId, nudgeMessage);

                // Update status to prevent re-sending every hour
                // We'll Create a new status 'remarketing_sent' or just update lastInteraction?
                // Creating a specific status is safer.
                lead.status = 'remarketed';
                // OR update lastInteraction so they fall out of the query window for a while? 
                // Updating status is better for analytics.
                lead.lastInteraction = new Date(); // Reset timer effectively

                await lead.save();
            }

        } catch (error) {
            console.error('[REMARKETING] Error during job execution:', error);
        }
    });
};
