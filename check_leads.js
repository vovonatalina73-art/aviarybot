
import fs from 'fs';

try {
    const leads = JSON.parse(fs.readFileSync('leads.json', 'utf8'));

    // Sort by lastInteraction descending
    leads.sort((a, b) => b.lastInteraction - a.lastInteraction);

    console.log(`Total leads: ${leads.length}`);
    console.log('Top 5 most recent interactions:');
    leads.slice(0, 5).forEach(l => {
        const date = new Date(l.lastInteraction).toLocaleString();
        console.log(`- ${l.chatId}: ${date} (Status: ${l.status})`);
    });
} catch (e) {
    console.error("Error reading leads:", e);
}
