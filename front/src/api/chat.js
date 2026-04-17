import api from './axios';

// Get messages for a ticket
export const getMessages = async (ticketId) => {
  const response = await api.get(`/chat/${ticketId}/messages/`);
  return response.data;
};

// Send a message on a ticket
export const sendMessage = async (ticketId, contenu) => {
  const response = await api.post(`/chat/${ticketId}/messages/`, { contenu });
  return response.data;
};

export const getAISummary = async (ticketId) => {
  const response = await api.get(`/chat/${ticketId}/resume-ia/`);
  return response.data;
};

// Get unread message count
export const getUnreadCount = async () => {
  const response = await api.get('/chat/non-lus/');
  return response.data;
};
