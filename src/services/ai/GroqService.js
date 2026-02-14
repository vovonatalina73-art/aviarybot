import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

let groq = null;

if (process.env.GROQ_API_KEY) {
    groq = new Groq({
        apiKey: process.env.GROQ_API_KEY
    });
    console.log('[AI] Groq initialized');
} else {
    console.warn('[AI] WARNING: GROQ_API_KEY not found in .env. AI features will be disabled.');
}

export const getAiResponse = async (userId, message, context = []) => {
    if (!groq) {
        return "⚠️ Erro: IA não configurada. chame um atendente.";
    }

    try {
        console.log(`[AI] Generating response for ${userId}...`);

        // System prompt to define persona
        const systemMessage = {
            role: "system",
            content: `Você é a "Celina", a assistente virtual inteligente e amigável da plataforma.
            Seu objetivo é ajudar os usuários com dúvidas sobre produtos, suporte e informações gerais.
            
            Diretrizes:
            1. Seja educada, empática e use emojis moderadamente.
            2. Responda de forma concisa e direta (WhatsApp).
            3. Se não souber a resposta, sugira falar com um humano (digite 'atendente').
            4. Nunca invente informações sensíveis (preços, datas) se não estiverem no contexto.
            5. O formato da moeda é R$ (Reais).`
        };

        // Construct message history
        // Context should be an array of { role: 'user'|'assistant', content: '...' }
        // We limit context to last 6 messages to save tokens/memory
        const recentContext = context.slice(-6);

        const messages = [
            systemMessage,
            ...recentContext,
            { role: "user", content: message }
        ];

        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama3-8b-8192", // Fast and efficient model
            temperature: 0.7,
            max_tokens: 300,
            top_p: 1,
            stream: false,
            stop: null
        });

        const responseContent = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua mensagem agora.";
        return responseContent;

    } catch (error) {
        console.error('[AI] Error generating response:', error);
        return "Desculpe, estou com uma instabilidade momentânea. Tente novamente em alguns instantes.";
    }
};
