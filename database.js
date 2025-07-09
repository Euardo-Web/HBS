const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Criar conexão com o banco de dados
const dbPath = path.join(__dirname, 'estoque.db');

// Verificar se o diretório do banco de dados existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Verificar se o arquivo do banco de dados existe, se não existir, criar um novo
const dbExists = fs.existsSync(dbPath);
if (!dbExists) {
    console.log('Arquivo de banco de dados não encontrado. Criando um novo banco de dados.');
}

// Configurações para conexão mais robusta
const connectionOptions = {
    // Ativar chaves estrangeiras
    foreignKeys: true,
    // Tentar novamente se o banco estiver ocupado
    busyTimeout: 5000
};

// Criar conexão com o banco de dados
const db = new sqlite3.Database(dbPath, connectionOptions, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite:', dbPath);
        
        // Se o banco acabou de ser criado, será inicializado com as tabelas
        if (!dbExists) {
            console.log('Inicializando novo banco de dados com estrutura padrão...');
        }
    }
});

// Criar tabelas
db.serialize(() => {
    // Tabela de itens
    db.run(`
        CREATE TABLE IF NOT EXISTS itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            serie TEXT,
            descricao TEXT,
            origem TEXT,
            destino TEXT,
            valor REAL DEFAULT 0,
            nf TEXT,
            quantidade INTEGER NOT NULL DEFAULT 0,
            minimo INTEGER NOT NULL DEFAULT 0,
            ideal INTEGER NOT NULL DEFAULT 0,
            infos TEXT,
            data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de movimentações
    db.run(`
        CREATE TABLE IF NOT EXISTS movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            item_nome TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
            quantidade INTEGER NOT NULL,
            destino TEXT,
            descricao TEXT,
            data DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES itens (id)
        )
    `);

    // Índices para melhor performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_itens_nome ON itens(nome)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_movimentacoes_item_id ON movimentacoes(item_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes(data)`);
});

// Funções para operações no banco

// Inserir item
function inserirItem(item) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO itens (nome, serie, descricao, origem, destino, valor, nf, quantidade, minimo, ideal, infos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
            item.nome, item.serie, item.descricao, item.origem, item.destino,
            item.valor, item.nf, item.quantidade, item.minimo, item.ideal, item.infos
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Buscar todos os itens
function buscarItens() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM itens ORDER BY nome`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Buscar item por ID
function buscarItemPorId(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM itens WHERE id = ?`;
        
        db.get(sql, [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Atualizar quantidade do item
function atualizarQuantidade(id, novaQuantidade) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE itens SET quantidade = ? WHERE id = ?`;
        
        db.run(sql, [novaQuantidade, id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Remover item
function removerItem(id) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM itens WHERE id = ?`;
        
        db.run(sql, [id], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Inserir movimentação
function inserirMovimentacao(movimentacao) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO movimentacoes (item_id, item_nome, tipo, quantidade, destino, descricao)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [
            movimentacao.itemId, movimentacao.itemNome, movimentacao.tipo,
            movimentacao.quantidade, movimentacao.destino, movimentacao.descricao
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Buscar movimentações por período
function buscarMovimentacoes(dias = 30) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM movimentacoes 
            WHERE data >= datetime('now', '-${dias} days')
            ORDER BY data DESC
        `;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Função utilitária para executar comandos SQL genéricos (como DELETE)
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// Fechar conexão
function fecharConexao() {
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco:', err.message);
        } else {
            console.log('Conexão com banco fechada.');
        }
    });
}

// Verificar estado do banco de dados
function verificarBanco() {
    return new Promise((resolve, reject) => {
        db.get("PRAGMA integrity_check", [], (err, result) => {
            if (err) {
                console.error("Erro ao verificar integridade do banco:", err.message);
                reject(err);
            } else {
                if (result.integrity_check === 'ok') {
                    console.log("Banco de dados íntegro e pronto para uso");
                    resolve(true);
                } else {
                    console.warn("Problemas de integridade no banco:", result.integrity_check);
                    resolve(false);
                }
            }
        });
    });
}

// Funções para exportar e importar dados (para sincronização entre diferentes máquinas)
async function exportarDados() {
    try {
        // Exportar tabela de itens
        const itens = await buscarItens();
        
        // Exportar tabela de movimentações (últimos 365 dias para não ficar muito grande)
        const movimentacoes = await buscarMovimentacoes(365);
        
        return {
            itens,
            movimentacoes,
            timestamp: new Date().toISOString(),
            versao: '1.0'
        };
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        throw error;
    }
}

async function importarDados(dados) {
    if (!dados || !dados.itens) {
        throw new Error('Dados inválidos para importação');
    }
    
    try {
        // Iniciar transação para garantir atomicidade da operação
        await run('BEGIN TRANSACTION');
        
        // Limpar tabelas existentes
        await run('DELETE FROM movimentacoes');
        await run('DELETE FROM itens');
        
        // Inserir itens
        for (const item of dados.itens) {
            // Remover o ID para evitar conflitos com a sequência do autoincrement
            const { id, data_cadastro, ...itemSemId } = item;
            await inserirItem(itemSemId);
        }
        
        // Inserir movimentações, se existirem
        if (dados.movimentacoes && Array.isArray(dados.movimentacoes)) {
            for (const mov of dados.movimentacoes) {
                // Formatar dados para inserção
                const movimentacao = {
                    itemId: mov.item_id,
                    itemNome: mov.item_nome,
                    tipo: mov.tipo,
                    quantidade: mov.quantidade,
                    destino: mov.destino,
                    descricao: mov.descricao
                };
                
                await inserirMovimentacao(movimentacao);
            }
        }
        
        // Confirmar transação
        await run('COMMIT');
        
        return {
            sucesso: true,
            itensImportados: dados.itens.length,
            movimentacoesImportadas: dados.movimentacoes ? dados.movimentacoes.length : 0
        };
    } catch (error) {
        // Reverter alterações em caso de erro
        await run('ROLLBACK');
        console.error('Erro ao importar dados:', error);
        throw error;
    }
}

module.exports = {
    inserirItem,
    buscarItens,
    buscarItemPorId,
    atualizarQuantidade,
    removerItem,
    inserirMovimentacao,
    buscarMovimentacoes,
    fecharConexao,
    verificarBanco,
    run, // Exporta função utilitária
    exportarDados,
    importarDados
};