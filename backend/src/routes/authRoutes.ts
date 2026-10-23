import { Router } from 'express';
import { authController } from '../controllers/authController';
import { googleAuthController } from '../controllers/googleAuthController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authRateLimit } from '../middlewares/rateLimit';

const router = Router();

// Rotas públicas de autenticação (F05, F06, NF03)
// Rate limit: protege contra força bruta em conjunto com o bloqueio NF03
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);

// Login com Google — OAuth 2.0 Authorization Code Flow real
router.get('/google/status', googleAuthController.status);
router.get('/google', googleAuthController.redirectToGoogle);
router.get('/google/callback', googleAuthController.googleCallback);
router.post('/google/exchange', authRateLimit, googleAuthController.exchangeLoginCode);

// Rotas autenticadas (perfil e conta)
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/password', authRateLimit, authMiddleware, authController.changePassword);
router.delete('/account', authMiddleware, authController.deleteAccount);

export default router;
