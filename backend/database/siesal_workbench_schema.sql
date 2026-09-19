-- =========================================================
-- BANCO DE DADOS: SIESAL (Sistema de Gerenciamento Escolar do Aluno)
-- Script compatível com MySQL Workbench 8.0+
-- Autores: Natanael, Tiago, Anna e Miquéias
-- =========================================================

CREATE DATABASE IF NOT EXISTS `siesal_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `siesal_db`;

-- ---------------------------------------------------------
-- Tabela: USUARIO
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuario` (
  `id_usuario` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `senha` VARCHAR(255) NOT NULL,
  `data_cadastro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` TINYINT(1) NOT NULL DEFAULT 1,
  `tentativas_falhas` INT NOT NULL DEFAULT 0,
  `bloqueado_ate` DATETIME NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4;

-- ---------------------------------------------------------
-- Tabela: MARCADOR (Matérias / Categorias)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marcador` (
  `id_marcador` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(50) NOT NULL,
  `cor` VARCHAR(20) NOT NULL,
  `id_usuario` INT NOT NULL,
  PRIMARY KEY (`id_marcador`),
  INDEX `fk_marcador_usuario_idx` (`id_usuario` ASC),
  CONSTRAINT `fk_marcador_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuario` (`id_usuario`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4;

-- ---------------------------------------------------------
-- Tabela: TAREFA (Demandas Acadêmicas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tarefa` (
  `id_tarefa` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(100) NOT NULL,
  `descricao` TEXT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_entrega` DATETIME NOT NULL,
  `prioridade` VARCHAR(20) NOT NULL, -- 'Urgente', 'Proximo', 'Longe', 'Alta', 'Média', 'Baixa'
  `status` VARCHAR(20) NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Concluido', 'No prazo', 'Atrasado'
  `dificuldade` VARCHAR(20) NULL, -- 'Fácil', 'Médio', 'Difícil'
  `tipo` VARCHAR(50) NULL, -- 'Atividade', 'Trabalho', 'Prova', 'Exercício'
  `professor` VARCHAR(100) NULL,
  `id_usuario` INT NOT NULL,
  `id_marcador` INT NULL,
  PRIMARY KEY (`id_tarefa`),
  INDEX `fk_tarefa_usuario_idx` (`id_usuario` ASC),
  INDEX `fk_tarefa_marcador_idx` (`id_marcador` ASC),
  CONSTRAINT `fk_tarefa_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuario` (`id_usuario`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tarefa_marcador`
    FOREIGN KEY (`id_marcador`)
    REFERENCES `marcador` (`id_marcador`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4;

-- ---------------------------------------------------------
-- Tabela: EVENTO (Agenda e Horários)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `evento` (
  `id_evento` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(100) NOT NULL,
  `descricao` TEXT NULL,
  `data_inicio` DATETIME NOT NULL,
  `data_fim` DATETIME NOT NULL,
  `local` VARCHAR(100) NULL,
  `id_usuario` INT NOT NULL,
  PRIMARY KEY (`id_evento`),
  INDEX `fk_evento_usuario_idx` (`id_usuario` ASC),
  CONSTRAINT `fk_evento_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuario` (`id_usuario`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4;

-- ---------------------------------------------------------
-- Tabela: LEMBRETE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lembrete` (
  `id_lembrete` INT NOT NULL AUTO_INCREMENT,
  `mensagem` VARCHAR(255) NOT NULL,
  `data_hora` DATETIME NOT NULL,
  `data_envio` DATETIME NULL,
  `enviado` TINYINT(1) NOT NULL DEFAULT 0,
  `id_usuario` INT NOT NULL,
  `id_tarefa` INT NULL,
  `id_evento` INT NULL,
  PRIMARY KEY (`id_lembrete`),
  INDEX `fk_lembrete_usuario_idx` (`id_usuario` ASC),
  INDEX `fk_lembrete_tarefa_idx` (`id_tarefa` ASC),
  INDEX `fk_lembrete_evento_idx` (`id_evento` ASC),
  CONSTRAINT `fk_lembrete_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuario` (`id_usuario`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_lembrete_tarefa`
    FOREIGN KEY (`id_tarefa`)
    REFERENCES `tarefa` (`id_tarefa`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_lembrete_evento`
    FOREIGN KEY (`id_evento`)
    REFERENCES `evento` (`id_evento`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4;

-- ---------------------------------------------------------
-- Tabela: NOTIFICACAO
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notificacao` (
  `id_notificacao` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(100) NOT NULL,
  `mensagem` TEXT NOT NULL,
  `data_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lida` TINYINT(1) NOT NULL DEFAULT 0,
  `id_usuario` INT NOT NULL,
  PRIMARY KEY (`id_notificacao`),
  INDEX `fk_notificacao_usuario_idx` (`id_usuario` ASC),
  CONSTRAINT `fk_notificacao_usuario`
    FOREIGN KEY (`id_usuario`)
    REFERENCES `usuario` (`id_usuario`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4;

-- =========================================================
-- DADOS INICIAIS DE TESTE (Conforme Protótipos)
-- =========================================================
INSERT INTO `usuario` (`id_usuario`, `nome`, `email`, `senha`, `data_cadastro`, `status`)
VALUES (1, 'Jose de Arimateia', 'jose.arimateia@escola.gov.br', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NOW(), 1)
ON DUPLICATE KEY UPDATE `nome`=VALUES(`nome`);

INSERT INTO `marcador` (`id_marcador`, `nome`, `cor`, `id_usuario`) VALUES
(1, 'Português', '#F97316', 1),
(2, 'Matemática', '#3B82F6', 1),
(3, 'Ciências', '#22C55E', 1),
(4, 'História', '#EAB308', 1),
(5, 'Geografia', '#06B6D4', 1),
(6, 'Artes', '#A855F7', 1),
(7, 'Inglês', '#EC4899', 1)
ON DUPLICATE KEY UPDATE `nome`=VALUES(`nome`);

INSERT INTO `tarefa` (`id_tarefa`, `titulo`, `descricao`, `data_criacao`, `data_entrega`, `prioridade`, `status`, `dificuldade`, `tipo`, `professor`, `id_usuario`, `id_marcador`) VALUES
(1, 'Sujeito e Predicado', 'Estudar os tipos de sujeito determinado e indeterminado, e classificar orações do livro na página 45.', NOW(), '2026-10-06 14:00:00', 'Urgente', 'Pendente', 'Difícil', 'Atividade', 'Diego Cisne', 1, 1),
(2, 'Trabalho: Vírgula', 'Produzir um texto dissertativo aplicando o uso correto da pontuação e vírgulas.', NOW(), '2026-10-10 18:00:00', 'Proximo', 'Pendente', 'Médio', 'Trabalho', 'Diego Cisne', 1, 1),
(3, 'Equação Primeiro Grau', 'Resolver a lista de 15 exercícios sobre equações lineares e problemas contextualizados.', NOW(), '2026-10-07 10:00:00', 'Proximo', 'Pendente', 'Médio', 'Atividade', 'Carlos Silva', 1, 2),
(4, 'Função Primeiro Grau', 'Construir os gráficos cartesianos para f(x) = ax + b nos intervalos indicados.', NOW(), '2026-10-15 23:59:00', 'Longe', 'Pendente', 'Difícil', 'Atividade', 'Carlos Silva', 1, 2),
(5, 'Exercícios Sobre Plantas', 'Pesquisar o ciclo de fotossíntese e os tecidos condutores xilema e floema.', NOW(), '2026-10-08 16:00:00', 'Proximo', 'Concluido', 'Fácil', 'Atividade', 'Marina Souza', 1, 3)
ON DUPLICATE KEY UPDATE `titulo`=VALUES(`titulo`);

INSERT INTO `evento` (`id_evento`, `titulo`, `descricao`, `data_inicio`, `data_fim`, `local`, `id_usuario`) VALUES
(1, 'Início das aulas', 'Abertura das aulas regulares do turno da manhã', '2026-09-19 07:00:00', '2026-09-19 12:00:00', 'Sala 4B', 1),
(2, 'Laboratório de Ciências', 'Aula prática sobre microscopia e células vegetais', '2026-09-22 09:30:00', '2026-09-22 11:30:00', 'Laboratório 2', 1)
ON DUPLICATE KEY UPDATE `titulo`=VALUES(`titulo`);

INSERT INTO `notificacao` (`id_notificacao`, `titulo`, `mensagem`, `data_envio`, `lida`, `id_usuario`) VALUES
(1, 'Avisos', 'O prazo de uma atividade acaba Hoje', NOW(), 0, 1),
(2, 'Avisos', 'O prazo de uma atividade Prioritária acaba logo', NOW(), 0, 1)
ON DUPLICATE KEY UPDATE `titulo`=VALUES(`titulo`);
