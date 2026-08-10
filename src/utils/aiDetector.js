import { logger } from './logger.js';

const PANGRAM_API_KEY = process.env.PANGRAM_API_KEY;
const PANGRAM_API_URL = 'https://text.api.pangramlabs.com/v3';

export async function checkAIContent(text) {
    // Verificar API Key
    if (!PANGRAM_API_KEY || PANGRAM_API_KEY.length < 10) {
        logger.error('[AI Detector] PANGRAM_API_KEY is missing or invalid');
        return { 
            isAI: false, 
            score: 0, 
            details: null, 
            headline: 'API Key Missing',
            error: 'API key is not configured. Please set PANGRAM_API_KEY in environment variables.' 
        };
    }

    if (!text || text.length < 20) {
        return { 
            isAI: false, 
            score: 0, 
            details: null, 
            headline: 'Text Too Short',
            error: 'Text too short for analysis (minimum 20 characters).' 
        };
    }

    try {
        const response = await fetch(PANGRAM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': PANGRAM_API_KEY.trim(), // ✅ Trim para eliminar espacios
            },
            body: JSON.stringify({ text: text.trim() }),
        });

        // Log para debug
        logger.debug(`[AI Detector] Response status: ${response.status}`);

        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch {
                errorText = 'Could not parse error response';
            }
            
            logger.error(`[AI Detector] API error ${response.status}:`, errorText);
            
            // Mensaje específico para 401
            if (response.status === 401) {
                return { 
                    isAI: false, 
                    score: 0, 
                    details: null, 
                    headline: 'Invalid API Key',
                    error: 'Invalid API Key. Please check your PANGRAM_API_KEY environment variable.' 
                };
            }
            
            return { 
                isAI: false, 
                score: 0, 
                details: null, 
                headline: `API Error (${response.status})`,
                error: `API error: ${response.status} - ${errorText}` 
            };
        }

        const data = await response.json();
        
        const result = {
            isAI: data.headline === 'AI Detected' || data.headline === 'AI Assisted',
            score: data.fraction_ai || 0,
            details: data,
            headline: data.headline || 'Unknown',
            error: null,
        };

        logger.info(`[AI Detector] Result: ${result.headline} (AI Score: ${Math.round(result.score * 100)}%)`);
        return result;

    } catch (error) {
        logger.error('[AI Detector] Error:', error);
        return { 
            isAI: false, 
            score: 0, 
            details: null, 
            headline: 'Error',
            error: error.message 
        };
    }
}