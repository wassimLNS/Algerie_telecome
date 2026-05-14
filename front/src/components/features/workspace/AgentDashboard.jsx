import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Zap, TrendingUp, CheckCircle2, BarChart3, GitBranchPlus } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Cell, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  soumis: '#6366f1', en_cours: '#f59e0b', escalade: '#8b5cf6',
  resolu: '#10b981', ferme: '#64748b', rejete: '#ef4444',
};
const PRIORITY_COLORS = { critique: '#ef4444', haute: '#f97316', normale: '#3b82f6', basse: '#94a3b8' };

const STATUS_LABELS = {
  soumis: 'Nouveau', en_cours: 'En cours', escalade: 'Escaladé',
  resolu: 'Résolu', ferme: 'Fermé', rejete: 'Rejeté'
};
const PRIORITY_LABELS = { critique: 'Critique', haute: 'Haute', normale: 'Normale', basse: 'Basse' };

export function AgentDashboard({ tickets = [], user }) {
  const { t } = useTranslation();

  // Filtres
  const [chartType, setChartType] = useState('bar');       // bar | line
  const [dimension, setDimension] = useState('statut');     // statut | priorite | date
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filtrer par date
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (!t.created_at) return true;
      const d = new Date(t.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59);
        if (d > end) return false;
      }
      return true;
    });
  }, [tickets, dateFrom, dateTo]);

  // KPIs
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const resolvedToday = filteredTickets.filter(t =>
      t.statut === 'resolu' && t.resolu_a && new Date(t.resolu_a).toDateString() === today
    ).length;
    const activeTickets = filteredTickets.filter(t => !['resolu', 'ferme', 'rejete'].includes(t.statut)).length;
    const totalTickets = filteredTickets.length;
    const resolvedTotal = filteredTickets.filter(t => t.statut === 'resolu' || t.statut === 'ferme').length;
    return { resolvedToday, activeTickets, totalTickets, resolvedTotal };
  }, [filteredTickets]);

  // Données pour le graphe principal
  const chartData = useMemo(() => {
    if (dimension === 'statut') {
      return Object.entries(
        filteredTickets.reduce((acc, t) => { acc[t.statut] = (acc[t.statut] || 0) + 1; return acc; }, {})
      ).map(([key, value]) => ({ name: STATUS_LABELS[key] || key, tickets: value, fill: STATUS_COLORS[key] || '#94a3b8' }));
    }
    if (dimension === 'priorite') {
      const order = ['critique', 'haute', 'normale', 'basse'];
      return order
        .map(key => {
          const count = filteredTickets.filter(t => t.priorite === key).length;
          return count > 0 ? { name: PRIORITY_LABELS[key], tickets: count, fill: PRIORITY_COLORS[key] } : null;
        })
        .filter(Boolean);
    }
    if (dimension === 'date') {
      const grouped = {};
      filteredTickets.forEach(t => {
        if (!t.created_at) return;
        const day = new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        grouped[day] = (grouped[day] || 0) + 1;
      });
      return Object.entries(grouped)
        .map(([name, tickets]) => ({ name, tickets, fill: '#0055A4' }));
    }
    return [];
  }, [filteredTickets, dimension]);

  // Render the chart based on selected type
  const renderChart = () => {
    if (chartData.length === 0) {
      return <p className="text-xs text-slate-400 font-bold text-center py-20 uppercase tracking-widest">Aucune donnée pour cette période</p>;
    }

    const tooltipStyle = { borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' };
    const formatter = (value) => [`${value} tickets`, 'Nombre'];

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight="800" />
            <YAxis axisLine={false} tickLine={false} fontSize={11} fontWeight="bold" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatter} />
            <Bar dataKey="tickets" radius={[12, 12, 0, 0]} barSize={36}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }


    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight="800" />
            <YAxis axisLine={false} tickLine={false} fontSize={11} fontWeight="bold" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatter} />
            <Line type="monotone" dataKey="tickets" stroke="#0055A4" strokeWidth={3} dot={{ r: 5, fill: '#0055A4' }} activeDot={{ r: 7, fill: '#0055A4' }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  };

  const chartTypeOptions = [
    { value: 'bar', label: 'Barres', icon: BarChart3 },
    { value: 'line', label: 'Ligne', icon: GitBranchPlus },
  ];

  const dimensionOptions = [
    { value: 'statut', label: 'Par Statut' },
    { value: 'priorite', label: 'Par Priorité' },
    { value: 'date', label: 'Par Date' },
  ];

  return (
    <div className="space-y-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">{t('agent.resolved_today')}</p>
            <h3 className="text-5xl font-black text-[#0055A4] tracking-tighter">{stats.resolvedToday}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Tickets Actifs</p>
            <h3 className="text-5xl font-black text-amber-500 tracking-tighter">{stats.activeTickets}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Total Résolus</p>
            <h3 className="text-5xl font-black text-emerald-500 tracking-tighter">{stats.resolvedTotal}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Total Assignés</p>
            <h3 className="text-5xl font-black text-slate-700 tracking-tighter">{stats.totalTickets}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart with Filters */}
      <Card className="rounded-3xl shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b p-6 md:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <CardTitle className="text-xl font-black text-slate-900 uppercase">Analyse Tickets</CardTitle>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dimension selector */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {dimensionOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDimension(opt.value)}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase transition-all cursor-pointer",
                      dimension === opt.value
                        ? "bg-[#0055A4] text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Chart type selector */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {chartTypeOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setChartType(opt.value)}
                      className={cn(
                        "px-3 py-2 transition-all cursor-pointer flex items-center gap-1.5",
                        chartType === opt.value
                          ? "bg-[#0055A4] text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      )}
                      title={opt.label}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase hidden md:inline">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Date filters */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30 cursor-pointer"
                  title="Date début"
                />
                <span className="text-[10px] font-black text-slate-400">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30 cursor-pointer"
                  title="Date fin"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-[9px] font-black text-red-500 uppercase hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active filter badges */}
          <div className="flex gap-2 mt-4">
            <Badge className="bg-slate-100 text-slate-600 border-none shadow-none text-[9px] font-black uppercase px-3 py-1">
              {filteredTickets.length} tickets
            </Badge>
            {dateFrom && (
              <Badge className="bg-blue-50 text-[#0055A4] border-none shadow-none text-[9px] font-black px-3 py-1">
                Depuis {new Date(dateFrom).toLocaleDateString('fr-FR')}
              </Badge>
            )}
            {dateTo && (
              <Badge className="bg-blue-50 text-[#0055A4] border-none shadow-none text-[9px] font-black px-3 py-1">
                Jusqu'au {new Date(dateTo).toLocaleDateString('fr-FR')}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {renderChart()}
        </CardContent>
      </Card>

      {/* Session Row */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Statut</p>
              <p className="text-lg font-black text-emerald-600 tracking-tighter">En ligne</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-2xl text-[#0055A4]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Charge</p>
              <p className="text-lg font-black text-slate-900 tracking-tighter">{stats.activeTickets} actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-xl bg-white">
          <CardContent className="p-8 flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-2xl text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total</p>
              <p className="text-lg font-black text-slate-900 tracking-tighter">{stats.totalTickets} dossiers</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
