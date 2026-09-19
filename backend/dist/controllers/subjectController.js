"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subjectController = void 0;
const prisma_1 = require("../services/prisma");
exports.subjectController = {
    // Listar todas as matérias / marcadores (F03)
    async list(req, res) {
        try {
            const userId = req.userId || 1;
            const subjects = await prisma_1.prisma.marcador.findMany({
                where: { id_usuario: userId },
                include: {
                    _count: {
                        select: { tarefas: true },
                    },
                },
                orderBy: { nome: 'asc' },
            });
            return res.json(subjects);
        }
        catch (err) {
            console.error('Erro ao listar matérias:', err);
            return res.status(500).json({ error: 'Erro ao listar matérias.' });
        }
    },
    // Criar nova matéria / marcador
    async create(req, res) {
        try {
            const userId = req.userId || 1;
            const { nome, cor } = req.body;
            if (!nome || !cor) {
                return res.status(400).json({ error: 'Nome e cor da matéria são obrigatórios.' });
            }
            const subject = await prisma_1.prisma.marcador.create({
                data: {
                    nome,
                    cor,
                    id_usuario: userId,
                },
            });
            return res.status(201).json(subject);
        }
        catch (err) {
            console.error('Erro ao criar matéria:', err);
            return res.status(500).json({ error: 'Erro ao criar matéria.' });
        }
    },
    // Atualizar matéria
    async update(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const { nome, cor } = req.body;
            const existing = await prisma_1.prisma.marcador.findFirst({
                where: { id_marcador: Number(id), id_usuario: userId },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Matéria não encontrada.' });
            }
            const updated = await prisma_1.prisma.marcador.update({
                where: { id_marcador: Number(id) },
                data: {
                    nome: nome || existing.nome,
                    cor: cor || existing.cor,
                },
            });
            return res.json(updated);
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao atualizar matéria.' });
        }
    },
    // Deletar matéria
    async delete(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const existing = await prisma_1.prisma.marcador.findFirst({
                where: { id_marcador: Number(id), id_usuario: userId },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Matéria não encontrada.' });
            }
            await prisma_1.prisma.marcador.delete({
                where: { id_marcador: Number(id) },
            });
            return res.json({ message: 'Matéria excluída com sucesso!' });
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao excluir matéria.' });
        }
    },
};
