import express from 'express';
import modelsRouter from './models';
import chatRouter from './chat';
import claudeRouter from './providers/claude';
import deepseekRouter from './providers/deepseek';
import huggingChatRouter from './providers/huggingchat';
import mistralRouter from './providers/mistral';
import qwenRouter from './providers/qwen';
import perplexityRouter from './providers/perplexity';
import kimiRouter from './providers/kimi';
import cohereRouter from './providers/cohere';
import groqRouter from './providers/groq';
import antigravityRouter from './providers/antigravity';
import geminiRouter from './providers/gemini';
import lmArenaRouter from './providers/lmarena';

const router = express.Router();

router.use('/models', modelsRouter);
router.use('/chat', chatRouter);

// Provider specific routes
router.use('/claude', claudeRouter);
router.use('/deepseek', deepseekRouter);
router.use('/huggingchat', huggingChatRouter);
router.use('/mistral', mistralRouter);
router.use('/qwen', qwenRouter);
router.use('/perplexity', perplexityRouter);
router.use('/kimi', kimiRouter);
router.use('/cohere', cohereRouter);
router.use('/groq', groqRouter);
router.use('/antigravity', antigravityRouter);
router.use('/gemini', geminiRouter);
router.use('/lmarena', lmArenaRouter);

export default router;
