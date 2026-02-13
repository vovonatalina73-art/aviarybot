import mongoose from 'mongoose';

const FinancialSchema = new mongoose.Schema({
    adSpend: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 }
}, { timestamps: true });

export const Financial = mongoose.model('Financial', FinancialSchema);
