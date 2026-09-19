"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demandController = void 0;
const prisma_1 = require("../services/prisma");
const priorityCalculator_1 = require("../utils/priorityCalculator");
exports.demandController = {
    // Listar todas as demandas com cálculo dinâmico de prioridade
    async list(req, res) {
        try {
            const userId = req.userId || 1;
            const { id_marcador, prioridade, status, dificuldade, tipo, search } = req.query;
            const whereClause = {
                id_usuario: userId,
            };
            if (id_marcador && id_marcador !== 'todos') {
                whereClause.id_marcador = Number(id_marcador);
            }
            if (status && status !== 'todos') {
                whereClause.status = String(status);
            }
            if (dificuldade && dificuldade !== 'todos') {
                whereClause.dificuldade = String(dificuldade);
            }
            if (tipo && tipo !== 'todos') {
                whereClause.tipo = String(tipo);
            }
            if (search) {
                whereClause.OR = [
                    { titulo: { contains: String(search) } },
                    { descricao: { contains: String(search) } },
                    { professor: { contains: String(search) } },
                ];
            }
            const rawDemands = await prisma_1.prisma.tarefa.findMany({
                where: whereClause,
                include: {
                    marcador: true,
                    lembretes: true,
                },
                orderBy: [
                    { data_entrega: 'asc' },
                    { id_tarefa: 'desc' },
                ],
            });
            // Atualiza e calcula dinamicamente a prioridade de cada demanda com base no prazo e na dificuldade
            const demands = rawDemands.map((d) => {
                const dynamicPriority = (0, priorityCalculator_1.calculateDynamicPriority)(d.data_entrega, d.dificuldade || 'Médio');
                return {
                    ...d,
                    prioridade: dynamicPriority,
                };
            });
            // Filtragem por prioridade após cálculo dinâmico (se solicitado)
            const filtered = (prioridade && prioridade !== 'todos')
                ? demands.filter((d) => d.prioridade === String(prioridade))
                : demands;
            return res.json(filtered);
        }
        catch (err) {
            console.error('Erro ao listar demandas:', err);
            return res.status(500).json({ error: 'Erro ao listar demandas.' });
        }
    },
    // Obter detalhes de uma demanda
    async getById(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const demand = await prisma_1.prisma.tarefa.findFirst({
                where: {
                    id_tarefa: Number(id),
                    id_usuario: userId,
                },
                include: {
                    marcador: true,
                    lembretes: true,
                },
            });
            if (!demand) {
                return res.status(404).json({ error: 'Demanda não encontrada.' });
            }
            const dynamicPriority = (0, priorityCalculator_1.calculateDynamicPriority)(demand.data_entrega, demand.dificuldade || 'Médio');
            return res.json({
                ...demand,
                prioridade: dynamicPriority,
            });
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao buscar demanda.' });
        }
    },
    // F03 & Protótipo 5.2: Adicionar Demanda com Prioridade Dinâmica Automática
    async create(req, res) {
        try {
            const userId = req.userId || 1;
            const { titulo, descricao, data_entrega, prioridade, status, dificuldade, tipo, professor, id_marcador, criar_lembrete, } = req.body;
            if (!titulo || !data_entrega) {
                return res.status(400).json({ error: 'Título e Data de Entrega são obrigatórios.' });
            }
            const diffCalculated = dificuldade || 'Médio';
            // Calcula a prioridade dinamicamente com base no prazo e na dificuldade
            const dynamicPriority = (0, priorityCalculator_1.calculateDynamicPriority)(data_entrega, diffCalculated);
            const demand = await prisma_1.prisma.tarefa.create({
                data: {
                    titulo,
                    descricao: descricao || null,
                    data_entrega: new Date(data_entrega),
                    prioridade: dynamicPriority || prioridade || 'Proximo',
                    status: status || 'Pendente',
                    dificuldade: diffCalculated,
                    tipo: tipo || 'Atividade',
                    professor: professor || null,
                    id_usuario: userId,
                    id_marcador: id_marcador ? Number(id_marcador) : null,
                },
                include: {
                    marcador: true,
                },
            });
            // Se solicitado, cria lembrete associado (F02)
            if (criar_lembrete) {
                const reminderTime = new Date(new Date(data_entrega).getTime() - 24 * 60 * 60 * 1000);
                await prisma_1.prisma.lembrete.create({
                    data: {
                        mensagem: `Lembrete: Entrega da demanda "${titulo}" em breve!`,
                        data_hora: reminderTime > new Date() ? reminderTime : new Date(),
                        id_usuario: userId,
                        id_tarefa: demand.id_tarefa,
                    },
                });
            }
            // Notificação se for urgente ou prazo próximo
            if (dynamicPriority === 'Urgente') {
                await prisma_1.prisma.notificacao.create({
                    data: {
                        titulo: 'Demanda Prioritária Criada',
                        mensagem: `Você adicionou "${titulo}" com prioridade URGENTE devido ao prazo e dificuldade. Entrega: ${new Date(data_entrega).toLocaleDateString('pt-BR')}.`,
                        id_usuario: userId,
                    },
                });
            }
            return res.status(201).json({
                ...demand,
                prioridade: dynamicPriority,
            });
        }
        catch (err) {
            console.error('Erro ao criar demanda:', err);
            return res.status(500).json({ error: 'Erro ao criar demanda.' });
        }
    },
    // Atualizar Demanda recalculando prioridade
    async update(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const { titulo, descricao, data_entrega, status, dificuldade, tipo, professor, id_marcador, } = req.body;
            const existing = await prisma_1.prisma.tarefa.findFirst({
                where: { id_tarefa: Number(id), id_usuario: userId },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Demanda não encontrada.' });
            }
            const newDeadline = data_entrega ? new Date(data_entrega) : existing.data_entrega;
            const newDiff = dificuldade !== undefined ? dificuldade : (existing.dificuldade || 'Médio');
            const dynamicPriority = (0, priorityCalculator_1.calculateDynamicPriority)(newDeadline, newDiff);
            const updated = await prisma_1.prisma.tarefa.update({
                where: { id_tarefa: Number(id) },
                data: {
                    titulo: titulo !== undefined ? titulo : existing.titulo,
                    descricao: descricao !== undefined ? descricao : existing.descricao,
                    data_entrega: newDeadline,
                    prioridade: dynamicPriority,
                    status: status !== undefined ? status : existing.status,
                    dificuldade: newDiff,
                    tipo: tipo !== undefined ? tipo : existing.tipo,
                    professor: professor !== undefined ? professor : existing.professor,
                    id_marcador: id_marcador !== undefined ? (id_marcador ? Number(id_marcador) : null) : existing.id_marcador,
                },
                include: {
                    marcador: true,
                },
            });
            return res.json({
                ...updated,
                prioridade: dynamicPriority,
            });
        }
        catch (err) {
            console.error('Erro ao atualizar demanda:', err);
            return res.status(500).json({ error: 'Erro ao atualizar demanda.' });
        }
    },
    // Alternar Status (Pendente / Concluído)
    async toggleStatus(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const existing = await prisma_1.prisma.tarefa.findFirst({
                where: { id_tarefa: Number(id), id_usuario: userId },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Demanda não encontrada.' });
            }
            const newStatus = existing.status === 'Concluido' ? 'Pendente' : 'Concluido';
            const updated = await prisma_1.prisma.tarefa.update({
                where: { id_tarefa: Number(id) },
                data: { status: newStatus },
                include: { marcador: true },
            });
            const dynamicPriority = (0, priorityCalculator_1.calculateDynamicPriority)(updated.data_entrega, updated.dificuldade || 'Médio');
            return res.json({
                ...updated,
                prioridade: dynamicPriority,
            });
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao alternar status da demanda.' });
        }
    },
    // Deletar Demanda
    async delete(req, res) {
        try {
            const userId = req.userId || 1;
            const { id } = req.params;
            const existing = await prisma_1.prisma.tarefa.findFirst({
                where: { id_tarefa: Number(id), id_usuario: userId },
            });
            if (!existing) {
                return res.status(404).json({ error: 'Demanda não encontrada.' });
            }
            await prisma_1.prisma.tarefa.delete({
                where: { id_tarefa: Number(id) },
            });
            return res.json({ message: 'Demanda excluída com sucesso!' });
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao excluir demanda.' });
        }
    },
};
