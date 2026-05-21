from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import Message
from .serializers import MessageSerializer, EnvoyerMessageSerializer
from apps.tickets.models import Ticket


def get_expediteur_type(user):
    """Retourne le type d'expÃ©diteur selon le rÃ´le"""
    role_map = {
        'client':          'client',
        'agent':           'agent',
        'agent_technique': 'agent_technique',
        'agent_annexe':    'agent_annexe',
        'admin':           'agent',
    }
    return role_map.get(user.role, 'systeme')


def verifier_acces_ticket(user, ticket):
    """VÃ©rifie si l'utilisateur a accÃ¨s Ã  la discussion du ticket"""
    if user.role == 'client':
        return ticket.client == user
    elif user.role == 'agent':
        return ticket.agent == user
    elif user.role == 'agent_technique':
        return ticket.agent_technique == user or ticket.statut == 'escalade'
    elif user.role == 'agent_annexe':
        return ticket.agent_annexe == user or ticket.statut == 'escalade'
    elif user.role == 'admin':
        return ticket.centre == user.centre
    return False


# ============================================================
# MESSAGES D'UN TICKET (API REST)
# ============================================================
class MessagesTicketView(APIView):
    permission_classes = [IsAuthenticated]

    def get_ticket(self, ticket_id):
        try:
            return Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return None

    def get(self, request, ticket_id):
        """RÃ©cupÃ©rer tous les messages d'un ticket"""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if not verifier_acces_ticket(request.user, ticket):
            return Response({'error': 'AccÃ¨s refusÃ©'}, status=status.HTTP_403_FORBIDDEN)

        messages = ticket.messages.all().order_by('created_at')

        # Clients ne voient pas les messages internes
        if request.user.role == 'client':
            messages = messages.filter(interne=False)

        # Marquer les messages comme lus
        if request.user.role == 'client':
            messages.filter(lu_par_client=False).exclude(
                expediteur_type='client'
            ).update(lu_par_client=True)
        elif request.user.role in ['agent', 'agent_technique', 'agent_annexe']:
            messages.filter(lu_par_agent=False).exclude(
                expediteur_type__in=['agent', 'agent_technique', 'agent_annexe']
            ).update(lu_par_agent=True)

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request, ticket_id):
        """Envoyer un message dans un ticket (avec fichier optionnel)"""
        ticket = self.get_ticket(ticket_id)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if not verifier_acces_ticket(request.user, ticket):
            return Response({'error': 'AccÃ¨s refusÃ©'}, status=status.HTTP_403_FORBIDDEN)

        if ticket.statut in ['ferme', 'rejete']:
            return Response(
                {'error': 'Impossible d\'envoyer un message sur un ticket fermÃ© ou rejetÃ©'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = EnvoyerMessageSerializer(data=request.data)
        if serializer.is_valid():
            expediteur_type = get_expediteur_type(request.user)

            # Handle file upload if present
            piece_jointe = None
            fichier = request.FILES.get('fichier') or serializer.validated_data.get('fichier')
            if fichier:
                from apps.tickets.models import PieceJointe
                piece_jointe = PieceJointe.objects.create(
                    ticket=ticket,
                    uploaded_by=request.user,
                    nom_fichier=fichier.name,
                    type_mime=fichier.content_type or 'application/octet-stream',
                    taille_octets=fichier.size,
                    contenu=fichier.read(),
                )

            contenu = serializer.validated_data.get('contenu', '').strip()
            if not contenu and piece_jointe:
                contenu = f"ðŸ“Ž {piece_jointe.nom_fichier}"

            # Filtrer les mots inappropriÃ©s
            from apps.chat.profanity_filter import censurer_message
            contenu, was_censored = censurer_message(contenu)

            message = Message.objects.create(
                ticket=ticket,
                expediteur=request.user,
                expediteur_type=expediteur_type,
                contenu=contenu,
                piece_jointe=piece_jointe,
                lu_par_client=(request.user.role == 'client'),
                lu_par_agent=(request.user.role != 'client'),
            )
            
            # Changer le statut du ticket si un agent rÃ©pond
            if request.user.role != 'client' and ticket.statut in ['soumis']:
                ticket.statut = 'en_cours'
                ticket.save()

            # Relais email : si ticket source=email et email_actif, notifier n8n
            if (request.user.role != 'client' and 
                ticket.source == 'email' and 
                ticket.email_actif and 
                ticket.email_source):
                try:
                    import requests as http_requests
                    from django.conf import settings as django_settings
                    webhook_url = django_settings.N8N_WEBHOOK_URL + 'agent-reply'
                    http_requests.post(webhook_url, json={
                        'ticket_id': str(ticket.id),
                        'numero_ticket': ticket.numero_ticket,
                        'email_destination': ticket.email_source,
                        'agent_nom': f"{request.user.prenom} {request.user.nom}",
                        'contenu': serializer.validated_data['contenu'],
                    }, timeout=5)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Webhook n8n Ã©chouÃ©: {e}")
                message.via_email = True
                message.save(update_fields=['via_email'])

            return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# MESSAGES NON LUS
# ============================================================
class MessagesNonLusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Nombre de messages non lus pour l'utilisateur connectÃ©"""
        if request.user.role == 'client':
            count = Message.objects.filter(
                ticket__client=request.user,
                lu_par_client=False,
            ).exclude(expediteur_type='client').count()
        else:
            count = Message.objects.filter(
                ticket__agent=request.user,
                lu_par_agent=False,
            ).exclude(expediteur_type__in=['agent', 'agent_technique', 'agent_annexe']).count()

        return Response({'messages_non_lus': count})


# ============================================================
# RÃ‰SUMÃ‰ IA DE LA DISCUSSION (pour agents technique/annexe)
# ============================================================
class ResumeIAView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id):
        """GÃ©nÃ¨re un rÃ©sumÃ© intelligent de la discussion d'un ticket"""
        try:
            ticket = Ticket.objects.select_related('client', 'agent', 'type_service').get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if not verifier_acces_ticket(request.user, ticket):
            return Response({'error': 'AccÃ¨s refusÃ©'}, status=status.HTTP_403_FORBIDDEN)

        messages = ticket.messages.all().order_by('created_at')
        escalades = ticket.escalades.all().order_by('-created_at')

        # Construire le rÃ©sumÃ©
        client_name = f"{ticket.client.prenom} {ticket.client.nom}" if ticket.client else "Inconnu"
        agent_name = f"{ticket.agent.prenom} {ticket.agent.nom}" if ticket.agent else "Non assignÃ©"
        service = ticket.type_service.libelle if ticket.type_service else "Non spÃ©cifiÃ©"

        # Statistiques de la conversation
        total_msgs = messages.count()
        client_msgs = messages.filter(expediteur_type='client').count()
        agent_msgs = total_msgs - client_msgs

        # Timeline rÃ©sumÃ©e (Informations rÃ©duites, le reste est dans la barre)
        timeline = []

        # RÃ©sumÃ© des escalades
        for esc in escalades:
            source = f"{esc.agent_source.prenom} {esc.agent_source.nom}" if esc.agent_source else "Inconnu"
            timeline.append(f"ðŸ”º Escalade {esc.type_escalade} par {source} â€” Motif : {esc.motif}")

        # Extraire les messages clÃ©s (premier, dernier du client, dernier de l'agent)
        key_messages = []
        if messages.exists():
            first_msg = messages.first()
            key_messages.append({
                'role': first_msg.expediteur_type,
                'contenu': first_msg.contenu[:200],
                'date': first_msg.created_at.strftime('%d/%m %H:%M'),
                'label': 'Premier message'
            })

            last_client_msg = messages.filter(expediteur_type='client').last()
            if last_client_msg and last_client_msg.id != first_msg.id:
                key_messages.append({
                    'role': 'client',
                    'contenu': last_client_msg.contenu[:200],
                    'date': last_client_msg.created_at.strftime('%d/%m %H:%M'),
                    'label': 'Dernier message client'
                })

            last_agent_msg = messages.exclude(expediteur_type='client').last()
            if last_agent_msg:
                key_messages.append({
                    'role': last_agent_msg.expediteur_type,
                    'contenu': last_agent_msg.contenu[:200],
                    'date': last_agent_msg.created_at.strftime('%d/%m %H:%M'),
                    'label': 'DerniÃ¨re rÃ©ponse agent'
                })

        # GÃ©nÃ©ration du rÃ©sumÃ© textuel (LaissÃ© vide pour l'intÃ©gration de l'API externe)
        summary_text = ""

        return Response({
            'resume': summary_text,
            'timeline': timeline,
            'messages_cles': key_messages,
            'stats': {
                'total_messages': total_msgs,
                'messages_client': client_msgs,
                'messages_agent': agent_msgs,
                'duree_jours': (timezone.now() - ticket.created_at).days if ticket.created_at else 0,
            }
        })
class ResumeIAView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id):
        from apps.tickets.models import Ticket
        try:
            ticket = Ticket.objects.select_related('client', 'agent', 'type_service').get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if not verifier_acces_ticket(request.user, ticket):
            return Response({'error': 'Accès refusé'}, status=status.HTTP_403_FORBIDDEN)

        # Get latest resume from escalades or ticket
        escalades = ticket.escalades.all().order_by('-created_at')
        if escalades.exists() and escalades.first().resume_ia:
            resume = escalades.first().resume_ia
        else:
            resume = ticket.resume_ia

        return Response({
            'resume': resume,
            'stats': {
                'total_messages': ticket.messages.count()
            }
        })
