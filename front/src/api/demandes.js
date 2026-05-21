import api from './axios';

// ─── Demandes Agent ─────────────────────────────────────────
export const getMesDemandes = async () => {
  const response = await api.get('/users/demandes/');
  return response.data;
};

export const creerDemande = async (data) => {
  const response = await api.post('/users/demandes/', data);
  return response.data;
};

// ─── Demandes Admin ─────────────────────────────────────────
export const getDemandesAdmin = async () => {
  const response = await api.get('/users/demandes/admin/');
  return response.data;
};

export const traiterDemandeAdmin = async (id, data) => {
  const response = await api.put(`/users/demandes/admin/${id}/`, data);
  return response.data;
};

// ─── Demandes Admin IT ──────────────────────────────────────
export const getDemandesIT = async (statut = 'approuvee') => {
  const response = await api.get(`/users/demandes/it/?statut=${statut}`);
  return response.data;
};

export const traiterDemandeIT = async (id, data) => {
  // If data is FormData (contains file), send as multipart
  if (data instanceof FormData) {
    const response = await api.put(`/users/demandes/it/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  const response = await api.put(`/users/demandes/it/${id}/`, data);
  return response.data;
};

// Download attached file from IT response
export const downloadFichierDemande = async (demandeId) => {
  const response = await api.get(`/users/demandes/${demandeId}/fichier/`, { responseType: 'blob' });
  return response;
};

// Generate connection report XLSX
export const genererRapportConnexions = async (centreId, dateFrom, dateTo, role = '') => {
  let url = `/users/rapport-connexions/?centre=${centreId}&date_from=${dateFrom}&date_to=${dateTo}`;
  if (role) url += `&role=${role}`;
  const response = await api.get(url, { responseType: 'blob' });
  return response;
};
