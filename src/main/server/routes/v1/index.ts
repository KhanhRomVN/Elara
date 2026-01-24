import express from 'express';
import modelsRouter from './models';
import chatRouter from './chat';
import accountsRouter from './accounts';
import providersRouter from './providers';
import configRouter from './config';
import indexingRouter from './indexing';

const router = express.Router();

router.use('/models', modelsRouter);
router.use('/chat', chatRouter);
router.use('/accounts', accountsRouter);
router.use('/providers', providersRouter);
router.use('/config', configRouter);
router.use('/indexing', indexingRouter);

export default router;
