import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, UserCircle, Globe, Laptop, CheckCircle2, XCircle, Filter, Building2, MapPin, Calendar, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCentres } from '@/api/admin';
import { genererRapportConnexions } from '@/api/demandes';

export function AdminSessions({ sessions = [] }) {
  const { t } = useTranslation();
  // Parsing simple du User-Agent pour un affichage plus propre
  const parseUserAgent = (uaString = '') => {
    let browser = 'Inconnu';
    if (uaString.includes('Chrome')) browser = 'Chrome';
    else if (uaString.includes('Firefox')) browser = 'Firefox';
    else if (uaString.includes('Safari')) browser = 'Safari';
    else if (uaString.includes('Edge')) browser = 'Edge';

    let os = 'OS Inconnu';
    if (uaString.includes('Windows')) os = 'Windows';
    else if (uaString.includes('Mac OS')) os = 'macOS';
    else if (uaString.includes('Linux')) os = 'Linux';
    else if (uaString.includes('Android')) os = 'Android';
    else if (uaString.includes('iOS')) os = 'iOS';

    return `${browser} sur ${os}`;
  };

  const [centres, setCentres] = useState([]);
  const [filterRole, setFilterRole] = useState('');
  const [filterCentre, setFilterCentre] = useState('');
  const [filterCommune, setFilterCommune] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [reportCentre, setReportCentre] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportRole, setReportRole] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    getCentres().then(data => setCentres(data)).catch(err => console.error(err));
  }, []);

  let filteredSessions = sessions;
  if (filterRole) {
    filteredSessions = filteredSessions.filter(s => s.utilisateur_role === filterRole);
  }
  if (filterCentre) {
    filteredSessions = filteredSessions.filter(s => String(s.utilisateur_centre) === String(filterCentre));
  }
  if (filterCommune) {
    filteredSessions = filteredSessions.filter(s => s.utilisateur_commune === filterCommune);
  }
  if (filterDateFrom) {
    const from = new Date(filterDateFrom);
    filteredSessions = filteredSessions.filter(s => new Date(s.connecte_a) >= from);
  }
  if (filterDateTo) {
    const to = new Date(filterDateTo);
    to.setHours(23, 59, 59, 999);
    filteredSessions = filteredSessions.filter(s => new Date(s.connecte_a) <= to);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setFilterCommune(''); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-[#0055A4]/30 focus:outline-none">
            <option value="">{t('roles.all')}</option>
            <option value="agent">{t('roles.agent')}</option>
            <option value="agent_technique">{t('roles.agent_technique')}</option>
            <option value="agent_annexe">{t('roles.agent_annexe')}</option>
            <option value="admin">{t('roles.admin')}</option>
            <option value="admin_it">{t('roles.admin_it')}</option>
            <option value="client">{t('roles.client')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <select value={filterCentre} onChange={(e) => { setFilterCentre(e.target.value); setFilterCommune(''); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-[#0055A4]/30 focus:outline-none">
            <option value="">{t('filters.all_centres')}</option>
            {centres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        {(filterRole === 'agent_technique' || filterRole === 'agent_annexe') && filterCentre && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-[#0055A4]/30 focus:outline-none">
            <option value="">{t('filters.all_communes')}</option>
            {(centres.find(c => String(c.id) === String(filterCentre))?.communes || []).map(com => (
              <option key={com} value={com}>{com}</option>
            ))}
          </select>
        </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-[#0055A4]/30 focus:outline-none"
            title="Date début" />
          <span className="text-xs text-slate-400 font-bold">→</span>
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-[#0055A4]/30 focus:outline-none"
            title="Date fin" />
        </div>
        {(filterRole || filterCentre || filterCommune || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setFilterRole(''); setFilterCentre(''); setFilterCommune(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 cursor-pointer px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
            ✕ {t('filters.reset')}
          </button>
        )}
      </div>

      {/* Report Generation Card */}
      <Card className="rounded-2xl shadow-lg border border-slate-200 bg-white">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase text-slate-700 tracking-tight">{t('reports.generate')}</span>
            <select value={reportCentre} onChange={(e) => setReportCentre(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-emerald-400/30 focus:outline-none">
              <option value="">{t('filters.centre')}</option>
              {centres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select value={reportRole} onChange={(e) => setReportRole(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-emerald-400/30 focus:outline-none">
              <option value="">{t('roles.all')}</option>
              <option value="agent">{t('roles.agent')}</option>
              <option value="agent_technique">{t('roles.agent_technique')}</option>
              <option value="agent_annexe">{t('roles.agent_annexe')}</option>
              <option value="admin">{t('roles.admin')}</option>
              <option value="admin_it">{t('roles.admin_it')}</option>
              <option value="client">{t('roles.client')}</option>
            </select>
            <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-emerald-400/30 focus:outline-none" />
            <span className="text-xs text-slate-400 font-bold">→</span>
            <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white cursor-pointer focus:ring-2 focus:ring-emerald-400/30 focus:outline-none" />
            <button
              disabled={!reportCentre || !reportFrom || !reportTo || reportLoading}
              onClick={async () => {
                setReportLoading(true);
                try {
                  const res = await genererRapportConnexions(reportCentre, reportFrom, reportTo, reportRole);
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  const centreName = centres.find(c => String(c.id) === String(reportCentre))?.nom || 'centre';
                  link.setAttribute('download', `rapport_connexions_${centreName}_${reportFrom}_${reportTo}.xlsx`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err) { console.error(err); }
                setReportLoading(false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-md"
            >
              {reportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {t('reports.download_excel')}
            </button>
          </div>
        </CardContent>
      </Card>

    <Card className="rounded-[2rem] shadow-2xl bg-white overflow-hidden">
      <CardHeader className="border-b bg-slate-50/50 p-8 flex flex-row items-center gap-6">
        <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-purple-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{t('admin.session_history')}</CardTitle>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-1">{t('sidebar.audit')}</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="pl-10 text-[11px] font-black uppercase h-16">{t('admin.user')}</TableHead>
              <TableHead className="text-[11px] font-black uppercase">{t('admin.ip')}</TableHead>
              <TableHead className="text-[11px] font-black uppercase">Appareil & Navigateur</TableHead>
              <TableHead className="text-[11px] font-black uppercase">{t('admin.result')}</TableHead>
              <TableHead className="pr-10 text-right text-[11px] font-black uppercase">{t('admin.datetime')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-slate-400 font-bold uppercase text-[10px]">
                  {t('portal.no_tickets')}
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session, index) => (
                <TableRow key={index} className="h-20 hover:bg-slate-50 transition-all">
                  <TableCell className="pl-10">
                    <div className="flex items-center gap-3">
                      <UserCircle className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-black text-slate-900 uppercase tracking-tight text-sm leading-none">{session.utilisateur_nom || 'Inconnu'}</p>
                        {session.utilisateur_email && (
                          <p className="text-[10px] font-bold text-slate-400 mt-1">{session.utilisateur_email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-[#0055A4]" />
                      <span className="font-bold text-xs text-slate-600">{session.ip_adresse || 'Non disponible'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-xs text-slate-600">{parseUserAgent(session.user_agent)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {session.succes ? (
                      <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 px-3 py-1 flex items-center gap-1 w-fit shadow-none border-none text-[10px] uppercase font-black">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-600 hover:bg-red-50 px-3 py-1 flex items-center gap-1 w-fit shadow-none border-none text-[10px] uppercase font-black">
                        <XCircle className="w-3 h-3" /> Échec {session.raison_echec && `(${session.raison_echec})`}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-10">
                    <p className="font-black text-[#0055A4] text-xs uppercase uppercase">
                      {new Date(session.connecte_a).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="font-bold text-slate-400 text-[10px]">
                      {new Date(session.connecte_a).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  );
}
