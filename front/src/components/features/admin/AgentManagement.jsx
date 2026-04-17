import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, Plus, ChevronRight, Trash2, X, UserCircle, Award, UserPlus, Cpu, MapPin, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAgent, deleteAgent } from '@/api/admin';

const ROLE_MAP = {
  agent:            { label: 'Agent',       color: 'bg-blue-100 text-blue-800',    icon: Shield },
  agent_technique:  { label: 'Technicien',  color: 'bg-purple-100 text-purple-800', icon: Cpu },
  agent_annexe:     { label: 'Annexe',      color: 'bg-orange-100 text-orange-800', icon: MapPin },
};

function getStatusInfo(agent) {
  if (!agent.actif) return { label: 'Inactif', dot: 'bg-red-500' };
  if (agent.derniere_connexion) {
    const diff = Date.now() - new Date(agent.derniere_connexion).getTime();
    if (diff < 30 * 60 * 1000) return { label: 'Online', dot: 'bg-emerald-500 animate-pulse' };
  }
  return { label: 'Offline', dot: 'bg-amber-500' };
}

export function AgentManagement({ agents = [], performances = [], onRefresh, onAuditAgent }) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nom: '', prenom: '', email: '', telephone: '', role: 'agent', mot_de_passe: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await createAgent(formData);
      setShowModal(false);
      setFormData({ nom: '', prenom: '', email: '', telephone: '', role: 'agent', mot_de_passe: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        setFormError(Object.values(detail).flat().join(' '));
      } else {
        setFormError('Erreur lors de la création.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (agentId) => {
    if (!window.confirm('Désactiver cet agent ? Il ne pourra plus se connecter.')) return;
    try {
      await deleteAgent(agentId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    }
  };

  // Merge performance data with agent data
  const agentsWithPerf = agents.map(agent => {
    const perf = performances.find(p => p.agent_id === String(agent.id));
    return { ...agent, perf };
  });

  return (
    <>
      <div className="space-y-6">
        {/* Add button */}
        <div className="flex justify-end px-2">
          <Button
            onClick={() => setShowModal(true)}
            className="rounded-xl font-black text-[10px] uppercase h-11 px-8 shadow-xl shadow-[#0055A4]/20 bg-[#0055A4] hover:bg-[#003d7a] text-white cursor-pointer"
          >
            <UserPlus className="w-4 h-4 mr-2" /> {t('sidebar.experts')}
          </Button>
        </div>

        {/* Table */}
        <Card className="rounded-[2rem] shadow-2xl bg-white overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 p-8 flex flex-row items-center gap-6">
            <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-[#0055A4]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{t('admin.agents_management')}</CardTitle>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-1">Supervision Qualité Live</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="pl-10 text-[11px] font-black uppercase h-16">Expert / ID</TableHead>
                  <TableHead className="text-[11px] font-black uppercase">{t('portal.status')}</TableHead>
                  <TableHead className="text-[11px] font-black uppercase">Charge (Real-time)</TableHead>

                  <TableHead className="pr-10 text-right text-[11px] font-black uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsWithPerf.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-slate-400 font-bold uppercase text-[10px]">
                      {t('portal.no_tickets')}
                    </TableCell>
                  </TableRow>
                ) : (
                  agentsWithPerf.map((agent) => {
                    const roleInfo = ROLE_MAP[agent.role] || ROLE_MAP.agent;
                    const statusInfo = getStatusInfo(agent);
                    const workload = agent.perf ? Math.min(100, (agent.perf.tickets_actifs || 0) * 10) : 0;
                    const satisfaction = agent.perf?.satisfaction_moy;
                    return (
                      <TableRow key={agent.id} className="h-20 hover:bg-slate-50 transition-all group cursor-pointer">
                        <TableCell className="pl-10">
                          <div className="flex items-center gap-5">
                            <div className="bg-slate-100 p-3.5 rounded-2xl shadow-sm group-hover:bg-[#0055A4]/10 transition-colors">
                              <UserCircle className="w-7 h-7 text-slate-400 group-hover:text-[#0055A4] transition-colors" />
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-base uppercase tracking-tight leading-none mb-1">{agent.prenom} {agent.nom}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {agent.id.toString().slice(0, 8)} • {roleInfo.label}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", statusInfo.dot)}></div>
                            <span className="text-[11px] font-black uppercase text-slate-700">{statusInfo.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-44 space-y-2">
                            <Progress value={workload} className="h-2.5 bg-slate-100" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); if (onAuditAgent) onAuditAgent(agent); }}
                              className="text-[11px] font-black uppercase text-[#0055A4] hover:bg-[#0055A4]/10 px-5 py-2 rounded-xl transition-colors cursor-pointer">
                              AUDIT <ChevronRight className="w-4 h-4 ml-2 inline" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeactivate(agent.id); }}
                              className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl p-2 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ─── CREATE MODAL ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-8 border-b bg-slate-50/50 flex items-center gap-4">
              <div className="bg-[#0055A4]/10 p-3 rounded-xl">
                <UserPlus className="w-5 h-5 text-[#0055A4]" />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0055A4]">{t('sidebar.experts')}</h3>
              </div>
              <button onClick={() => { setShowModal(false); setFormError(''); }} className="ml-auto p-2 rounded-xl hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block">Nom Complet</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" required value={formData.prenom} placeholder="Prénom"
                    onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30" />
                  <input type="text" required value={formData.nom} placeholder="Nom"
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block">Email AT</label>
                <input type="email" required value={formData.email} placeholder="nom@at.dz"
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Téléphone</label>
                  <input type="tel" value={formData.telephone} placeholder="0770123456"
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Rôle de l'Agent</label>
                  <select value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30 bg-white cursor-pointer">
                    <option value="agent">Agent Support</option>
                    <option value="agent_technique">Agent Technique National</option>
                    <option value="agent_annexe">Agent Annexe Régionale</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block">Mot de Passe</label>
                <input type="password" required minLength={8} value={formData.mot_de_passe} placeholder="Minimum 8 caractères"
                  onChange={(e) => setFormData(prev => ({ ...prev, mot_de_passe: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0055A4]/30" />
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs font-bold text-red-600">{formError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 h-12 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer">
                  {t('common.cancel')}
                </button>
                <Button type="submit" disabled={submitting}
                  className="flex-1 h-12 rounded-xl font-black text-xs uppercase shadow-lg bg-[#0055A4] hover:bg-[#003d7a] text-white cursor-pointer">
                  {submitting ? '...' : t('common.confirm')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
