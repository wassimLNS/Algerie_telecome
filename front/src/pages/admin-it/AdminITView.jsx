import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { getAgentsList, getAgentsPerformance, getSessionHistory } from '@/api/admin';
import { AgentManagement } from '@/components/features/admin/AgentManagement';
import { AdminSessions } from '@/components/features/admin/AdminSessions';
import { DemandesIT } from '@/components/features/admin-it/DemandesIT';
import { CentreManagement } from '@/components/features/admin-it/CentreManagement';
import { Server, Loader2, Users, HardDrive, Inbox, Map } from 'lucide-react';

export default function AdminITView() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'agents';
  const [agents, setAgents] = useState([]);
  const [performances, setPerformances] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsData, perfData, sessionsData] = await Promise.all([
        getAgentsList(),
        getAgentsPerformance().catch(() => []),
        getSessionHistory().catch(() => []),
      ]);
      setAgents(agentsData);
      setPerformances(perfData);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load admin-it data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#0055A4]" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-8 bg-white p-8 rounded-3xl border shadow-xl">
        <div className="flex items-center gap-6">
          <div className="bg-[#0055A4]/5 p-4 rounded-3xl border border-[#0055A4]/10 text-[#0055A4]">
            <Server className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Console Admin IT</h1>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">{user?.prenom} {user?.nom}</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.href = '?tab=agents'}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'agents' ? 'bg-[#0055A4] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <Users className="w-4 h-4" /> Experts
          </button>
          <button 
            onClick={() => window.location.href = '?tab=centres'}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'centres' ? 'bg-[#0055A4] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <Map className="w-4 h-4" /> Centres
          </button>
          <button 
            onClick={() => window.location.href = '?tab=sessions'}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'sessions' ? 'bg-[#0055A4] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <HardDrive className="w-4 h-4" /> Sessions
          </button>
          <button 
            onClick={() => window.location.href = '?tab=demandes'}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-colors ${activeTab === 'demandes' ? 'bg-[#0055A4] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <Inbox className="w-4 h-4" /> Demandes IT
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'agents' && (
        <AgentManagement agents={agents} performances={performances} onRefresh={fetchAll} />
      )}

      {activeTab === 'centres' && (
        <CentreManagement />
      )}

      {activeTab === 'sessions' && (
        <AdminSessions sessions={sessions} />
      )}

      {activeTab === 'demandes' && (
        <DemandesIT />
      )}
    </div>
  );
}
