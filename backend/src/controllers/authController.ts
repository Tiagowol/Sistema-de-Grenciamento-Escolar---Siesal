import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'siesal_secret_jwt_key_2026_super_secure';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;

// Validações auxiliares
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;
const MIN_NAME_LENGTH = 2;

function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) return 'E-mail é obrigatório.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Formato de e-mail inválido. Ex: aluno@escola.com';
  return null;
}

function validatePassword(senha: string): string | null {
  if (!senha || senha.length === 0) return 'Senha é obrigatória.';
  if (senha.length < MIN_PASSWORD_LENGTH) return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return null;
}

function validateName(nome: string): string | null {
  if (!nome || nome.trim().length === 0) return 'Nome completo é obrigatório.';
  if (nome.trim().length < MIN_NAME_LENGTH) return `O nome deve ter pelo menos ${MIN_NAME_LENGTH} caracteres.`;
  if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(nome.trim())) return 'O nome deve conter apenas letras e espaços.';
  return null;
}

export const authController = {
  // F05: Cadastro de novos alunos com Escola e Turma salvos no banco
  async register(req: Request, res: Response) {
    try {
      const { nome, email, senha, confirmarSenha, escola, turma } = req.body;

      // Validações de presença e formato
      const nomeError = validateName(nome);
      if (nomeError) return res.status(400).json({ error: nomeError, field: 'nome' });

      const emailError = validateEmail(email);
      if (emailError) return res.status(400).json({ error: emailError, field: 'email' });

      const senhaError = validatePassword(senha);
      if (senhaError) return res.status(400).json({ error: senhaError, field: 'senha' });

      // Verificação de confirmação de senha (se fornecida pelo frontend)
      if (confirmarSenha !== undefined && confirmarSenha !== senha) {
        return res.status(400).json({ error: 'As senhas não coincidem.', field: 'confirmarSenha' });
      }

      // Verifica se o e-mail já está cadastrado
      const existingUser = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existingUser) {
        return res.status(409).json({
          error: 'Este e-mail já está cadastrado. Faça login ou use outro endereço de e-mail.',
          field: 'email',
        });
      }

      // Validações de escola e turma
      if (!escola || escola.trim().length < 3) {
        return res.status(400).json({ error: 'Nome da escola/instituição deve ter pelo menos 3 caracteres.', field: 'escola' });
      }
      if (!turma || turma.trim().length < 1) {
        return res.status(400).json({ error: 'Turma/série é obrigatória.', field: 'turma' });
      }

      const hashedPassword = await bcrypt.hash(senha, 12);

      const user = await prisma.usuario.create({
        data: {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha: hashedPassword,
          escola: escola.trim(),
          turma: turma.trim(),
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
        await prisma.marcador.create({
          data: {
            ...subj,
            id_usuario: user.id_usuario,
          },
        });
      }

      // Cria notificação de boas-vindas
      await prisma.notificacao.create({
        data: {
          titulo: 'Bem-vindo ao SIESAL! 🎓',
          mensagem: `Olá, ${user.nome}! Sua conta foi criada com sucesso. Você está cadastrado(a) na ${user.escola} - ${user.turma}. Comece adicionando suas primeiras demandas!`,
          id_usuario: user.id_usuario,
        },
      });

      const token = jwt.sign(
        { id_usuario: user.id_usuario, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        message: 'Conta criada com sucesso! Bem-vindo ao SIESAL.',
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
    } catch (err: any) {
      console.error('Erro no registro:', err);
      // Erro de unicidade do Prisma (P2002)
      if (err.code === 'P2002') {
        return res.status(409).json({
          error: 'Este e-mail já está sendo usado por outra conta.',
          field: 'email',
        });
      }
      return res.status(500).json({ error: 'Erro interno ao cadastrar usuário. Tente novamente.' });
    }
  },

  // F06 & NF03: Login de usuários com bloqueio de 5 tentativas
  async login(req: Request, res: Response) {
    try {
      const { email, senha } = req.body;

      // Validações básicas de formato
      const emailError = validateEmail(email);
      if (emailError) return res.status(400).json({ error: emailError, field: 'email' });

      if (!senha || senha.length === 0) {
        return res.status(400).json({ error: 'Senha é obrigatória.', field: 'senha' });
      }

      const user = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });

      // Conta inexistente — mensagem genérica por segurança
      if (!user) {
        return res.status(401).json({
          error: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
        });
      }

      // Conta desativada
      if (!user.status) {
        return res.status(403).json({
          error: 'Esta conta foi desativada. Entre em contato com o suporte.',
        });
      }

      // Verifica se a conta está temporariamente bloqueada (NF03)
      if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
        const remainingMinutes = Math.ceil(
          (new Date(user.bloqueado_ate).getTime() - new Date().getTime()) / 60000
        );
        return res.status(403).json({
          error: `Conta bloqueada por segurança após ${MAX_FAILED_ATTEMPTS} tentativas incorretas. Tente novamente em ${remainingMinutes} minuto(s).`,
          bloqueado: true,
          desbloqueia_em: user.bloqueado_ate,
        });
      }

      const isPasswordValid = await bcrypt.compare(senha, user.senha);

      if (!isPasswordValid) {
        const updatedAttempts = user.tentativas_falhas + 1;
        let lockDate: Date | null = null;

        if (updatedAttempts >= MAX_FAILED_ATTEMPTS) {
          lockDate = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
        }

        await prisma.usuario.update({
          where: { id_usuario: user.id_usuario },
          data: {
            tentativas_falhas: updatedAttempts,
            bloqueado_ate: lockDate,
          },
        });

        if (updatedAttempts >= MAX_FAILED_ATTEMPTS) {
          return res.status(403).json({
            error: `Acesso bloqueado: ${MAX_FAILED_ATTEMPTS} tentativas incorretas atingidas. Conta bloqueada por ${LOCK_TIME_MINUTES} minutos por segurança.`,
            bloqueado: true,
          });
        }

        const restantes = MAX_FAILED_ATTEMPTS - updatedAttempts;
        return res.status(401).json({
          error: `E-mail ou senha incorretos. Você tem mais ${restantes} tentativa(s) antes do bloqueio automático.`,
          tentativas_restantes: restantes,
        });
      }

      // Reseta tentativas após login bem-sucedido
      await prisma.usuario.update({
        where: { id_usuario: user.id_usuario },
        data: {
          tentativas_falhas: 0,
          bloqueado_ate: null,
        },
      });

      const token = jwt.sign(
        { id_usuario: user.id_usuario, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

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
    } catch (err: any) {
      console.error('Erro no login:', err);
      return res.status(500).json({ error: 'Erro interno ao autenticar. Tente novamente.' });
    }
  },

  // Perfil do usuário atual
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = await prisma.usuario.findUnique({
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
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
  },

  // Alterar senha do usuário
  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { senhaAtual, novaSenha, confirmarNovaSenha } = req.body;

      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
      }

      const senhaError = validatePassword(novaSenha);
      if (senhaError) return res.status(400).json({ error: senhaError, field: 'novaSenha' });

      if (novaSenha !== confirmarNovaSenha) {
        return res.status(400).json({ error: 'As novas senhas não coincidem.', field: 'confirmarNovaSenha' });
      }

      const user = await prisma.usuario.findUnique({ where: { id_usuario: req.userId } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const isCurrentValid = await bcrypt.compare(senhaAtual, user.senha);
      if (!isCurrentValid) {
        return res.status(401).json({ error: 'Senha atual incorreta.', field: 'senhaAtual' });
      }

      const hashedNew = await bcrypt.hash(novaSenha, 12);
      await prisma.usuario.update({
        where: { id_usuario: req.userId },
        data: { senha: hashedNew, tentativas_falhas: 0, bloqueado_ate: null },
      });

      return res.json({ message: 'Senha alterada com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao alterar senha.' });
    }
  },
};
