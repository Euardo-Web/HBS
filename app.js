// Log para garantir que o app.js foi carregado corretamente
console.log('app.js carregado');

// Configuração da API
const API_URL = 'http://localhost:3000/api';

// Variáveis globais
let itens = [];
let movimentacoes = [];

// Funções para chamadas da API
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_URL}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

// Carregar dados da API
async function carregarDados() {
    try {
        itens = await apiRequest('/itens');
        movimentacoes = await apiRequest('/movimentacoes');
    } catch (error) {
        alert('Erro ao carregar dados: ' + error.message);
    }
}

// Navegação entre seções
function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    const buttons = document.querySelectorAll('.nav-btn');
    
    sections.forEach(section => section.classList.remove('active'));
    buttons.forEach(button => button.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
    
    // Atualizar dados específicos da seção
    if (sectionId === 'estoque') {
        atualizarControleEstoque();
    } else if (sectionId === 'retirada') {
        atualizarSelectRetirada();
    } else if (sectionId === 'relatorio1') {
        gerarRelatorioEstoque();
    } else if (sectionId === 'relatorio2') {
        gerarRelatorioMovimentacao();
    }
}

// Cadastro de item
document.getElementById('itemForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const item = {
        nome: document.getElementById('nome').value.trim(),
        serie: document.getElementById('serie').value.trim(),
        descricao: document.getElementById('descricao').value.trim(),
        origem: document.getElementById('origem').value.trim(),
        destino: document.getElementById('destino').value.trim(),
        valor: parseFloat(document.getElementById('valor').value) || 0,
        nf: document.getElementById('nf').value.trim(),
        quantidade: parseInt(document.getElementById('quantidade').value),
        minimo: parseInt(document.getElementById('minimo').value),
        ideal: parseInt(document.getElementById('ideal').value),
        infos: document.getElementById('infos').value.trim()
    };
    
    try {
        await apiRequest('/itens', 'POST', item);
        alert('Item cadastrado com sucesso!');
        limparFormulario();
        await carregarDados();
    } catch (error) {
        alert('Erro ao cadastrar item: ' + error.message);
    }
});

function limparFormulario() {
    document.getElementById('itemForm').reset();
}

// Controle de estoque
async function atualizarControleEstoque() {
    await carregarDados();
    filtrarEstoque();
    const alertas = document.getElementById('alertas');
    let itensAbaixoMinimo = itens.filter(item => item.quantidade < item.minimo);
    let itensAbaixoIdeal = itens.filter(item => item.quantidade < item.ideal);
    let alertasTexto = [];
    itensAbaixoMinimo.forEach(item => {
        alertasTexto.push(`${item.nome} está abaixo do mínimo (${item.quantidade}/${item.minimo})`);
    });
    document.getElementById('totalItens').textContent = itens.length;
    document.getElementById('itensAbaixoMinimo').textContent = itensAbaixoMinimo.length;
    document.getElementById('itensAbaixoIdeal').textContent = itensAbaixoIdeal.length;
    if (alertasTexto.length > 0) {
        alertas.innerHTML = `
            <div class="alert alert-warning">
                <strong>Alertas de Estoque:</strong><br>
                ${alertasTexto.join('<br>')}
            </div>
        `;
    } else {
        alertas.innerHTML = '';
    }
}

// Filtro e pesquisa no controle de estoque
function filtrarEstoque() {
    const pesquisa = document.getElementById('pesquisaEstoque').value.toLowerCase();
    const statusFiltro = document.getElementById('filtroStatus').value;
    const ordenacao = document.getElementById('ordenacao').value;
    let itensFiltrados = itens.filter(item => {
        let nomeMatch = item.nome && item.nome.toLowerCase().includes(pesquisa);
        let wbsMatch = item.serie && item.serie.toLowerCase().includes(pesquisa);
        let status = 'ideal';
        if (item.quantidade < item.minimo) status = 'abaixo-minimo';
        else if (item.quantidade < item.ideal) status = 'abaixo-ideal';
        let statusMatch = !statusFiltro || status === statusFiltro;
        return (nomeMatch || wbsMatch) && statusMatch;
    });
    // Ordenação
    if (ordenacao === 'nome') {
        itensFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (ordenacao === 'quantidade') {
        itensFiltrados.sort((a, b) => b.quantidade - a.quantidade);
    } else if (ordenacao === 'status') {
        itensFiltrados.sort((a, b) => {
            let getStatus = x => (x.quantidade < x.minimo) ? 0 : (x.quantidade < x.ideal) ? 1 : 2;
            return getStatus(a) - getStatus(b);
        });
    }
    // Atualiza tabela
    const tbody = document.querySelector('#tabelaEstoque tbody');
    tbody.innerHTML = '';
    itensFiltrados.forEach(item => {
        const row = tbody.insertRow();
        let status = 'Ideal';
        let statusClass = 'status-ideal';
        if (item.quantidade < item.minimo) {
            status = 'Abaixo do Mínimo';
            statusClass = 'status-baixo';
        } else if (item.quantidade < item.ideal) {
            status = 'Abaixo do Ideal';
            statusClass = 'status-baixo';
        }
        row.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.serie || '-'}</td>
            <td>${item.quantidade}</td>
            <td>${item.minimo}</td>
            <td>${item.ideal}</td>
            <td><span class="${statusClass}">${status}</span></td>
            <td>
                <button class="btn" onclick="abrirModalEstoque(${item.id});event.stopPropagation();">+ Estoque</button>
                <button class="btn btn-danger" onclick="removerItem(${item.id});event.stopPropagation();">Remover</button>
            </td>
        `;
        row.style.cursor = 'pointer';
        row.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            abrirModalEditarItem(item.id);
        });
    });
}

// Modal para adicionar estoque
function abrirModalEstoque(itemId) {
    document.getElementById('itemIdModal').value = itemId;
    document.getElementById('modalEstoque').style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalEstoque').style.display = 'none';
    document.getElementById('adicionarEstoqueForm').reset();
}

// Adicionar estoque
document.getElementById('adicionarEstoqueForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('itemIdModal').value;
    const quantidade = parseInt(document.getElementById('quantidadeAdicionar').value);
    const observacao = document.getElementById('observacaoAdicionar').value;
    
    try {
        await apiRequest(`/itens/${itemId}/adicionar`, 'POST', {
            quantidade: quantidade,
            observacao: observacao
        });
        
        alert('Estoque adicionado com sucesso!');
        fecharModal();
        await atualizarControleEstoque();
    } catch (error) {
        alert('Erro ao adicionar estoque: ' + error.message);
    }
});

// Remover item
async function removerItem(itemId) {
    if (confirm('Tem certeza que deseja remover este item?')) {
        try {
            await apiRequest(`/itens/${itemId}`, 'DELETE');
            alert('Item removido com sucesso!');
            await atualizarControleEstoque();
        } catch (error) {
            alert('Erro ao remover item: ' + error.message);
        }
    }
}

// Retirada de itens
async function atualizarSelectRetirada() {
    await carregarDados();
    
    const select = document.getElementById('itemRetirada');
    select.innerHTML = '<option value="">Selecione um item...</option>';
    
    itens.forEach(item => {
        if (item.quantidade > 0) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.nome} (Disponível: ${item.quantidade})`;
            select.appendChild(option);
        }
    });
}

document.getElementById('retiradaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('itemRetirada').value;
    const quantidade = parseInt(document.getElementById('quantidadeRetirada').value);
    const destino = document.getElementById('destinoRetirada').value;
    const observacao = document.getElementById('observacaoRetirada').value;
    
    try {
        await apiRequest(`/itens/${itemId}/retirar`, 'POST', {
            quantidade: quantidade,
            destino: destino,
            observacao: observacao
        });
        
        alert('Retirada realizada com sucesso!');
        document.getElementById('retiradaForm').reset();
        await atualizarSelectRetirada();
    } catch (error) {
        alert('Erro ao realizar retirada: ' + error.message);
    }
});

// Relatório de estoque
async function gerarRelatorioEstoque() {
    await carregarDados();
    
    const container = document.getElementById('relatorioEstoque');
    
    const itensAbaixoMinimo = itens.filter(item => item.quantidade < item.minimo);
    const itensAbaixoIdeal = itens.filter(item => item.quantidade < item.ideal);
    
    let html = '<h3>Itens Abaixo do Estoque Mínimo</h3>';
    
    if (itensAbaixoMinimo.length > 0) {
        html += `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Atual</th>
                            <th>Mínimo</th>
                            <th>Falta</th>
                            <th>Ideal</th>
                            <th>Para Ideal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        itensAbaixoMinimo.forEach(item => {
            const faltaMinimo = item.minimo - item.quantidade;
            const faltaIdeal = item.ideal - item.quantidade;
            
            html += `
                <tr>
                    <td>${item.nome}</td>
                    <td>${item.quantidade}</td>
                    <td>${item.minimo}</td>
                    <td>${faltaMinimo}</td>
                    <td>${item.ideal}</td>
                    <td>${faltaIdeal}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
    } else {
        html += '<div class="alert alert-info">Nenhum item abaixo do estoque mínimo.</div>';
    }
    
    container.innerHTML = html;
}

// Relatório de movimentação
async function gerarRelatorioMovimentacao() {
    const filtro = document.getElementById('filtroData').value;
    
    try {
        movimentacoes = await apiRequest(`/movimentacoes?dias=${filtro}`);
        
        const container = document.getElementById('relatorioMovimentacao');
        
        // Estatísticas do período
        const entradas = movimentacoes.filter(mov => mov.tipo === 'entrada');
        const saidas = movimentacoes.filter(mov => mov.tipo === 'saida');
        
        const totalEntradas = entradas.reduce((sum, mov) => sum + mov.quantidade, 0);
        const totalSaidas = saidas.reduce((sum, mov) => sum + mov.quantidade, 0);
        
        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalEntradas}</div>
                    <div class="stat-label">Itens Adicionados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalSaidas}</div>
                    <div class="stat-label">Itens Retirados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${movimentacoes.length}</div>
                    <div class="stat-label">Total de Movimentações</div>
                </div>
            </div>
            
            <h3>Movimentações dos Últimos ${filtro} dias</h3>
        `;
        
        if (movimentacoes.length > 0) {
            html += `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Item</th>
                                <th>Tipo</th>
                                <th>Quantidade</th>
                                <th>Destino/Origem</th>
                                <th>Descrição</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            movimentacoes.forEach(mov => {
                const data = new Date(mov.data).toLocaleDateString('pt-BR');
                const hora = new Date(mov.data).toLocaleTimeString('pt-BR');
                const tipoClass = mov.tipo === 'entrada' ? 'status-ideal' : 'status-baixo';
                const tipoTexto = mov.tipo === 'entrada' ? 'Entrada' : 'Saída';
                
                html += `
                    <tr>
                        <td>${data} ${hora}</td>
                        <td>${mov.item_nome}</td>
                        <td><span class="${tipoClass}">${tipoTexto}</span></td>
                        <td>${mov.quantidade}</td>
                        <td>${mov.destino || '-'}</td>
                        <td>${mov.descricao || '-'}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
        } else {
            html += '<div class="alert alert-info">Nenhuma movimentação encontrada no período selecionado.</div>';
        }
        
        container.innerHTML = html;
    } catch (error) {
        alert('Erro ao gerar relatório: ' + error.message);
    }
}

// Função para importar planilha de EPIs (CSV/XLSX)
window.importarPlanilhaEPI = async function(event) {
    try {
        console.log('Função importarPlanilhaEPI chamada');
        const file = event.target.files[0];
        if (!file) {
            alert('Nenhum arquivo selecionado!');
            return;
        }
        const reader = new FileReader();
        reader.onload = async function(e) {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, {type: 'array'});
            let firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            let json = XLSX.utils.sheet_to_json(firstSheet, {defval: ''});
            console.log('Planilha lida:', json);
            if (!json.length) {
                alert('Nenhum dado encontrado na planilha.');
                return;
            }
            let sucesso = 0;
            let falha = 0;
            let erros = [];
            let nomesSucesso = [];
            // Campos padrão do banco
            const camposPadrao = [
                'nome', 'Nome', 'Nome do Item',
                'serie', 'Serie', 'Código',
                'descricao', 'Descrição',
                'origem', 'Origem',
                'destino', 'Destino',
                'valor', 'Valor',
                'nf', 'Nota Fiscal',
                'quantidade', 'Quantidade',
                'minimo', 'Quantidade Mínima',
                'ideal', 'Quantidade Ideal',
                'infos', 'Informações Adicionais'
            ];
            for (const item of json) {
                // Mapeamento especial para planilhas do modelo fornecido
                const nomePlanilha = item["Descrição Material Atendido"] || '';
                const wbsPlanilha = item["WBS"] || item["Wbs"] || item["wbs"] || '';
                const seriePlanilha = wbsPlanilha || item["Cod. Material Atendido"] || '';
                const quantidadePlanilha = item["Qtd. Atendida"] || '';
                const novoItem = {
                    nome: nomePlanilha || item.nome || item.Nome || item["Nome do Item"] || '',
                    serie: seriePlanilha || item.serie || item.Serie || item["Código"] || '',
                    descricao: item.descricao || item["Descrição"] || '',
                    origem: item.origem || item.Origem || '',
                    destino: item.destino || item.Destino || '',
                    valor: parseFloat(item.valor || item.Valor || 0) || 0,
                    nf: item.nf || item["Nota Fiscal"] || '',
                    quantidade: parseInt(item.quantidade || item.Quantidade || quantidadePlanilha || 0) || 0,
                    minimo: parseInt(item.minimo || item["Quantidade Mínima"] || 0) || 0,
                    ideal: parseInt(item.ideal || item["Quantidade Ideal"] || 0) || 0,
                    infos: item.infos || item["Informações Adicionais"] || ''
                };
                // Adiciona todos os campos extras em infos (inclusive vazios)
                let extras = [];
                for (const key in item) {
                    if (!camposPadrao.includes(key)) {
                        let valor = item[key];
                        extras.push(`${key}: ${valor}`);
                    }
                }
                if (extras.length > 0) {
                    novoItem.infos = (novoItem.infos ? novoItem.infos + '; ' : '') + extras.join('; ');
                }
                if (!novoItem.nome) {
                    falha++;
                    erros.push('Linha sem nome, ignorada.');
                    continue;
                }
                // NOVO: Verifica duplicidade por nome+serie (WBS)
                const existente = itens.find(i => i.nome === novoItem.nome && i.serie === novoItem.serie);
                if (existente) {
                    // Atualiza quantidade do item existente
                    try {
                        const novaQtd = (parseInt(existente.quantidade) || 0) + (parseInt(novoItem.quantidade) || 0);
                        const atualizado = { ...existente, quantidade: novaQtd };
                        const resp = await apiRequest(`/itens/${existente.id}`, 'PUT', atualizado);
                        if (resp && resp.id) {
                            sucesso++;
                            nomesSucesso.push(novoItem.nome + ' (unido)');
                        } else {
                            falha++;
                            erros.push(`Erro ao unir: ${novoItem.nome} - ${resp && resp.error ? resp.error : 'Erro desconhecido'}`);
                        }
                    } catch (err) {
                        falha++;
                        erros.push(`Erro ao unir: ${novoItem.nome} - ${err.message}`);
                    }
                    continue;
                }
                try {
                    const resp = await apiRequest('/itens', 'POST', novoItem);
                    if (resp && resp.id) {
                        sucesso++;
                        nomesSucesso.push(novoItem.nome);
                    } else {
                        falha++;
                        erros.push(`Erro ao importar: ${novoItem.nome} - ${resp && resp.error ? resp.error : 'Erro desconhecido'}`);
                    }
                } catch (err) {
                    falha++;
                    erros.push(`Erro ao importar: ${novoItem.nome} - ${err.message}`);
                }
            }
            let msg = `Importação concluída! Sucesso: ${sucesso}, Falha: ${falha}`;
            if (nomesSucesso.length > 0) msg += '\nItens importados: ' + nomesSucesso.join(', ');
            if (erros.length > 0) msg += '\n' + erros.join('\n');
            if (sucesso === 0 && falha === 0) msg += '\nNenhum item válido encontrado na planilha.';
            alert(msg);
            await carregarDados();
            await atualizarControleEstoque();
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        alert('Erro inesperado na importação: ' + e.message);
        console.error(e);
    }
};

// Modal editar item
function abrirModalEditarItem(itemId) {
    const item = itens.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('editarItemId').value = item.id;
    document.getElementById('editarNome').value = item.nome || '';
    document.getElementById('editarSerie').value = item.serie || '';
    document.getElementById('editarDescricao').value = item.descricao || '';
    document.getElementById('editarOrigem').value = item.origem || '';
    document.getElementById('editarDestino').value = item.destino || '';
    document.getElementById('editarValor').value = item.valor || '';
    document.getElementById('editarNF').value = item.nf || '';
    document.getElementById('editarQuantidade').value = item.quantidade || 0;
    document.getElementById('editarMinimo').value = item.minimo || 0;
    document.getElementById('editarIdeal').value = item.ideal || 0;
    document.getElementById('editarInfos').value = item.infos || '';
    document.getElementById('modalEditarItem').style.display = 'block';
}
function fecharModalEditarItem() {
    document.getElementById('modalEditarItem').style.display = 'none';
    document.getElementById('editarItemForm').reset();
}
// Salvar edição do item

document.getElementById('editarItemForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('editarItemId').value;
    const itemEditado = {
        nome: document.getElementById('editarNome').value.trim(),
        serie: document.getElementById('editarSerie').value.trim(),
        descricao: document.getElementById('editarDescricao').value.trim(),
        origem: document.getElementById('editarOrigem').value.trim(),
        destino: document.getElementById('editarDestino').value.trim(),
        valor: parseFloat(document.getElementById('editarValor').value) || 0,
        nf: document.getElementById('editarNF').value.trim(),
        quantidade: parseInt(document.getElementById('editarQuantidade').value),
        minimo: parseInt(document.getElementById('editarMinimo').value),
        ideal: parseInt(document.getElementById('editarIdeal').value),
        infos: document.getElementById('editarInfos').value.trim()
    };
    try {
        await apiRequest(`/itens/${id}`, 'PUT', itemEditado);
        alert('Item atualizado com sucesso!');
        fecharModalEditarItem();
        await atualizarControleEstoque();
    } catch (error) {
        alert('Erro ao atualizar item: ' + error.message);
    }
});

// Unificar itens duplicados via botão
window.unificarItensDuplicados = async function() {
    if (!confirm('Deseja realmente unificar todos os itens duplicados? Esta ação não pode ser desfeita.')) return;
    try {
        const resp = await fetch(API_URL + '/unificar-itens', { method: 'POST' });
        const contentType = resp.headers.get('content-type');
        let data;
        if (resp.ok) {
            if (contentType && contentType.includes('application/json')) {
                data = await resp.json();
            } else {
                throw new Error('Resposta inesperada do servidor');
            }
            alert('Itens duplicados unificados com sucesso! Total de itens únicos: ' + data.total);
            await carregarDados();
            await atualizarControleEstoque();
        } else {
            // Tenta extrair mensagem de erro do JSON, se possível
            if (contentType && contentType.includes('application/json')) {
                const erro = await resp.json();
                alert('Erro ao unificar itens: ' + (erro.error || resp.status));
            } else {
                const text = await resp.text();
                alert('Erro ao unificar itens: ' + (text || resp.status));
            }
        }
    } catch (e) {
        alert('Erro inesperado ao unificar itens: ' + e.message);
    }
};

// Inicializar o sistema
document.addEventListener('DOMContentLoaded', async function() {
    await carregarDados();
    await atualizarControleEstoque();
    await atualizarSelectRetirada();
    await gerarRelatorioEstoque();
    await gerarRelatorioMovimentacao();
});

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById('modalEstoque');
    if (event.target == modal) {
        fecharModal();
    }
}