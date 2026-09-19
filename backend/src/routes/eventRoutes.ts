import { Router } from 'express';
import { eventController } from '../controllers/eventController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', eventController.list);
router.post('/', eventController.create);
router.put('/:id', eventController.update);
router.delete('/:id', eventController.delete);

export default router;
