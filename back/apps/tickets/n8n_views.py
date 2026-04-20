"""
Endpoints API pour l'intégration n8n (réclamations par email).
Sécurisés par une clé API dans le header X-N8N-API-Key.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from django.conf import settings
from django.contrib.auth.hashers import check_password


# ============================================================
# PERMISSION — Clé API n8n
# ============================================================
class EstN8N(BasePermission):
    """Vérifie la clé API n8n dans le header X-N8N-API-Key"""
    def has_permission(self, request, view):
        api_key = request.headers.get('X-N8N-API-Key', '')
        expected = getattr(settings, 'N8N_API_KEY', '')
        return api_key and api_key == expected


# ============================================================
# CHECK EMAIL — Vérifie si un email est enregistré
# ============================================================
class CheckEmailView(APIView):
    permission_classes = [EstN8N]

    def post(self, request):
        """
        POST /api/n8n/check-email/
        Body: { "email": "client@example.com" }
        Response: { "found": true/false, "client_id": "...", "nom": "...", "prenom": "..." }
        """
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email requis'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.users.models import Utilisateur
        try:
            user = Utilisateur.objects.get(email__iexact=email, role='client', actif=True)
            return Response({
                'found': True,
                'client_id': str(user.id),
                'nom': user.nom,
                'prenom': user.prenom,
                'telephone': user.telephone,
            })
        except Utilisateur.DoesNotExist:
            return Response({'found': False})


# ============================================================
# AUTHENTICATE — Auth par téléphone + mot de passe
# ============================================================
class AuthenticateView(APIView):
    permission_classes = [EstN8N]

    def post(self, request):
        """
        POST /api/n8n/authenticate/
        Body: { "telephone": "0557...", "password": "..." }
        Response: { "success": true, "client_id": "...", "nom": "...", "email": "..." }
        """
        telephone = request.data.get('telephone', '').strip()
        password = request.data.get('password', '')

        if not telephone or not password:
            return Response(
                {'error': 'Téléphone et mot de passe requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.users.models import Utilisateur
        try:
            user = Utilisateur.objects.get(telephone=telephone, role='client', actif=True)
        except Utilisateur.DoesNotExist:
            return Response({'success': False, 'error': 'Numéro non reconnu'})

        if not user.check_password(password):
            return Response({'success': False, 'error': 'Mot de passe incorrect'})

        return Response({
            'success': True,
            'client_id': str(user.id),
            'nom': user.nom,
            'prenom': user.prenom,
            'email': user.email or '',
        })


# ============================================================
# CREATE TICKET — Crée un ticket source=email
# ============================================================
class CreateTicketView(APIView):
    permission_classes = [EstN8N]

    def post(self, request):
        """
        POST /api/n8n/create-ticket/
        Body: {
            "client_id": "uuid",
            "email_source": "client@example.com",
            "titre": "...",
            "description": "...",
            "type_service_code": "DERNG_FIXE" (optionnel)
        }
        """
        from apps.users.models import Utilisateur
        from apps.tickets.models import Ticket, TypeService
        from apps.centres.models import ParametresCentre
        from django.utils import timezone
        from datetime import timedelta

        client_id = request.data.get('client_id')
        email_source = request.data.get('email_source', '').strip()
        titre = request.data.get('titre', '').strip()
        description = request.data.get('description', '').strip()
        type_code = request.data.get('type_service_code', '')

        if not client_id or not titre or not description:
            return Response(
                {'error': 'client_id, titre et description requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            client = Utilisateur.objects.get(id=client_id, role='client')
        except Utilisateur.DoesNotExist:
            return Response({'error': 'Client introuvable'}, status=status.HTTP_404_NOT_FOUND)

        centre = client.centre
        if not centre:
            return Response(
                {'error': 'Client non rattaché à un centre'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Type de service
        type_service = None
        if type_code:
            try:
                type_service = TypeService.objects.get(code=type_code, actif=True)
            except TypeService.DoesNotExist:
                pass
        if not type_service:
            type_service = TypeService.objects.filter(actif=True).first()

        # Mettre à jour l'email du client si pas encore défini
        if email_source and not client.email:
            client.email = email_source
            client.save(update_fields=['email'])

        # Créer le ticket
        ticket = Ticket.objects.create(
            client=client,
            centre=centre,
            type_service=type_service,
            titre=titre,
            description=description,
            source='email',
            email_source=email_source,
            email_actif=True,
            priorite='normale',
        )

        # SLA
        try:
            params = ParametresCentre.objects.get(centre=centre)
            ticket.echeance_sla = timezone.now() + timedelta(hours=params.sla_heures_normale)
            ticket.save()
        except ParametresCentre.DoesNotExist:
            pass

        # Auto-assignation
        try:
            params = ParametresCentre.objects.get(centre=centre)
            if params.attribution_auto_active:
                from apps.users.models import Role
                agents = Utilisateur.objects.filter(centre=centre, role=Role.AGENT, actif=True)
                if agents.exists():
                    agent_min = min(
                        agents,
                        key=lambda a: a.tickets_agent.filter(statut__in=['ouvert', 'en_cours']).count()
                    )
                    ticket.agent = agent_min
                    ticket.attribution_auto = True
                    ticket.save()
        except ParametresCentre.DoesNotExist:
            pass

        return Response({
            'ticket_id': str(ticket.id),
            'numero_ticket': ticket.numero_ticket,
            'agent_assigne': f"{ticket.agent.prenom} {ticket.agent.nom}" if ticket.agent else None,
        }, status=status.HTTP_201_CREATED)


# ============================================================
# WEBHOOK REPLY — Reçoit un message email du client
# ============================================================
class WebhookReplyView(APIView):
    permission_classes = [EstN8N]

    def post(self, request):
        """
        POST /api/n8n/webhook/reply/
        Body: {
            "ticket_id": "uuid",
            "contenu": "Le texte du message",
            "email_source": "client@example.com"
        }
        """
        from apps.tickets.models import Ticket
        from apps.chat.models import Message

        ticket_id = request.data.get('ticket_id')
        contenu = request.data.get('contenu', '').strip()

        if not ticket_id or not contenu:
            return Response(
                {'error': 'ticket_id et contenu requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.statut in ['ferme', 'rejete']:
            return Response(
                {'error': 'Ticket fermé, impossible d\'ajouter un message'},
                status=status.HTTP_400_BAD_REQUEST
            )

        message = Message.objects.create(
            ticket=ticket,
            expediteur=ticket.client,
            expediteur_type='client',
            contenu=contenu,
            via_email=True,
            lu_par_client=True,
            lu_par_agent=False,
        )

        return Response({
            'message_id': message.id,
            'created_at': message.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


# ============================================================
# TYPES SERVICE — Liste pour que l'IA choisisse
# ============================================================
class TypesServiceListView(APIView):
    permission_classes = [EstN8N]

    def get(self, request):
        """GET /api/n8n/types-service/ — Liste des types de service actifs"""
        from apps.tickets.models import TypeService
        types = TypeService.objects.filter(actif=True).values('code', 'libelle', 'description')
        return Response(list(types))
