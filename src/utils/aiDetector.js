import { logger } from './logger.js';

const PANGRAM_API_KEY = process.env.PANGRAM_API_KEY;
const PANGRAM_API_URL = 'https://text.api.pangramlabs.com/v3';

/**
 * Check if text is AI-generated using Pangram API
 * @param {string} text - The text to check
 * @returns {Promise<{isAI: boolean, score: number, details: object, headline: string, error: string|null}>}
 */
export async function checkAIContent(text) {
    if (!PANGRAM_API_KEY) {
        logger.warn('[AI Detector] PANGRAM_API_KEY not configured in environment variables');
        return { 
            isAI: false, 
            score: 0, 
            details: null, 
            headline: 'API Key Missing',
            error: 'API key not configured. Please set PANGRAM_API_KEY in environment variables.' 
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
                'x-api-key': PANGRAM_API_KEY,
            },
            body: JSON.stringify({ text: text }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[AI Detector] API error ${response.status}:`, errorText);
            return { 
                isAI: false, 
                score: 0, 
                details: null, 
                headline: `API Error (${response.status})`,
                error: `API error: ${response.status}` 
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