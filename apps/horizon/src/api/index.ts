import express from 'express';

import MessageResponse from '../interfaces/MessageResponse';
import emojis from './emojis';
import indexer from './indexer/api';


const router = express.Router();

router.get<{}, MessageResponse>('/', (req, res) => {
  res.json({
    message: 'API - 👋🌎🌍🌏',
  });
});

router.use('/emojis', emojis);
router.use('/indexer', indexer);

export default router;
