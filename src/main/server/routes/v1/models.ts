import express from 'express';

const router = express.Router();

// List static models (Legacy/Fallback)
router.get('/', (_req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'deepseek-chat', object: 'model', created: 1677610602, owned_by: 'deepseek' },
      { id: 'deepseek-reasoner', object: 'model', created: 1677610602, owned_by: 'deepseek' },
      {
        id: 'claude-3-opus-20240229',
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
      },
      {
        id: 'claude-3-sonnet-20240229',
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
      },
      {
        id: 'claude-3-haiku-20240307',
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
      },
      // Mistral
      { id: 'mistral-large-latest', object: 'model', created: 1677610602, owned_by: 'mistral' },
      { id: 'mistral-medium-latest', object: 'model', created: 1677610602, owned_by: 'mistral' },
      // Kimi
      { id: 'moonshot-v1-8k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      { id: 'moonshot-v1-32k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      { id: 'moonshot-v1-128k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      // Qwen
      { id: 'qwen-max', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen-plus', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen-turbo', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen-long', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2.5-72b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2.5-32b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2.5-14b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2.5-7b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2.5-math-72b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2-72b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen2-57b-a14b-instruct', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen3-max-2025-09-23', object: 'model', created: 1677610602, owned_by: 'qwen' },
      // Cohere
      { id: 'command-r7b-12-2024', object: 'model', created: 1677610602, owned_by: 'cohere' },
      // Groq
      { id: 'llama3-70b-8192', object: 'model', created: 1677610602, owned_by: 'groq' },
      { id: 'llama3-8b-8192', object: 'model', created: 1677610602, owned_by: 'groq' },
      { id: 'mixtral-8x7b-32768', object: 'model', created: 1677610602, owned_by: 'groq' },
      { id: 'gemma-7b-it', object: 'model', created: 1677610602, owned_by: 'groq' },
      // Gemini
      { id: 'gemini-pro', object: 'model', created: 1677610602, owned_by: 'google' },
      { id: 'gemini-ultra', object: 'model', created: 1677610602, owned_by: 'google' },
    ],
  });
});

export default router;
