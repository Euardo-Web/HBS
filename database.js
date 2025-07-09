const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Criar conexão com o banco de dados
const dbPath = path.join(__dirname, 'estoque.db');
const db = new sqlite3.Database(dbPath);

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

module.exports = {
    inserirItem,
    buscarItens,
    buscarItemPorId,
    atualizarQuantidade,
    removerItem,
    inserirMovimentacao,
    buscarMovimentacoes,
    fecharConexao,
    run // Exporta função utilitária
};