from django.urls import path
from .views import (
    LoginClientView,
    LoginAgentView,
    LogoutView,
    MonProfilView,
    AgentsView,
    AgentDetailView,
    HistoriqueConnexionsView,
    LignesView,
    LigneDetailView,
    HistoriqueConnexionsClientsView,
    ClientsView,
)

urlpatterns = [
    # Auth
    path('login/client/',   LoginClientView.as_view(),  name='login-client'),
    path('login/agent/',    LoginAgentView.as_view(),   name='login-agent'),
    path('logout/',         LogoutView.as_view(),       name='logout'),

    # Profil
    path('me/',             MonProfilView.as_view(),    name='mon-profil'),

    # Gestion agents (admin)
    path('agents/',         AgentsView.as_view(),       name='agents-list'),
    path('client/',         ClientsView.as_view(),      name='clients-list'),
    path('agents/<uuid:agent_id>/', AgentDetailView.as_view(), name='agent-detail'),

    # Historique connexions (admin)
    path('connexions/',     HistoriqueConnexionsView.as_view(), name='historique-connexions'),
    path('clients/connexions/', HistoriqueConnexionsClientsView.as_view(), name='historique-connexions-clients'),

    # Lignes téléphoniques (client)
    path('mes-lignes/',                     LignesView.as_view(),       name='mes-lignes'),
    path('mes-lignes/<int:ligne_id>/',      LigneDetailView.as_view(),  name='ligne-detail'),
]