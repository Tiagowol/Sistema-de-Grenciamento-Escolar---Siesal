import { Router } from 'express';
import { subjectController } from '../controllers/subjectController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', subjectController.list);
router.post('/', subjectController.create);
router.put('/:id', subjectController.update);
router.delete('/:id', subjectController.delete);

export default router;
