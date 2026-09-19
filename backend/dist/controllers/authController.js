"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../services/prisma");
const JWT_SECRET = process.env.JWT_SECRET || 'siesal_secret_jwt_key_2026_super_secure';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;
exports.authController = {
    // F05: Cadastro de novos alunos com Escola e Turma salvos no banco
    async register(req, res) {
        try {
            const { nome, email, senha, escola, turma } = req.body;
            if (!nome || !email || !senha) {
                return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
            }
            const existingUser = await prisma_1.prisma.usuario.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
            }
            const hashedPassword = await bcryptjs_1.default.hash(senha, 10);
            const user = await prisma_1.prisma.usuario.create({
                data: {
                    nome,
                    email,
                    senha: hashedPassword,
                    escola: escola || 'Escola Municipal',
                    turma: turma || '9º Ano',
                    status: true,
                    tentativas_falhas: 0,
                },
            });
            // Cria marcadores padrão para o novo estudante
            const defaultSubjects = [
                { nome: 'Português', cor: '#F97316' },
                { nome: 'Matemática', cor: '#3B82F6' },
                { nome: 'Ciências', cor: '#22C55E' },
                { nome: 'História', cor: '#EAB308' },
                { nome: 'Geografia', cor: '#06B6D4' },
                { nome: 'Artes', cor: '#A855F7' },
                { nome: 'Inglês', cor: '#EC4899' },
            ];
            for (const subj of defaultSubjects) {
                await prisma_1.prisma.marcador.create({
                    data: {
                        ...subj,
                        id_usuario: user.id_usuario,
                    },
                });
            }
            // Cria notificação de boas-vindas
            await prisma_1.prisma.notificacao.create({
                data: {
                    titulo: 'Bem-vindo ao SIESAL!',
                    mensagem: `Seja bem-vindo, ${user.nome}! Seu painel escolar da ${user.escola} (${user.turma}) está pronto.`,
                    id_usuario: user.id_usuario,
                },
            });
            const token = jsonwebtoken_1.default.sign({ id_usuario: user.id_usuario, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({
                message: 'Usuário cadastrado com sucesso!',
                token,
                usuario: {
                    id_usuario: user.id_usuario,
                    nome: user.nome,
                    email: user.email,
                    escola: user.escola,
                    turma: user.turma,
                    data_cadastro: user.data_cadastro,
                },
            });
        }
        catch (err) {
            console.error('Erro no registro:', err);
            return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
        }
    },
    // F06 & NF03: Login de usuários com bloqueio de 5 tentativas
    async login(req, res) {
        try {
            const { email, senha } = req.body;
            if (!email || !senha) {
                return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
            }
            const user = await prisma_1.prisma.usuario.findUnique({ where: { email } });
            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }
            // Verifica se a conta está temporariamente bloqueada (NF03)
            if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
                const remainingMinutes = Math.ceil((new Date(user.bloqueado_ate).getTime() - new Date().getTime()) / 60000);
                return res.status(403).json({
                    error: `Acesso bloqueado por segurança devido a ${MAX_FAILED_ATTEMPTS} tentativas incorretas. Tente novamente em ${remainingMinutes} minuto(s).`,
                    bloqueado: true,
                });
            }
            const isPasswordValid = await bcryptjs_1.default.compare(senha, user.senha);
            if (!isPasswordValid) {
                const updatedAttempts = user.tentativas_falhas + 1;
                let lockDate = null;
                if (updatedAttempts >= MAX_FAILED_ATTEMPTS) {
                    lockDate = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
                }
                await prisma_1.prisma.usuario.update({
                    where: { id_usuario: user.id_usuario },
                    data: {
                        tentativas_falhas: updatedAttempts,
                        bloqueado_ate: lockDate,
                    },
                });
                if (updatedAttempts >= MAX_FAILED_ATTEMPTS) {
                    return res.status(403).json({
                        error: `Software bloqueou o acesso: 5 tentativas incorretas atingidas. Bloqueado por ${LOCK_TIME_MINUTES} minutos.`,
                        bloqueado: true,
                    });
                }
                return res.status(401).json({
                    error: `Senha incorreta. Tentativa ${updatedAttempts} de ${MAX_FAILED_ATTEMPTS}.`,
                    tentativas_restantes: MAX_FAILED_ATTEMPTS - updatedAttempts,
                });
            }
            // Reseta tentativas após login bem-sucedido
            await prisma_1.prisma.usuario.update({
                where: { id_usuario: user.id_usuario },
                data: {
                    tentativas_falhas: 0,
                    bloqueado_ate: null,
                },
            });
            const token = jsonwebtoken_1.default.sign({ id_usuario: user.id_usuario, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({
                message: 'Login realizado com sucesso!',
                token,
                usuario: {
                    id_usuario: user.id_usuario,
                    nome: user.nome,
                    email: user.email,
                    escola: user.escola,
                    turma: user.turma,
                    data_cadastro: user.data_cadastro,
                },
            });
        }
        catch (err) {
            console.error('Erro no login:', err);
            return res.status(500).json({ error: 'Erro ao autenticar usuário.' });
        }
    },
    // Perfil do usuário atual
    async getProfile(req, res) {
        try {
            const user = await prisma_1.prisma.usuario.findUnique({
                where: { id_usuario: req.userId },
                select: {
                    id_usuario: true,
                    nome: true,
                    email: true,
                    escola: true,
                    turma: true,
                    data_cadastro: true,
                    status: true,
                },
            });
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }
            return res.json(user);
        }
        catch (err) {
            return res.status(500).json({ error: 'Erro ao buscar perfil.' });
        }
    },
};
