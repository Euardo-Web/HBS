const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// Configuração CORS aprimorada para permitir acesso de outros domínios incluindo Tembo.io
app.use(cors({
    origin: '*', // Permite acesso de qualquer origem
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    maxAge: 86400 // Cache de preflight por 24 horas
}));

// Log de todas as requisições para facilitar o diagnóstico
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'N/A'} - IP: ${req.ip}`);
    next();
});
app.use(express.json());
app.use(express.static('.')); // Servir arquivos estáticos da raiz do projeto

// Rotas da API

// Health check endpoint para verificar se a API está respondendo
app.get('/api/health', (req, res) => {
    const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            hostname: require('os').hostname()
        },
        database: {
            type: 'SQLite',
            path: path.resolve('./estoque.db'),
            exists: fs.existsSync(path.resolve('./estoque.db'))
        }
    };
    
    // Teste simples de conexão com banco
    db.verificarBanco()
        .then(bancoOk => {
            healthData.database.status = bancoOk ? 'connected' : 'error';
            res.json(healthData);
        })
        .catch(err => {
            healthData.database.status = 'error';
            healthData.database.error = err.message;
            res.status(500).json(healthData);
        });
});

// Buscar todos os itens
app.get('/api/itens', async (req, res) => {
    try {
        const itens = await db.buscarItens();
        res.json(itens);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar item por ID
app.get('/api/itens/:id', async (req, res) => {
    try {
        const item = await db.buscarItemPorId(req.params.id);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ error: 'Item não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cadastrar novo item
app.post('/api/itens', async (req, res) => {
    try {
        // Log detalhado do corpo recebido para debug de importação
        console.log('Recebido em /api/itens:', JSON.stringify(req.body, null, 2));
        // Garante valores padrão para campos opcionais
        const itemData = {
            ...req.body,
            minimo: typeof req.body.minimo === 'number' ? req.body.minimo : 0,
            ideal: typeof req.body.ideal === 'number' ? req.body.ideal : 0,
            descricao: req.body.descricao || ''
        };
        const itemId = await db.inserirItem(itemData);
        // Registrar movimentação inicial
        await db.inserirMovimentacao({
            itemId: itemId,
            itemNome: itemData.nome,
            tipo: 'entrada',
            quantidade: itemData.quantidade,
            descricao: 'Cadastro inicial'
        });
        res.status(201).json({ id: itemId, message: 'Item cadastrado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar item
app.put('/api/itens/:id', async (req, res) => {
    try {
        const changes = await db.atualizarQuantidade(req.params.id, req.body.quantidade);
        if (changes > 0) {
            res.json({ message: 'Item atualizado com sucesso' });
        } else {
            res.status(404).json({ error: 'Item não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Adicionar estoque
app.post('/api/itens/:id/adicionar', async (req, res) => {
    try {
        const item = await db.buscarItemPorId(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        
        const novaQuantidade = item.quantidade + req.body.quantidade;
        await db.atualizarQuantidade(req.params.id, novaQuantidade);
        
        // Registrar movimentação
        await db.inserirMovimentacao({
            itemId: req.params.id,
            itemNome: item.nome,
            tipo: 'entrada',
            quantidade: req.body.quantidade,
            descricao: req.body.observacao || 'Adição de estoque'
        });
        
        res.json({ message: 'Estoque adicionado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retirar estoque
app.post('/api/itens/:id/retirar', async (req, res) => {
    try {
        const item = await db.buscarItemPorId(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        
        if (item.quantidade < req.body.quantidade) {
            return res.status(400).json({ error: 'Quantidade insuficiente em estoque' });
        }
        
        const novaQuantidade = item.quantidade - req.body.quantidade;
        await db.atualizarQuantidade(req.params.id, novaQuantidade);
        
        // Registrar movimentação
        await db.inserirMovimentacao({
            itemId: req.params.id,
            itemNome: item.nome,
            tipo: 'saida',
            quantidade: req.body.quantidade,
            destino: req.body.destino,
            descricao: req.body.observacao || 'Retirada de estoque'
        });
        
        res.json({ message: 'Retirada realizada com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remover item
app.delete('/api/itens/:id', async (req, res) => {
    try {
        const changes = await db.removerItem(req.params.id);
        if (changes > 0) {
            res.json({ message: 'Item removido com sucesso' });
        } else {
            res.status(404).json({ error: 'Item não encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar movimentações
app.get('/api/movimentacoes', async (req, res) => {
    try {
        const dias = req.query.dias || 30;
        const movimentacoes = await db.buscarMovimentacoes(dias);
        res.json(movimentacoes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    
    // Exibir URLs de acesso local e de rede
    console.log(`Acesso local: http://localhost:${PORT}`);
    
    // Tentar encontrar um endereço de IP da rede para facilitar acesso de outras máquinas
    try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let networkIP = '';
        
        // Procurar um endereço IPv4 não interno
        Object.keys(networkInterfaces).forEach((interfaceName) => {
            networkInterfaces[interfaceName].forEach((iface) => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    networkIP = iface.address;
                }
            });
        });
        
        if (networkIP) {
            console.log(`Acesso pela rede: http://${networkIP}:${PORT}`);
        }
    } catch (e) {
        console.log('Não foi possível determinar o endereço IP da rede');
    }
    
    console.log(`Banco de dados SQLite localizado em: ${path.resolve('./estoque.db')}`);
    
    // Verificar integridade do banco ao iniciar
    try {
        const bancoOk = await db.verificarBanco();
        if (bancoOk) {
            console.log('Banco de dados pronto para uso');
        } else {
            console.warn('Banco de dados pode ter problemas de integridade');
        }
    } catch (err) {
        console.error('Erro ao verificar banco de dados:', err.message);
    }
});

// Fechar conexão ao encerrar aplicação
process.on('SIGINT', () => {
    db.fecharConexao();
    process.exit(0);
});
// Limpar tudo (corrigido para usar db.run do database.js)
app.delete('/api/limpar-tudo', async (req, res) => {
  await db.run('DELETE FROM itens');
  await db.run('DELETE FROM movimentacoes');
  res.json({ ok: true });
});

// Unificar itens duplicados (mesmo nome e serie)
app.post('/api/unificar-itens', async (req, res) => {
  try {
    const itens = await db.buscarItens();
    const agrupados = {};
    // Agrupa por nome+serie
    for (const item of itens) {
      const chave = `${item.nome}||${item.serie}`;
      if (!agrupados[chave]) {
        agrupados[chave] = { ...item };
        // Mantém a descrição do mais antigo
      } else {
        agrupados[chave].quantidade += item.quantidade;
        // Mantém a descrição do mais antigo, ignora a do mais novo
        // Infos pode ser concatenado, se desejar
        agrupados[chave].infos = [agrupados[chave].infos, item.infos].filter(Boolean).join('; ');
      }
    }
    // Remove todos os itens
    await db.run('DELETE FROM itens');
    // Reinsere apenas os unificados
    for (const chave in agrupados) {
      const i = agrupados[chave];
      try {
        // Remove o campo id antes de inserir (evita conflito de PK)
        const { id, ...itemSemId } = i;
        // Garante que descricao nunca seja undefined ou nula
        if (!itemSemId.descricao) itemSemId.descricao = '';
        if (!itemSemId.nome) itemSemId.nome = '';
        if (!itemSemId.serie) itemSemId.serie = '';
        if (!itemSemId.infos) itemSemId.infos = '';
        if (typeof itemSemId.quantidade !== 'number') itemSemId.quantidade = 0;
        if (typeof itemSemId.minimo !== 'number') itemSemId.minimo = 0;
        if (typeof itemSemId.ideal !== 'number') itemSemId.ideal = 0;
        await db.inserirItem(itemSemId);
      } catch (err) {
        console.error('Erro ao inserir item unificado:', i, err);
      }
    }
    res.json({ ok: true, total: Object.keys(agrupados).length });
  } catch (err) {
    console.error('Erro na unificação de itens:', err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
  }
});

// Rota para exportar banco de dados (para sincronização)
app.get('/api/exportar-banco', async (req, res) => {
    try {
        const dados = await db.exportarDados();
        res.json(dados);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para importar banco de dados (para sincronização)
app.post('/api/importar-banco', async (req, res) => {
    try {
        const resultado = await db.importarDados(req.body);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware global para garantir resposta JSON em qualquer erro
app.use((err, req, res, next) => {
    console.error('Erro global:', err);
    res.status(500).json({ error: err && err.message ? err.message : String(err) });
});