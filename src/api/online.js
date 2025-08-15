import Router from 'koa-router';
import online from '../client/online.js';
import { findTrackById, updateTrack } from '../client/database.js';

const router = new Router();


export default router;