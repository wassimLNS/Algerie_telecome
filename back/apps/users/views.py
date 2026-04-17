from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone

from .models import Utilisateur, HistoriqueConnexion, Role, LigneTelephonique
from .serializers import (
    LoginClientSerializer,
    LoginAgentSerializer,
    UtilisateurProfilSerializer,
    CreerAgentSerializer,
    ModifierAgentSerializer,
    AgentListSerializer,
    HistoriqueConnexionSerializer,
    LigneTelephoniqueSerializer,
)
from .permissions import EstAdmin, EstClient, EstAgentOuPlus


def get_tokens_for_user(user):
    """Génère access token + refresh token pour un utilisateur"""
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def log_connexion(utilisateur, request, succes=True, raison_echec=None):
    """Enregistre une tentative de connexion"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')

    HistoriqueConnexion.objects.create(
        utilisateur=utilisateur,
        ip_adresse=ip,
        user_agent=request.META.get('HTTP_USER_AGENT', ''),
        succes=succes,
        raison_echec=raison_echec,
    )


# ============================================================
# LOGIN CLIENT
# ============================================================
class LoginClientView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginClientSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']

            # Mettre à jour la dernière connexion
            user.derniere_connexion = timezone.now()
            user.save(update_fields=['derniere_connexion'])

            # Logger la connexion
            log_connexion(user, request, succes=True)

            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Connexion réussie',
                'user': UtilisateurProfilSerializer(user).data,
                'tokens': tokens,
            }, status=status.HTTP_200_OK)

        # Logger l'échec si on trouve l'utilisateur
        telephone = request.data.get('telephone')
        if telephone:
            try:
                user = Utilisateur.objects.get(telephone=telephone)
                log_connexion(user, request, succes=False, raison_echec='mot_de_passe_incorrect')
            except Utilisateur.DoesNotExist:
                pass

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# LOGIN AGENT / ADMIN
# ============================================================
class LoginAgentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginAgentSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']

            # Mettre à jour la dernière connexion
            user.derniere_connexion = timezone.now()
            user.save(update_fields=['derniere_connexion'])

            # Logger la connexion
            log_connexion(user, request, succes=True)

            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Connexion réussie',
                'user': UtilisateurProfilSerializer(user).data,
                'tokens': tokens,
            }, status=status.HTTP_200_OK)

        # Logger l'échec
        email = request.data.get('email')
        if email:
            try:
                user = Utilisateur.objects.get(email=email)
                log_connexion(user, request, succes=False, raison_echec='mot_de_passe_incorrect')
            except Utilisateur.DoesNotExist:
                pass

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# LOGOUT
# ============================================================
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()

            # Mettre à jour la déconnexion dans l'historique
            derniere = HistoriqueConnexion.objects.filter(
                utilisateur=request.user,
                succes=True,
                deconnecte_a__isnull=True
            ).last()
            if derniere:
                derniere.deconnecte_a = timezone.now()
                derniere.save()

            return Response({'message': 'Déconnexion réussie'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Token invalide'}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# MON PROFIL
# ============================================================
class MonProfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UtilisateurProfilSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UtilisateurProfilSerializer(
            request.user, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# GESTION DES AGENTS (admin seulement)
# ============================================================
class AgentsView(APIView):
    permission_classes = [IsAuthenticated, EstAdmin]

    def get(self, request):
        """Liste des agents du centre de l'admin"""
        agents = Utilisateur.objects.filter(
            centre=request.user.centre,
            role__in=[Role.AGENT, Role.AGENT_TECHNIQUE, Role.AGENT_ANNEXE]
        )
        serializer = AgentListSerializer(agents, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Créer un nouvel agent"""
        serializer = CreerAgentSerializer(data=request.data)
        if serializer.is_valid():
            # Forcer le centre de l'admin
            agent = serializer.save(centre=request.user.centre)
            return Response(
                UtilisateurProfilSerializer(agent).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ClientsView(APIView):
    permission_classes = [IsAuthenticated, EstAdmin]

    def get(self, request):
        """Liste des clients (filtrés par centre si l'admin appartient à un centre)"""
        clients = Utilisateur.objects.filter(role=Role.CLIENT)
        if getattr(request.user, 'centre', None):
            clients = clients.filter(centre=request.user.centre)
        
        serializer = UtilisateurProfilSerializer(clients, many=True)
        return Response(serializer.data)


class AgentDetailView(APIView):
    permission_classes = [IsAuthenticated, EstAdmin]

    def get_agent(self, agent_id, admin):
        """Récupère un agent du même centre que l'admin"""
        try:
            return Utilisateur.objects.get(
                id=agent_id,
                centre=admin.centre,
                role__in=[Role.AGENT, Role.AGENT_TECHNIQUE, Role.AGENT_ANNEXE]
            )
        except Utilisateur.DoesNotExist:
            return None

    def get(self, request, agent_id):
        agent = self.get_agent(agent_id, request.user)
        if not agent:
            return Response({'error': 'Agent introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(UtilisateurProfilSerializer(agent).data)

    def put(self, request, agent_id):
        agent = self.get_agent(agent_id, request.user)
        if not agent:
            return Response({'error': 'Agent introuvable'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ModifierAgentSerializer(agent, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, agent_id):
        """Désactiver un agent (pas de suppression physique)"""
        agent = self.get_agent(agent_id, request.user)
        if not agent:
            return Response({'error': 'Agent introuvable'}, status=status.HTTP_404_NOT_FOUND)
        agent.actif = False
        agent.save()
        return Response({'message': 'Agent désactivé avec succès'})


# ============================================================
# HISTORIQUE DES CONNEXIONS (admin seulement)
# ============================================================
class HistoriqueConnexionsView(APIView):
    permission_classes = [IsAuthenticated, EstAdmin]

    def get(self, request):
        """Historique des connexions des utilisateurs (staff+clients) liés au centre"""
        users = Utilisateur.objects.filter(centre=request.user.centre)
        
        # Filtre par rôle : 'client' ou 'staff' (tout ce qui n'est pas client)
        role_filter = request.query_params.get('role', 'all')
        if role_filter == 'clients':
            users = users.filter(role='client')
        elif role_filter == 'staff':
            users = users.exclude(role='client')
            
        users_ids = users.values_list('id', flat=True)

        historique = HistoriqueConnexion.objects.filter(
            utilisateur_id__in=users_ids
        )

        search = request.query_params.get('search')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if search:
            from django.db.models import Q
            historique = historique.filter(
                Q(utilisateur__nom__icontains=search) | 
                Q(utilisateur__prenom__icontains=search) | 
                Q(utilisateur__email__icontains=search) |
                Q(ip_adresse__icontains=search)
            )
        
        if start_date:
            historique = historique.filter(connecte_a__gte=start_date + 'T00:00:00Z')
        if end_date:
            historique = historique.filter(connecte_a__lte=end_date + 'T23:59:59Z')

        historique = historique.order_by('-connecte_a')[:200]

        serializer = HistoriqueConnexionSerializer(historique, many=True)
        return Response(serializer.data)


# ============================================================
# LIGNES TÉLÉPHONIQUES (client)
# ============================================================
class LignesView(APIView):
    permission_classes = [IsAuthenticated, EstClient]

    def get(self, request):
        """Liste des lignes téléphoniques du client connecté"""
        lignes = LigneTelephonique.objects.filter(client=request.user, actif=True)
        serializer = LigneTelephoniqueSerializer(lignes, many=True)
        return Response(serializer.data)

    def post(self, request):
        """Ajouter une ligne téléphonique"""
        serializer = LigneTelephoniqueSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(client=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LigneDetailView(APIView):
    permission_classes = [IsAuthenticated, EstClient]

    def get_ligne(self, ligne_id, client):
        try:
            return LigneTelephonique.objects.get(id=ligne_id, client=client)
        except LigneTelephonique.DoesNotExist:
            return None

    def get(self, request, ligne_id):
        ligne = self.get_ligne(ligne_id, request.user)
        if not ligne:
            return Response({'error': 'Ligne introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(LigneTelephoniqueSerializer(ligne).data)

    def put(self, request, ligne_id):
        ligne = self.get_ligne(ligne_id, request.user)
        if not ligne:
            return Response({'error': 'Ligne introuvable'}, status=status.HTTP_404_NOT_FOUND)
        serializer = LigneTelephoniqueSerializer(ligne, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, ligne_id):
        ligne = self.get_ligne(ligne_id, request.user)
        if not ligne:
            return Response({'error': 'Ligne introuvable'}, status=status.HTTP_404_NOT_FOUND)
        ligne.actif = False
        ligne.save()
        return Response({'message': 'Ligne désactivée avec succès'})
    
# ============================================================
# HISTORIQUE CONNEXIONS CLIENTS (agent + admin)
# ============================================================
class HistoriqueConnexionsClientsView(APIView):
    permission_classes = [IsAuthenticated, EstAgentOuPlus]

    def get(self, request):
        """Historique des connexions des clients du centre"""
        clients_ids = Utilisateur.objects.filter(
            centre=request.user.centre,
            role='client'
        ).values_list('id', flat=True)

        historique = HistoriqueConnexion.objects.filter(
            utilisateur_id__in=clients_ids
        ).order_by('-connecte_a')[:100]

        serializer = HistoriqueConnexionSerializer(historique, many=True)
        return Response(serializer.data)