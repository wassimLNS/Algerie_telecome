import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getDemandesIT, traiterDemandeIT, downloadFichierDemande } from '@/api/demandes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Loader2, AlertTriangle, ThumbsUp, ThumbsDown, Filter, Paperclip, Download, FileText } from 'lucide-react';

const STATUT_CONFIG = {
  en_attente:  { label: 'demands_status.en_attente',  color: 'bg-amber-100 text-amber-800',     icon: Clock },
  approuvee:   { label: 'demands_status.approuvee',   color: 'bg-blue-100 text-blue-800',       icon: Clock },
  refusee:     { label: 'demands_status.refusee',     color: 'bg-red-100 text-red-800',         icon: XCircle },
  traitee:     { label: 'demands_status.traitee',     color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  refusee_it:  { label: 'demands_status.refusee_it',  color: 'bg-rose-100 text-rose-800',       icon: XCircle },
};

const PRIORITE_COLORS = {
  basse: 'text-slate-400',
  normale: 'text-blue-500',
  haute: 'text-orange-500',
  urgente: 'text-red-600 font-black',
};

export function DemandesIT() {
  const { t } = useTranslation();
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('approuvee');
  const [actionId, setActionId] = useState(null);
  const [commentaire, setCommentaire] = useState('');
  const [fichier, setFichier] = useState(null);
  const fileRef = useRef(null);

  const fetchDemandes = async () => {
    setLoading(true);
    try {
      const data = await getDemandesIT(filter);
      setDemandes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDemandes(); }, [filter]);

  const handleAction = async (id, action) => {
    try {
      if (fichier && action === 'traiter') {
        const formData = new FormData();
        formData.append('action', action);
        formData.append('commentaire', commentaire);
        formData.append('fichier', fichier);
        await traiterDemandeIT(id, formData);
      } else {
        await traiterDemandeIT(id, { action, commentaire });
      }
      setActionId(null);
      setCommentaire('');
      setFichier(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{t('demands.title_it')}</h2>
        <div className="flex gap-2">
          {[
            { value: 'approuvee', label: t('demands.to_process') },
            { value: 'traitee', label: t('demands.processed') },
            { value: 'all', label: t('demands.all') },
          ].map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value)}
              className={`text-[10px] font-black uppercase rounded-xl px-4 cursor-pointer ${filter === f.value ? 'bg-[#0055A4] text-white' : ''}`}
            >
              <Filter className="w-3 h-3 mr-1" /> {f.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-[#0055A4]" /></div>
      ) : demandes.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-xl border p-16 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-400">{t('demands.no_demands')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {demandes.map((d) => {
            const cfg = STATUT_CONFIG[d.statut] || STATUT_CONFIG.approuvee;
            const Icon = cfg.icon;
            return (
              <Card key={d.id} className={`rounded-2xl shadow-md border ${d.statut === 'approuvee' ? 'border-blue-200' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-xl ${cfg.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-black text-sm text-slate-900">{d.sujet}</h3>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.color}`}>{t(cfg.label)}</span>
                        <span className={`text-[9px] font-black uppercase ${PRIORITE_COLORS[d.priorite] || ''}`}>{t('demands_priority.' + d.priorite)}</span>
                        {d.centre_nom && <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">📍 {d.centre_nom}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{d.description}</p>
                      {d.reponse_admin && <p className="text-xs text-blue-600 font-semibold">💬 Admin : {d.reponse_admin}</p>}
                      {d.reponse_it && <p className="text-xs text-emerald-600 mt-1 font-semibold">💻 IT : {d.reponse_it}</p>}
                      {d.fichier_reponse_nom && (
                        <button onClick={() => handleDownload(d)}
                          className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-[#0055A4] hover:underline cursor-pointer bg-blue-50 px-2 py-1 rounded-lg">
                          <Download className="w-3 h-3" />
                          {d.fichier_reponse_nom}
                        </button>
                      )}
                      <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-bold flex justify-between">
                          <span>
                            <span className="text-slate-400 uppercase tracking-wider">Demandeur :</span> <span className="text-[#0055A4]">{d.demandeur_nom}</span>
                          </span>
                          {d.centre_nom && (
                            <span>
                              <span className="text-slate-400 uppercase tracking-wider">Centre :</span> <span className="text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full ml-1">📍 {d.centre_nom}</span>
                            </span>
                          )}
                        </p>
                        {d.approuve_par_nom && (
                          <p className="text-[10px] text-slate-500 font-bold mt-1">
                            <span className="text-slate-400 uppercase tracking-wider">Validée par :</span> <span className="text-emerald-600">{d.approuve_par_nom}</span>
                          </p>
                        )}
                        <p className="text-[9px] text-slate-400 mt-1 font-bold">
                          🕒 {new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    {d.statut === 'approuvee' && (
                      <div className="flex gap-2 shrink-0">
                        {actionId === d.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder={t('demands.response_placeholder')} rows={2} className="border rounded-lg p-2 text-xs w-52 resize-none" />
                            {/* File attachment */}
                            <div className="flex items-center gap-2">
                              <input type="file" ref={fileRef} className="hidden" onChange={(e) => setFichier(e.target.files?.[0] || null)} />
                              <button onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-[#0055A4] cursor-pointer bg-slate-100 px-2 py-1 rounded-lg transition-colors">
                                <Paperclip className="w-3 h-3" />
                                {fichier ? fichier.name : t('demands.attach_file')}
                              </button>
                              {fichier && (
                                <button onClick={() => setFichier(null)} className="text-red-400 text-[9px] hover:text-red-600 cursor-pointer font-bold">✕</button>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleAction(d.id, 'traiter')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg">
                                <ThumbsUp className="w-3 h-3 mr-1" /> {t('demands.process')}
                              </Button>
                              <Button size="sm" onClick={() => handleAction(d.id, 'refuser')} className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg">
                                <ThumbsDown className="w-3 h-3 mr-1" /> {t('demands.refuse')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setActionId(d.id)} className="text-[10px] font-bold rounded-lg cursor-pointer">
                            {t('demands.respond')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
