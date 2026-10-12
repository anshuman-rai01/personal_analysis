import React, { useEffect, useState } from 'react';
import {
  Coins,
  Plus,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Trash2,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Database
} from 'lucide-react';
import { FinanceTransaction } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch, getLocalDateString } from '../../lib/apiClient.ts';
import { AlertBanner } from '../common/AlertBanner.tsx';

export const FinanceView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Input form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'investment' | 'savings'>('expense');
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [date, setDate] = useState(() => getLocalDateString());
  const [notes, setNotes] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<FinanceTransaction[]>('/api/finance', {
        headers: getAuthHeaders(),
      });
      setTransactions(data);
    } catch (e: any) {
      console.error('Failed to load transactions:', e);
      setError(e.message || 'Failed to load finance records from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    setError(null);
    setSubmitting(true);
    try {
      const newRecord = await apiFetch<FinanceTransaction>('/api/finance', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          type,
          category,
          amount: parseFloat(amount),
          paymentMethod,
          date,
          notes: notes.trim(),
        }),
      });

      setTransactions([newRecord, ...transactions]);
      setTitle('');
      setAmount('');
      setNotes('');
    } catch (err: any) {
      console.error('Failed to create finance transaction:', err);
      setError(err.message || 'Failed to create finance transaction in database.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/finance/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (err: any) {
      console.error('Failed to delete transaction:', err);
      setError(err.message || 'Failed to delete transaction from database.');
    }
  };

  // Metrics
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const totalInvested = transactions
    .filter((t) => t.type === 'investment' || t.type === 'savings')
    .reduce((acc, t) => acc + t.amount, 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  // Filtered transactions
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-950 flex items-center gap-2">
          <Coins className="w-6 h-6 text-pink-600" />
          <span>Money &amp; Finance Management</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Track money inflows, outflows, compounding investments, and savings rates stored in PostgreSQL.
        </p>
      </div>

      {error && (
        <AlertBanner
          message="Database operation failed"
          details={error}
          variant="error"
          onDismiss={() => setError(null)}
          action={{
            label: 'Retry Loading',
            onClick: () => {
              setError(null);
              fetchTransactions();
            },
          }}
        />
      )}

      {/* Money KPIs in White, Purple & Pink */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-purple-700 font-bold">
            <span>Total Money Inflow</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-purple-950 mt-1">Money {totalIncome.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Recorded earnings</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-pink-600 font-bold">
            <span>Total Money Spent</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-pink-600 mt-1">Money {totalExpenses.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Expenses &amp; costs</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-fuchsia-600 font-bold">
            <span>Invested &amp; Saved Money</span>
            <PiggyBank className="w-4 h-4 text-fuchsia-500" />
          </div>
          <p className="text-2xl font-black text-fuchsia-900 mt-1">Money {totalInvested.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Compounding capital</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-purple-800 font-bold">
            <span>Net Money Savings</span>
            <span className="text-xs font-black text-pink-600">{savingsRate}% Rate</span>
          </div>
          <p className="text-2xl font-black text-purple-900 mt-1">Money {netSavings.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            {savingsRate >= 20 ? 'Optimal wealth velocity' : 'Healthy liquidity'}
          </p>
        </div>
      </div>

      {/* Input Form in White, Purple & Pink */}
      <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base font-bold text-purple-950 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-pink-600" />
          <span>Record Money Transaction</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Description</label>
              <input
                type="text"
                placeholder="e.g., Consulting Stipend, Cloud Servers, Groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
              >
                <option value="expense">Expense (Outflow)</option>
                <option value="income">Income (Earnings)</option>
                <option value="investment">Investment (Assets)</option>
                <option value="savings">Savings (Reserves)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (Money)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                placeholder="e.g., 250.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
              >
                <option value="Food">Food &amp; Dining</option>
                <option value="Housing">Housing &amp; Utilities</option>
                <option value="Education">Education &amp; Books</option>
                <option value="Tech">Tech &amp; Subscriptions</option>
                <option value="Salary">Salary &amp; Wages</option>
                <option value="Investment">Investment &amp; Stocks</option>
                <option value="Savings">Savings Reserve</option>
                <option value="Transport">Transport &amp; Travel</option>
                <option value="Health">Health &amp; Wellness</option>
                <option value="General">General / Misc</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
              >
                <option value="Bank Transfer">Bank Transfer / ACH</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Crypto">Crypto</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Context (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Automatic deposit from engineering retainer."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving to Database...' : 'Save Money Record'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search descriptions, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-purple-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-purple-100 rounded-lg text-slate-700 focus:outline-none focus:border-pink-500"
          >
            <option value="all">All Types ({transactions.length})</option>
            <option value="income">Income Only</option>
            <option value="expense">Expenses Only</option>
            <option value="investment">Investments Only</option>
            <option value="savings">Savings Only</option>
          </select>
        </div>
      </div>

      {/* Transactions Records List */}
      <div className="bg-white border border-purple-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-purple-50 flex items-center justify-between bg-purple-50/40">
          <h3 className="text-sm font-bold text-purple-950">Financial Money Ledger</h3>
          <span className="text-xs text-purple-700 font-mono font-semibold">
            Showing {filtered.length} record(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading ledger from PostgreSQL...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No transactions found. Add a new money record above!
          </div>
        ) : (
          <div className="divide-y divide-purple-50">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-purple-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-purple-950">{item.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded font-mono bg-purple-100 text-purple-800">
                      {item.category}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-100 text-slate-600">
                      {item.paymentMethod}
                    </span>
                  </div>

                  {item.notes && <p className="text-xs text-slate-500 italic">"{item.notes}"</p>}
                  <p className="text-[11px] text-slate-400">Date: {item.date}</p>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-5">
                  <div className="text-right">
                    <span
                      className={`text-base font-black ${
                        item.type === 'income'
                          ? 'text-purple-700'
                          : item.type === 'investment' || item.type === 'savings'
                          ? 'text-fuchsia-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {item.type === 'income' ? '+' : '-'}Money {item.amount.toLocaleString()}
                    </span>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {item.type}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
