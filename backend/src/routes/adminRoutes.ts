import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', adminController.getSystemStats);
router.get('/users', adminController.listUsers);
router.post('/broadcast', adminController.broadcastMaintenanceNotice);
router.post('/purge-notifications', adminController.purgeOldNotifications);

// Gestão de contas (v2)
router.put('/users/:id/status', adminController.setUserStatus);
router.post('/users/:id/unlock', adminController.unlockUser);
router.delete('/users/:id', adminController.deleteUser);

export default router;
