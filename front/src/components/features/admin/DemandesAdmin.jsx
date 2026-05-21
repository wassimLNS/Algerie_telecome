import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getDemandesAdmin, traiterDemandeAdmin, downloadFichierDemande } from '@/api/demandes';
import { creerDemande } from '@/api/demandes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Send, X, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, ThumbsUp, ThumbsDown, Download } from 'lucide-react';

const STATUT_CONFIG = {
  en_attente:  { label: 'demands_status.en_attente',  color: 'bg-amber-100 text-amber-800',     icon: Clock },
  approuvee:   { label: 'demands_status.approuvee',   color: 'bg-blue-100 text-blue-800',       icon: CheckCircle },
  refusee:     { label: 'demands_status.refusee',     color: 'bg-red-100 text-red-800',         icon: XCircle },
  traitee:     { label: 'demands_status.traitee',     color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  refusee_it:  { label: 'demands_status.refusee_it',  color: 'bg-rose-100 text-rose-800',       icon: XCircle },
};

const PRIORITE_OPTIONS = [
  { value: 'basse', label: 'demands_priority.basse' },
  { value: 'normale', label: 'demands_priority.normale' },
  { value: 'haute', label: 'demands_priority.haute' },
  { value: 'urgente', label: 'demands_priority.urgente' },
];

export function DemandesAdmin() {
  const { t } = useTranslation();
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [form, setForm] = useState({ sujet: '', description: '', priorite: 'normale' });

  const fetchDemandes = async () => {
    try {
      const data = await getDemandesAdmin();
      setDemandes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemandes(); }, []);

  const handleAction = async (id, action) => {
    try {
      await traiterDemandeAdmin(id, { action, commentaire });
      setActionId(null);
      setCommentaire('');
      fetchDemandes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = async (demande) => {
    try {
      const response = await downloadFichierDemande(demande.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', demande.fichier_reponse_nom || 'fichier');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.sujet.trim() || !form.description.trim()) return;
    setSubmitting(true);
    try {
      await creerDemande(form);
      setForm({ sujet: '', description: '', priorite: 'normale' });
      setShowForm(false);
      fetchDemandes();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-[#0055A4]" /></div>;

  const pending = demandes.filter(d => d.statut === 'en_attente');
  const others = demandes.filter(d => d.statut !== 'en_attente');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{t('demands.title_admin')}</h2>
        <Button onClick={() => setShowForm(!showForm)} className="bg-[#0055A4] hover:bg-[#004080] text-white font-bold rounded-xl px-6">
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? t('common.cancel') : t('demands.my_demand')}
        </Button>
      </div>

      {/* Admin's own form */}
      {showForm && (
        <Card className="border-2 border-[#0055A4]/20 shadow-xl rounded-3xl">
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">⚡ {t('demands.direct_send')}</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{t('demands.subject')}</label>
                <Input value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} placeholder="Ex: Besoin d'un nouveau compte..." className="rounded-xl font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{t('demands.description')}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('demands.details_placeholder')} rows={4} className="w-full border rounded-xl p-3 text-sm font-medium resize-none focus:ring-2 focus:ring-[#0055A4] focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{t('demands.priority')}</label>
                <div className="flex gap-2">
                  {PRIORITE_OPTIONS.map((p) => (
                    <button key={p.value} type="button" onClick={() => setForm({ ...form, priorite: p.value })}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all cursor-pointer ${form.priorite === p.value ? 'border-[#0055A4] bg-[#0055A4]/10 text-[#0055A4]' : 'border-slate-200 text-slate-400'}`}>
                      {t(p.label)}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={submitting} className="bg-[#0055A4] hover:bg-[#004080] text-white font-bold rounded-xl px-8">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {t('demands.send_to_it')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <>
          <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest">⏳ {t('demands.pending_approval')} ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map((d) => (
              <Card key={d.id} className="rounded-2xl shadow-md border-2 border-amber-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-black text-sm text-slate-900">{d.sujet}</h3>
                        <span className="text-[9px] font-black uppercase text-slate-400">{d.priorite_label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{d.description}</p>
                      <p className="text-[10px] text-slate-400 font-bold">Par {d.demandeur_nom} — {new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {actionId === d.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire (optionnel)..." rows={2} className="border rounded-lg p-2 text-xs w-48 resize-none" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleAction(d.id, 'approuver')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg">
                              <ThumbsUp className="w-3 h-3 mr-1" /> {t('demands.approve')}
                            </Button>
                            <Button size="sm" onClick={() => handleAction(d.id, 'refuser')} className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg">
                              <ThumbsDown className="w-3 h-3 mr-1" /> {t('demands.refuse')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setActionId(d.id)} className="text-[10px] font-bold rounded-lg cursor-pointer">
                          {t('demands.process')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Other requests */}
      {others.length > 0 && (
        <>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mt-6">{t('demands.history')} ({others.length})</h3>
          <div className="space-y-3">
            {others.map((d) => {
              const cfg = STATUT_CONFIG[d.statut] || STATUT_CONFIG.en_attente;
              const Icon = cfg.icon;
              return (
                <Card key={d.id} className="rounded-2xl shadow-sm border">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className={`p-2 rounded-xl ${cfg.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-sm text-slate-700">{d.sujet}</h3>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.color}`}>{t(cfg.label)}</span>
                      </div>
                      <p className="text-xs text-slate-400">{d.description}</p>
                      {d.reponse_admin && <p className="text-xs text-blue-600 mt-1 font-semibold">💬 {d.reponse_admin}</p>}
                      {d.reponse_it && <p className="text-xs text-emerald-600 mt-1 font-semibold">💻 IT : {d.reponse_it}</p>}
                      {d.fichier_reponse_nom && (
                        <button onClick={() => handleDownload(d)}
                          className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[#0055A4] hover:underline cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                          <Download className="w-3.5 h-3.5" />
                          📎 {d.fichier_reponse_nom}
                        </button>
                      )}
                      <p className="text-[10px] text-slate-300 mt-1 font-bold">Par {d.demandeur_nom}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {demandes.length === 0 && (
        <div className="bg-white rounded-3xl shadow-xl border p-16 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-400">{t('demands.no_demands_centre')}</p>
        </div>
      )}
    </div>
  );
}
