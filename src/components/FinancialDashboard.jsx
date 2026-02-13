import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, ShoppingBag, PieChart, Save } from 'lucide-react';

const FinancialDashboard = () => {
    const [metrics, setMetrics] = useState({
        adSpend: 0,
        totalSales: 0,
        salesCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFinancials();
    }, []);

    const fetchFinancials = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/financials');
            const data = await response.json();
            setMetrics(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching financials:', error);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/financials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metrics)
            });
            const data = await response.json();
            if (data.success) {
                alert('Dados financeiros atualizados! 🚀');
            }
        } catch (error) {
            console.error('Error saving financials:', error);
            alert('Erro ao salvar dados.');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setMetrics(prev => ({
            ...prev,
            [name]: parseFloat(value) || 0
        }));
    };

    // Calculations
    const netRevenue = metrics.totalSales - metrics.adSpend;
    const roi = metrics.adSpend > 0 ? ((netRevenue / metrics.adSpend) * 100).toFixed(2) : 0;
    const cpa = metrics.salesCount > 0 ? (metrics.adSpend / metrics.salesCount).toFixed(2) : 0;
    const averageTicket = metrics.salesCount > 0 ? (metrics.totalSales / metrics.salesCount).toFixed(2) : 0;

    return (
        <div className="flex-1 h-full bg-[#0a0a0a] text-white p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 neon-text">Gestão Financeira</h1>
                        <p className="text-gray-400">Acompanhe o ROI e métricas de performance.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] font-medium"
                    >
                        <Save size={20} />
                        Salvar Dados
                    </button>
                </header>

                {/* Input Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm">
                        <label className="block text-gray-400 text-sm font-medium mb-2">Gasto com Anúncios (R$)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="number"
                                name="adSpend"
                                value={metrics.adSpend}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-lg"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm">
                        <label className="block text-gray-400 text-sm font-medium mb-2">Faturamento Total (R$)</label>
                        <div className="relative">
                            <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-500" size={18} />
                            <input
                                type="number"
                                name="totalSales"
                                value={metrics.totalSales}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-green-500 transition-colors text-lg"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl backdrop-blur-sm">
                        <label className="block text-gray-400 text-sm font-medium mb-2">Quantidade de Vendas</label>
                        <div className="relative">
                            <ShoppingBag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-500" size={18} />
                            <input
                                type="number"
                                name="salesCount"
                                value={metrics.salesCount}
                                onChange={handleChange}
                                className="w-full bg-gray-950 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-purple-500 transition-colors text-lg"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* ROI Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <PieChart size={64} className="text-blue-500" />
                        </div>
                        <h3 className="text-gray-400 font-medium mb-1">ROI (Retorno)</h3>
                        <p className={`text-4xl font-bold ${parseFloat(roi) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            {roi}%
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Retorno sobre investimento</p>
                    </div>

                    {/* Net Revenue Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl relative overflow-hidden group hover:border-green-500/50 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <DollarSign size={64} className="text-green-500" />
                        </div>
                        <h3 className="text-gray-400 font-medium mb-1">Lucro Líquido</h3>
                        <p className={`text-4xl font-bold ${netRevenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            R$ {netRevenue.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Faturamento - Gastos</p>
                    </div>

                    {/* CPA Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl relative overflow-hidden group hover:border-yellow-500/50 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShoppingBag size={64} className="text-yellow-500" />
                        </div>
                        <h3 className="text-gray-400 font-medium mb-1">CPA</h3>
                        <p className="text-4xl font-bold text-yellow-400">
                            R$ {cpa}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Custo por Aquisição</p>
                    </div>

                    {/* Average Ticket Card */}
                    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl relative overflow-hidden group hover:border-purple-500/50 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingUp size={64} className="text-purple-500" />
                        </div>
                        <h3 className="text-gray-400 font-medium mb-1">Ticket Médio</h3>
                        <p className="text-4xl font-bold text-purple-400">
                            R$ {averageTicket}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">Média por venda</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancialDashboard;
