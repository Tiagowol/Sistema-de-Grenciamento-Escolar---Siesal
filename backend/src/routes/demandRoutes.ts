import { Router } from 'express';
import { demandController } from '../controllers/demandController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', demandController.list);
router.get('/:id', demandController.getById);
router.post('/', demandController.create);
router.put('/:id', demandController.update);
router.patch('/:id/toggle', demandController.toggleStatus);
router.delete('/:id', demandController.delete);

export default router;
