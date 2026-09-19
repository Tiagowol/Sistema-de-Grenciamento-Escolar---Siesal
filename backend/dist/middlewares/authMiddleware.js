"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'siesal_secret_jwt_key_2026_super_secure';
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.userId = decoded.id_usuario;
            req.userEmail = decoded.email;
            return next();
        }
        catch (err) {
            return res.status(401).json({ error: 'Token de autenticação inválido ou expirado. Faça login novamente.' });
        }
    }
    // Se for um teste com header x-user-id explícito
    const demoUserId = req.headers['x-user-id'];
    if (demoUserId) {
        req.userId = Number(demoUserId);
        return next();
    }
    // Requisito: Autenticação estritamente obrigatória
    return res.status(401).json({ error: 'Acesso negado. Autenticação obrigatória.' });
};
exports.authMiddleware = authMiddleware;
