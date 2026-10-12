import 'dotenv/config';
import { Router } from 'express';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { checkRateLimit } from './ratelimit.ts';
import { validateChatRequest } from './validate.ts';
import { runAgent } from './agent.ts';
import { createGeminiClient } from './llm.ts';
import { TOOL_REGISTRY } from './tools/index.ts';

export const assistantRouter = Router();

const handleChat = async (req: AuthRequest, res: any) => {
  try {
    const uid = req.user?.uid || 'guest';
    const authenticated = req.user?.authenticated ?? false;

    // Rate limiting check (sliding window per user)
    const rateCheck = checkRateLimit(uid);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      return res.status(429).json({
        error: 'rate_limited',
        outcome: 'unavailable',
        text: `You have made too many requests. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      });
    }

    // Hand-written request validation
    const validation = validateChatRequest(req.body);
    if (!validation.valid || !validation.messages || !validation.clientDate) {
      return res.status(400).json({ error: validation.error || 'Invalid request body.' });
    }

    const allowGuestWrites = process.env.ASSISTANT_ALLOW_GUEST_WRITES === 'true';

    const result = await runAgent({
      messages: validation.messages,
      clientDate: validation.clientDate,
      context: {
        uid,
        authenticated,
        clientDate: validation.clientDate,
        allowGuestWrites,
      },
      llm: createGeminiClient(),
      tools: TOOL_REGISTRY,
    });

    return res.json(result);
  } catch (error: any) {
    console.error('[Assistant Route] Error:', error?.name || 'Error');
    return res.status(200).json({
      id: 'error',
      text: 'Sorry, the assistant encountered an unexpected error. Please try again later.',
      blocks: [],
      outcome: 'unavailable',
    });
  }
};

assistantRouter.post('/chat', requireAuth, handleChat);
assistantRouter.post('/', requireAuth, handleChat);
