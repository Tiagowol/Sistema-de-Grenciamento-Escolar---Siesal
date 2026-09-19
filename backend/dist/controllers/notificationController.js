"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = void 0;
const prisma_1 = require("../services/prisma");
exports.notificationController = {
    // Listar notificações do usuário (F04, Protótipo Avisos)
    async list(req, res) {
        try {
            const userId = req.userId || 1;
            const notifications = await prisma_1.prisma.notificacao.findMany({
                where: { id_usuario: userId },
                orderBy: { data_envio: 'desc' },
            });
            return res.json(notifications);
        }
        catch (err) {
            console.error('Erro ao listar notificações:', err);
            return res.status(500).json({ error: 'Erro ao listar notificações.' });
        }
    },
    // Marcar como lida
    async markAsRead(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const existing = await prisma_1.prisma.notificacao.findFirst({
                where: { id_notificacao: Number(id), id_usuario: userId },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Notificação não encontrada.' });
            }
            const updated = await prisma_1.prisma.notificacao.update({
                where: { id_notificacao: Number(id) },
                data: { lida: true },
            });
            return res.json(updated);
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao atualizar notificação.' });
        }
    },
    // Marcar todas como lidas
    async markAllAsRead(req, res) {
        try {
            const userId = req.userId || 1;
            await prisma_1.prisma.notificacao.updateMany({
                where: { id_usuario: userId, lida: false },
                data: { lida: true },
            });
            return res.json({ message: 'Todas as notificações foram marcadas como lidas.' });
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao marcar notificações.' });
        }
    },
};
