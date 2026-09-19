"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middlewares/errorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares essenciais
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Rota de Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        system: 'SIESAL - Sistema de Gerenciamento Escolar do Aluno',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Rotas da API REST
app.use('/api', routes_1.default);
// Tratador global de erros
app.use(errorHandler_1.errorHandler);
// Inicialização do servidor
app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(`🚀 SIESAL Backend Server rodando com Express na porta ${PORT}`);
    console.log(`📡 URL da API: http://localhost:${PORT}/api`);
    console.log(`🛠️  Health check: http://localhost:${PORT}/api/health`);
    // Verificação da Conexão com o MySQL
    try {
        const { prisma } = await Promise.resolve().then(() => __importStar(require('./services/prisma')));
        await prisma.$connect();
        console.log(`🗄️  Banco de Dados: Conectado ao MySQL com SUCESSO!`);
    }
    catch (err) {
        console.log(`⚠️  Aviso de Conexão MySQL:`);
        console.log(`   ${err.message.split('\n')[0]}`);
        console.log(`   👉 Para conectar ao seu MySQL Workbench:`);
        console.log(`   1. Verifique sua senha no arquivo backend/.env (ex: DATABASE_URL="mysql://root:SUA_SENHA@localhost:3306/siesal_db")`);
        console.log(`   2. Ou execute o script backend/database/siesal_workbench_schema.sql no MySQL Workbench.`);
    }
    console.log(`====================================================`);
});
exports.default = app;
