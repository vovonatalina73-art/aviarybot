import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Search, MessageSquare, User } from 'lucide-react';
import { API_URL } from '../config';

const LeadsDashboard = () => {
    const [leads, setLeads] = useState([]);
    const [filter, setFilter] = useState('all'); // all, in_progress, completed
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLeads();
        const interval = setInterval(fetchLeads, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchLeads = async () => {
        try {
            const response = await fetch(`${API_URL}/api/leads`);
            const data = await response.json();
            // Sort by last interaction (newest first)
            const sorted = data.sort((a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction));
            setLeads(sorted);
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    };

    const toggleStatus = async (chatId, currentStatus) => {
        const newStatus = currentStatus === 'completed' ? 'in_progress' : 'completed';

        // Optimistic update
        setLeads(leads.map(l => l.chatId === chatId ? { ...l, status: newStatus } : l));

        try {
            await fetch(`${API_URL}/api/leads/${chatId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (error) {
            console.error('Error updating status:', error);
            fetchLeads(); // Revert on error
        }
    };

    const filteredLeads = leads.filter(lead => {
        const matchesFilter = filter === 'all' || lead.status === filter;
        const matchesSearch = lead.phone.includes(searchTerm) || (lead.lastMessage && lead.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const stats = {
        total: leads.length,
        in_progress: leads.filter(l => l.status === 'in_progress').length,
        completed: leads.filter(l => l.status === 'completed').length
    };

    return (
        <div className="flex-1 h-full bg-[#0a0a0a] text-white p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 neon-text">Gestão de Leads</h1>
                    <p className="text-gray-400">Acompanhe as conversas e gerencie o status dos atendimentos.</p>
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-400 font-medium">Total de Leads</h3>
                            <User className="text-blue-500" size={24} />
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.total}</p>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-400 font-medium">Em Andamento</h3>
                            <Clock className="text-yellow-500" size={24} />
                        </div>
                        <p className="text-3xl font-bold text-yellow-500">{stats.in_progress}</p>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-400 font-medium">Concluídos</h3>
                            <CheckCircle className="text-green-500" size={24} />
                        </div>
                        <p className="text-3xl font-bold text-green-500">{stats.completed}</p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center bg-gray-900/30 p-4 rounded-lg border border-gray-800">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilter('in_progress')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'in_progress' ? 'bg-yellow-600/20 text-yellow-500 border border-yellow-600/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Em Andamento
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'completed' ? 'bg-green-600/20 text-green-500 border border-green-600/50' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Concluídos
                        </button>
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar telefone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Leads List */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-950 border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                                    <th className="p-4 font-medium">Telefone</th>
                                    <th className="p-4 font-medium">Última Mensagem</th>
                                    <th className="p-4 font-medium">Data/Hora</th>
                                    <th className="p-4 font-medium text-center">Status</th>
                                    <th className="p-4 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {filteredLeads.length > 0 ? (
                                    filteredLeads.map((lead) => (
                                        <tr key={lead.chatId} className="hover:bg-gray-800/50 transition-colors group">
                                            <td className="p-4 font-medium text-white">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                                                        <User size={16} />
                                                    </div>
                                                    {lead.phone}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-300 max-w-xs truncate">
                                                {lead.lastMessage || <span className="text-gray-600 italic">Sem mensagem</span>}
                                            </td>
                                            <td className="p-4 text-gray-400 text-sm">
                                                {new Date(lead.lastInteraction).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${lead.status === 'completed'
                                                    ? 'bg-green-900/20 text-green-400 border-green-900/50'
                                                    : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'
                                                    }`}>
                                                    {lead.status === 'completed' ? 'Concluído' : 'Em Andamento'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Disparar fluxo para ${lead.phone}?`)) {
                                                                try {
                                                                    await fetch(`${API_URL}/api/trigger-flow`, {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ chatId: lead.chatId })
                                                                    });
                                                                    alert('Fluxo disparado!');
                                                                } catch (err) {
                                                                    alert('Erro ao disparar fluxo');
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all"
                                                        title="Disparar Fluxo Agora"
                                                    >
                                                        <MessageSquare size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleStatus(lead.chatId, lead.status)}
                                                        className={`p-2 rounded-lg transition-all ${lead.status === 'completed'
                                                            ? 'bg-gray-800 text-gray-400 hover:bg-yellow-900/20 hover:text-yellow-400'
                                                            : 'bg-green-600 text-white hover:bg-green-500 shadow-[0_0_10px_rgba(57,255,20,0.2)]'
                                                            }`}
                                                        title={lead.status === 'completed' ? "Reabrir conversa" : "Concluir conversa"}
                                                    >
                                                        {lead.status === 'completed' ? <Clock size={18} /> : <CheckCircle size={18} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <MessageSquare size={48} className="text-gray-700" />
                                                <p>Nenhum lead encontrado.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadsDashboard;
