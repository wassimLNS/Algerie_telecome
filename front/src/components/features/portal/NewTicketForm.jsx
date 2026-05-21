import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupportChatbot } from '@/components/features/portal/SupportChatbot';
import { LanguageButton } from '@/components/shared/LanguageButton';
import { getServiceTypes, createTicket, uploadAttachment } from '@/api/tickets';
import { getMessages, sendMessage as sendMessageAPI, sendMessageWithAttachment } from '@/api/chat';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Phone, Search, CheckCircle2, FileUp, X, Send, MessageSquare, Paperclip, FileText, Eye, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/api/axios';

export function NewTicketForm({ userPhone, onSubmit }) {
  const { t } = useTranslation();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [typeService, setTypeService] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [error, setError] = useState('');
  const [showChatbot, setShowChatbot] = useState(false);
  const [pendingTicketData, setPendingTicketData] = useState(null);

  // ─── Chat state (after ticket creation) ───
  const [createdTicket, setCreatedTicket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);
  const chatFileRef = useRef(null);

  // WebSocket for real-time chat
  const { messages: wsMessages, sendMessage: wsSendMessage, isConnected } = useWebSocket(
    createdTicket?.id || null
  );

  const allMessages = React.useMemo(() => {
    const httpIds = new Set(chatMessages.map(m => m.id));
    const newWs = wsMessages.filter(m => !httpIds.has(m.id));
    return [...chatMessages, ...newWs];
  }, [chatMessages, wsMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  // Fetch service types
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const data = await getServiceTypes();
        setServiceTypes(data.results || data);
      } catch (err) {
        console.error('Failed to fetch service types:', err);
        setServiceTypes([
          { id: 1, libelle: 'Internet ADSL' },
          { id: 2, libelle: 'Internet Fiber' },
          { id: 3, libelle: 'Téléphonie Fixe' },
          { id: 4, libelle: '4G LTE' },
          { id: 5, libelle: 'IPTV' },
          { id: 6, libelle: 'Autre' },
        ]);
      }
    };
    fetchTypes();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachment(file);
      const reader = new FileReader();
      reader.onloadend = () => setAttachmentPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!typeService || !description) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const tServiceName = serviceTypes.find(s => s.id === parseInt(typeService))?.libelle || '';
    setPendingTicketData({
      type_service: parseInt(typeService),
      typeServiceName: tServiceName,
      titre: titre || description.substring(0, 50),
      description,
    });
    setShowChatbot(true);
  };

  const executeFinalSubmission = async (aiHistory) => {
    setShowChatbot(false);
    setIsSubmitting(true);
    setError('');

    try {
      const ticketData = {
        ...pendingTicketData
      };
      delete ticketData.typeServiceName; // Don't send this to backend

      if (aiHistory && aiHistory.length > 0) {
        ticketData.historique_ia = aiHistory.map(m => `${m.role === 'bot' ? 'Assistant' : 'Client'}: ${m.text}`).join('\n');
      }

      const newTicket = await createTicket(ticketData);

      if (attachment && newTicket.id) {
        try { await uploadAttachment(newTicket.id, attachment); } catch (e) { console.error(e); }
      }

      setCreatedTicket(newTicket);
      onSubmit(newTicket);
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erreur lors de la soumission.');
      console.error('Ticket creation failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Chat send handlers ───
  const handleChatSend = async () => {
    if (!createdTicket || (!replyText.trim() && !pendingFile)) return;

    if (pendingFile) {
      setSendingMsg(true);
      try {
        const msg = await sendMessageWithAttachment(createdTicket.id, replyText, pendingFile);
        setChatMessages(prev => [...prev, msg]);
      } catch (err) { console.error(err); }
      finally {
        setSendingMsg(false);
        setReplyText('');
        setPendingFile(null);
        setPendingPreview(null);
      }
    } else {
      if (isConnected && wsSendMessage(replyText)) {
        setReplyText('');
        return;
      }
      try {
        const msg = await sendMessageAPI(createdTicket.id, replyText);
        setChatMessages(prev => [...prev, msg]);
      } catch (err) { console.error(err); }
      setReplyText('');
    }
  };

  const handleChatFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPendingPreview(reader.result);
        reader.readAsDataURL(file);
      } else { setPendingPreview(null); }
    }
    e.target.value = '';
  };

  // Preview handler for in-chat attachments
  const [previewFile, setPreviewFile] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const handlePreview = async (pj) => {
    setLoadingPreview(true);
    try {
      const response = await api.get(`/tickets/pieces-jointes/${pj.id}/download/`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      setPreviewFile({ blobUrl, nom: pj.nom_fichier, type_mime: pj.type_mime });
    } catch (err) { console.error(err); }
    finally { setLoadingPreview(false); }
  };
  const closePreview = () => {
    if (previewFile?.blobUrl) URL.revokeObjectURL(previewFile.blobUrl);
    setPreviewFile(null);
  };

  // ─── Reset to create another ticket ───
  const handleNewTicket = () => {
    setCreatedTicket(null);
    setChatMessages([]);
    setTypeService('');
    setTitre('');
    setDescription('');
    setAttachment(null);
    setAttachmentPreview(null);
    setReplyText('');
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ─── Left: Form ─── */}
      <div className="lg:col-span-2 space-y-6">
        {!createdTicket ? (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-3xl border shadow-xl">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-semibold border border-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">{t('ticket_form.service_label')}</Label>
                <Select onValueChange={setTypeService} required>
                  <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                    <SelectValue placeholder={t('ticket_form.service_label')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl">
                    {serviceTypes.map(st => {
                      const libelleKey = `service_types.${st.code}.libelle`;
                      const descKey = `service_types.${st.code}.description`;
                      const tLibelle = t(libelleKey, { defaultValue: st.libelle });
                      const tDesc = st.description ? t(descKey, { defaultValue: st.description }) : null;
                      return (
                      <SelectItem key={st.id} value={String(st.id)} label={tLibelle} className="font-bold text-xs uppercase" title={tDesc || ''}>
                        <div className="flex flex-col gap-0.5">
                          <span>{tLibelle}</span>
                          {tDesc && (
                            <span className="text-[9px] font-medium text-slate-400 normal-case">{tDesc}</span>
                          )}
                        </div>
                      </SelectItem>
                    )})}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                <div className="bg-white p-2 rounded-full shadow-md text-[#0055A4]">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-slate-400">{t('portal.at_line')}</Label>
                  <p className="text-sm font-black text-slate-700 tracking-tight">{userPhone}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm relative">
              <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                <Search className="w-3.5 h-3.5" /> {t('portal.service')}
              </Label>
              <div className="mt-3">
                <p className="text-base font-black text-slate-900 leading-none">{t('portal.at_zone')}</p>
                <p className="text-[11px] font-black text-[#0055A4] uppercase mt-1">{t('portal.auto_detection')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">{t('ticket_form.description_label')}</Label>
              <Textarea
                className="min-h-[140px] rounded-xl font-medium"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ticket_form.description_label')}
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-500">{t('ticket_form.attachment_label')}</Label>
              <div className="flex items-center gap-4">
                <label className="flex-1 border-2 border-dashed border-slate-200 rounded-xl p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf" />
                  <div className="flex items-center gap-3">
                    <FileUp className="w-5 h-5 text-slate-400" />
                    <p className="text-xs font-black text-slate-600 uppercase">{t('ticket_form.attachment_label')}</p>
                  </div>
                </label>
                {attachmentPreview && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border">
                    <img src={attachmentPreview} className="w-full h-full object-cover" alt="Preview" />
                    <button type="button" onClick={() => { setAttachment(null); setAttachmentPreview(null); }}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <LanguageButton
              label={t('ticket_form.submit')}
              arabicLabel="إرسال الطلب"
              className="w-full py-10 text-xl font-black bg-[#0055A4] text-white rounded-xl shadow-lg hover:bg-[#004080]"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="ml-2 h-6 w-6 animate-spin" />}
            </LanguageButton>
          </form>
        ) : (
          /* ─── Ticket confirmed ─── */
          <div className="bg-white p-8 rounded-3xl border shadow-xl space-y-6 text-center">
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 inline-block">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ticket Créé !</h2>
            <p className="text-sm font-bold text-slate-500">
              Votre réclamation <span className="text-[#0055A4] font-black">{createdTicket.numero_ticket || `#${createdTicket.id}`}</span> a bien été enregistrée.
            </p>
            <p className="text-xs text-slate-400 font-bold">Vous pouvez discuter avec votre agent directement dans le chat à droite →</p>
            <button
              onClick={handleNewTicket}
              className="mt-4 px-8 py-3 bg-[#0055A4] text-white rounded-xl font-black text-xs uppercase hover:bg-[#004080] transition-colors cursor-pointer"
            >
              Nouvelle Réclamation
            </button>
          </div>
        )}
      </div>

      {/* ─── Right column ─── */}
      <div className="space-y-6">
        {!createdTicket ? (
          /* SLA card */
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
            <h4 className="text-sm font-black text-emerald-800 uppercase">Engagement SLA</h4>
            <p className="text-[10px] text-emerald-600 mt-2 font-bold uppercase">Résolution sous 72h maximum.</p>
          </div>
        ) : (
          /* ─── Inline Chat Panel ─── */
          <div className="bg-white rounded-3xl border shadow-xl flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '400px' }}>
            {/* Chat header */}
            <div className="bg-[#0055A4] text-white p-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">Chat en direct</p>
                  <p className="text-[9px] font-bold text-white/60 uppercase">{createdTicket.numero_ticket || `#${createdTicket.id}`}</p>
                </div>
                {isConnected && (
                  <Badge className="ml-auto bg-emerald-500/20 text-emerald-200 text-[8px] font-black uppercase border-none">
                    ● Connecté
                  </Badge>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Description as first message */}
              {description && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] p-4 rounded-2xl rounded-tr-none text-sm shadow bg-[#0055A4] text-white">
                    <p className="font-bold leading-relaxed">{description}</p>
                    <p className="text-[8px] mt-2 font-black uppercase opacity-50">Vous • À l'instant</p>
                  </div>
                </div>
              )}

              {allMessages.map((m, idx) => {
                const isCustomer = m.expediteur_role === 'client' || m.expediteur_type === 'client';
                const pj = m.piece_jointe_info;
                return (
                  <div key={m.id || idx} className={cn("flex", isCustomer ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm shadow",
                      isCustomer ? 'bg-[#0055A4] text-white rounded-tr-none' : 'bg-slate-50 border text-slate-800 rounded-tl-none'
                    )}>
                      <p className="font-bold leading-relaxed">{m.contenu || m.text}</p>
                      {pj && (
                        <button onClick={() => handlePreview(pj)}
                          className={cn("mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer",
                            isCustomer ? "bg-white/20 text-white" : "bg-white text-[#0055A4] border"
                          )}>
                          {pj.type_mime?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          <span className="truncate max-w-[120px]">{pj.nom_fichier}</span>
                        </button>
                      )}
                      <p className={cn("text-[8px] mt-2 font-black uppercase opacity-50", isCustomer ? 'text-white' : 'text-slate-400')}>
                        {isCustomer ? 'Vous' : 'Agent'} • {m.date_envoi ? new Date(m.date_envoi).toLocaleTimeString('fr-FR') : ''}
                      </p>
                    </div>
                  </div>
                );
              })}

              {allMessages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    En attente d'un agent...
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            <div className="p-3 border-t bg-white shrink-0 space-y-2">
              {pendingFile && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border text-xs">
                  {pendingPreview ? (
                    <img src={pendingPreview} className="w-8 h-8 rounded object-cover" alt="" />
                  ) : (
                    <FileText className="w-4 h-4 text-[#0055A4]" />
                  )}
                  <span className="flex-1 truncate font-bold text-slate-600">{pendingFile.name}</span>
                  <button onClick={() => { setPendingFile(null); setPendingPreview(null); }} className="text-slate-400 hover:text-red-500 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input type="file" ref={chatFileRef} className="hidden" onChange={handleChatFileSelect} accept="image/*,.pdf,.doc,.docx" />
                <button onClick={() => chatFileRef.current?.click()}
                  className="px-2 text-slate-400 hover:text-[#0055A4] transition-colors cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  placeholder="Votre message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-slate-50 focus:bg-white focus:border-[#0055A4] outline-none transition-colors"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleChatSend(); } }}
                />
                <button
                  onClick={handleChatSend}
                  disabled={(!replyText.trim() && !pendingFile) || sendingMsg}
                  className="px-3 py-2.5 bg-[#0055A4] text-white rounded-xl disabled:opacity-40 cursor-pointer transition-transform active:scale-95"
                >
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Preview Modal */}
    {previewFile && (
      <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center" onClick={closePreview}>
        <div className="w-full max-w-4xl flex items-center justify-between px-6 py-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-white" />
            <p className="text-white font-bold text-sm truncate max-w-md">{previewFile.nom}</p>
          </div>
          <button onClick={closePreview} className="text-white hover:text-red-400 transition-colors cursor-pointer bg-white/10 p-2 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="w-full max-w-4xl max-h-[80vh] flex-1 flex items-center justify-center px-6 pb-6" onClick={e => e.stopPropagation()}>
          {previewFile.type_mime?.startsWith('image/') ? (
            <img src={previewFile.blobUrl} alt={previewFile.nom} className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl" />
          ) : previewFile.type_mime === 'application/pdf' ? (
            <iframe src={previewFile.blobUrl} title={previewFile.nom} className="w-full h-[75vh] rounded-2xl shadow-2xl bg-white" />
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center shadow-2xl">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-slate-700">{previewFile.nom}</p>
            </div>
          )}
        </div>
      </div>
    )}
      <SupportChatbot 
        isOpen={showChatbot} 
        ticketData={pendingTicketData} 
        onCancel={() => setShowChatbot(false)} 
        onForceSubmit={executeFinalSubmission} 
      />
    </>
  );
}
