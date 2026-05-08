import React, { useState, useEffect } from 'react';
import { getCentres, createCentre, updateCentre, deleteCentre } from '@/api/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit2, Trash2, MapPin, Phone, Mail, Loader2, Server } from 'lucide-react';

export function CentreManagement() {
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCentre, setEditingCentre] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    wilaya: '',
    adresse: '',
    telephone: '',
    email: '',
    prefixes_tel: '',
  });

  const fetchCentres = async () => {
    setLoading(true);
    try {
      const data = await getCentres();
      setCentres(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentres();
  }, []);

  const handleOpenModal = (centre = null) => {
    setError('');
    if (centre) {
      setEditingCentre(centre);
      setFormData({
        code: centre.code || '',
        nom: centre.nom || '',
        wilaya: centre.wilaya || '',
        adresse: centre.adresse || '',
        telephone: centre.telephone || '',
        email: centre.email || '',
        prefixes_tel: centre.prefixes_tel || '',
      });
    } else {
      setEditingCentre(null);
      setFormData({
        code: '', nom: '', wilaya: '', adresse: '', telephone: '', email: '', prefixes_tel: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (editingCentre) {
        await updateCentre(editingCentre.id, formData);
      } else {
        await createCentre(formData);
      }
      setShowModal(false);
      fetchCentres();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment désactiver ce centre ?")) {
      try {
        await deleteCentre(id);
        fetchCentres();
      } catch (err) {
        alert("Erreur lors de la désactivation");
      }
    }
  };

  const filteredCentres = centres.filter(c => 
    c.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.wilaya && c.wilaya.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-[#0055A4]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un centre..." 
            className="pl-10 h-12 rounded-xl bg-slate-50 border-none font-medium"
          />
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-[#0055A4] hover:bg-[#004080] text-white font-bold rounded-xl h-12 px-6">
          <Plus className="w-4 h-4 mr-2" /> Nouveau Centre
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCentres.map((centre) => (
          <Card key={centre.id} className="rounded-3xl border-0 shadow-lg overflow-hidden bg-white hover:shadow-xl transition-shadow relative">
            <div className="h-2 w-full bg-gradient-to-r from-[#0055A4] to-emerald-400" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800">{centre.nom}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{centre.code} — {centre.wilaya}</p>
                </div>
                <div className="bg-[#0055A4]/10 p-2 rounded-xl">
                  <Server className="w-5 h-5 text-[#0055A4]" />
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-slate-600">
                  <MapPin className="w-4 h-4 mr-3 text-slate-400" /> {centre.adresse || 'N/A'}
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Phone className="w-4 h-4 mr-3 text-slate-400" /> {centre.telephone || 'N/A'}
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="w-4 h-4 mr-3 text-slate-400" /> {centre.email || 'N/A'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Agents</p>
                    <p className="text-sm font-black text-[#0055A4]">{centre.nombre_agents}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Tickets</p>
                    <p className="text-sm font-black text-emerald-600">{centre.nombre_tickets_actifs}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenModal(centre)} className="p-2 bg-slate-100 text-slate-600 hover:bg-[#0055A4] hover:text-white rounded-xl transition-colors cursor-pointer">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(centre.id)} className="p-2 bg-slate-100 text-slate-600 hover:bg-red-500 hover:text-white rounded-xl transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {editingCentre ? 'Modifier le centre' : 'Nouveau Centre'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl">{error}</div>}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Code</label>
                  <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="Ex: C01" required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Nom</label>
                  <Input value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} placeholder="Nom du centre" required />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Wilaya</label>
                <Input value={formData.wilaya} onChange={e => setFormData({...formData, wilaya: e.target.value})} placeholder="Ex: Alger" required />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Adresse</label>
                <Input value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})} placeholder="Adresse complète" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Téléphone</label>
                  <Input value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} placeholder="Ex: 021..." />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Email</label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contact@..." />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Préfixes téléphoniques</label>
                <Input value={formData.prefixes_tel} onChange={e => setFormData({...formData, prefixes_tel: e.target.value})} placeholder="Ex: 021,023 (Séparés par virgule)" />
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">Optionnel, sert à l'attribution automatique des tickets.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 rounded-xl">Annuler</Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-[#0055A4] hover:bg-[#004080] text-white rounded-xl">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
