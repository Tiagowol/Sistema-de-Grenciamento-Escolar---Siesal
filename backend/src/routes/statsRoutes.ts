import { Router } from 'express';
import { statsController } from '../controllers/statsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', statsController.getDashboardStats);

export default router;
