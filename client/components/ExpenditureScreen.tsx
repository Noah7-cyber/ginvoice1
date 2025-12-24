import React, { useMemo, useState } from 'react';
import { Expenditure } from '../types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  expenditures: Expenditure[] | undefined;
  onUpdateExpenditures: (items: Expenditure[]) => void;
  isOwner?: boolean;
  staffId?: string;
}

const defaultCategoryOptions = ['Personal', 'Supplies', 'Travel', 'Utilities', 'Other'];

function sumBetween(items: Expenditure[], since: Date) {
  return items
    .filter(i => new Date(i.date) >= since)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

function generateSparklineData(items: Expenditure[], days: number) {
  // returns array of daily totals for the last `days` days (oldest -> newest)
  const now = new Date();
  const arr: number[] = Array.from({ length: days }).map(() => 0);
  items.forEach(i => {
    const d = new Date(i.date);
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
    if (diff >= 0 && diff < days) {
      arr[days - 1 - diff] += Number(i.amount) || 0;
    }
  });
  return arr;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return <svg width="100" height="30" />;
  const w = 100, h = 30;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1 || 1);
  const pts = data.map((d, i) => `${i * step},${h - (d / max) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="block">
      <polyline fill="none" stroke="#4f46e5" strokeWidth="2" points={pts} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ExpenditureScreen({ expenditures = [], onUpdateExpenditures, isOwner }: Props) {
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>(defaultCategoryOptions[0]);
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const start7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); // last 7 days inclusive
    const start30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const startYear = new Date(now.getFullYear(), 0, 1);

    return {
      last7: sumBetween(expenditures, start7),
      last30: sumBetween(expenditures, start30),
      yearToDate: sumBetween(expenditures, startYear),
      spark7: generateSparklineData(expenditures, 7),
      spark30: generateSparklineData(expenditures, 30),
      sparkYear: generateSparklineData(expenditures, 12) // monthly buckets could be later — keep simple
    };
  }, [expenditures]);

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) return;
    const item: Expenditure = {
      id: uuidv4(),
      date: new Date(date).toISOString(),
      amount: amt,
      category,
      note,
      createdBy: isOwner ? 'owner' : 'staff'
    };
    const next = [item, ...expenditures];
    onUpdateExpenditures(next);
    setAmount('');
    setNote('');
    setDate(new Date().toISOString().slice(0, 10));
  };

  const handleDelete = (id: string) => {
    onUpdateExpenditures(expenditures.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-gray-800">Expenditures</h2>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow-sm">
          <div className="text-xs uppercase text-gray-500 font-bold">Last 7 days</div>
          <div className="text-2xl font-extrabold mt-2">₦{analytics.last7.toLocaleString()}</div>
          <div className="mt-2"><Sparkline data={analytics.spark7} /></div>
        </div>
        <div className="p-4 bg-white rounded shadow-sm">
          <div className="text-xs uppercase text-gray-500 font-bold">Last 30 days</div>
          <div className="text-2xl font-extrabold mt-2">₦{analytics.last30.toLocaleString()}</div>
          <div className="mt-2"><Sparkline data={analytics.spark30} /></div>
        </div>
        <div className="p-4 bg-white rounded shadow-sm">
          <div className="text-xs uppercase text-gray-500 font-bold">Year to date</div>
          <div className="text-2xl font-extrabold mt-2">₦{analytics.yearToDate.toLocaleString()}</div>
          <div className="mt-2"><Sparkline data={analytics.sparkYear} /></div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded shadow-sm space-y-3">
          <h3 className="font-bold">Add expenditure</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border p-2 rounded"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="border p-2 rounded"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={e => setCategory(e.target.value)} className="border p-2 rounded">
              {defaultCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} className="border p-2 rounded" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleAdd} className="px-4 py-2 bg-primary text-white rounded font-bold">Add</button>
          </div>
        </div>

        <div className="p-4 bg-white rounded shadow-sm">
          <h3 className="font-bold mb-3">Recent expenditures</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {expenditures.length === 0 && <div className="text-sm text-gray-400">No recorded expenditures.</div>}
            {expenditures.map(e => (
              <div key={e.id} className="flex items-center justify-between border p-2 rounded">
                <div>
                  <div className="font-bold">₦{Number(e.amount).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{e.category} — {e.note || '—'}</div>
                  <div className="text-xs text-gray-400">{format(new Date(e.date), 'yyyy-MM-dd HH:mm')}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => handleDelete(e.id)} className="text-sm text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}