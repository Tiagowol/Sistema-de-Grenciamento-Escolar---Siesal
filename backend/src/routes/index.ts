import { Router } from 'express';
import authRoutes from './authRoutes';
import demandRoutes from './demandRoutes';
import subjectRoutes from './subjectRoutes';
import eventRoutes from './eventRoutes';
import notificationRoutes from './notificationRoutes';
import statsRoutes from './statsRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/demands', demandRoutes);
router.use('/subjects', subjectRoutes);
router.use('/events', eventRoutes);
router.use('/notifications', notificationRoutes);
router.use('/stats', statsRoutes);

export default router;
