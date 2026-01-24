import express from 'express';
import modelsRouter from './models';
import chatRouter from './chat';
import accountsRouter from './accounts';
import providersRouter from './providers';
import configRouter from './config';
import indexingRouter from './indexing';
import modelSequencesRouter from './model-sequences';
import claudeApiRouter from '../claude-api';

const router = express.Router();

router.use('/models', modelsRouter);
router.use('/chat', chatRouter);
router.use('/', claudeApiRouter); // Register Claude API at root to support /v1/messages
router.use('/accounts', accountsRouter);
router.use('/providers', providersRouter);
router.use('/config', configRouter);
router.use('/indexing', indexingRouter);
router.use('/model-sequences', modelSequencesRouter);

export default router;
