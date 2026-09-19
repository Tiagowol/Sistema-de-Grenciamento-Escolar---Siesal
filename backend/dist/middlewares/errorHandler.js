"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error('[Error Handler]', err);
    const status = err.statusCode || 500;
    const message = err.message || 'Erro interno no servidor.';
    res.status(status).json({
        success: false,
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
exports.errorHandler = errorHandler;
