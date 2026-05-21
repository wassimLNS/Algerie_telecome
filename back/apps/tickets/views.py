from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Ticket, TypeService, PieceJointe, Escalade
from .serializers import (TypeServiceSerializer, CreerTicketSerializer, TicketListSerializer, TicketDetailSerializer, MettreAJourTicketSerializer, SatisfactionSerializer, PieceJointeUploadSerializer, CreerEscaladeSerializer, EscaladeSerializer)
from apps.users.permissions import EstClient, EstAgent, EstAgentEscalade, EstAdmin, EstAgentOuPlus


class TypesServiceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        types = TypeService.objects.filter(actif=True)
        return Response(TypeServiceSerializer(types, many=True).data)


class MesTicketsView(APIView):
    permission_classes = [IsAuthenticated, EstClient]

    def get(self, request):
        tickets = Ticket.objects.filter(client=request.user).order_by('-created_at')
        return Response(TicketListSerializer(tickets, many=True).data)

    def post(self, request):
        serializer = CreerTicketSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            ticket = serializer.save()
            return Response(TicketDetailSerializer(ticket).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MonTicketDetailView(APIView):
    permission_classes = [IsAuthenticated, EstClient]

    def get_ticket(self, ticket_id, client):
        try:
            return Ticket.objects.get(id=ticket_id, client=client)
        except Ticket.DoesNotExist:
            return None

    def get(self, request, ticket_id):
        ticket = self.get_ticket(ticket_id, request.user)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TicketDetailSerializer(ticket).data)

    def post(self, request, ticket_id):
        ticket = self.get_ticket(ticket_id, request.user)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        if ticket.statut not in ['resolu', 'ferme']:
            return Response({'error': 'Vous ne pouvez noter que les tickets rÃ©solus ou fermÃ©s'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = SatisfactionSerializer(ticket, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, ticket_id):
        ticket = self.get_ticket(ticket_id, request.user)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        if ticket.statut != 'soumis':
            return Response({'error': 'Seuls les tickets non ouverts (soumis) peuvent Ãªtre supprimÃ©s.'}, status=status.HTTP_400_BAD_REQUEST)
        ticket.delete()
        return Response({'message': 'Ticket supprimÃ© avec succÃ¨s.'}, status=status.HTTP_204_NO_CONTENT)


class MesTicketsAgentView(APIView):
    permission_classes = [IsAuthenticated, EstAgent]

    def get(self, request):
        tickets = Ticket.objects.filter(agent=request.user).order_by('-created_at')
        return Response(TicketListSerializer(tickets, many=True).data)


class TicketAgentDetailView(APIView):
    permission_classes = [IsAuthenticated, EstAgentOuPlus]

    def get_ticket(self, ticket_id, agent):
        try:
            if agent.role == 'agent':
                return Ticket.objects.get(id=ticket_id, agent=agent)
            elif agent.role == 'agent_technique':
                return Ticket.objects.get(id=ticket_id, agent_technique=agent, statut='escalade')
            elif agent.role == 'agent_annexe':
                return Ticket.objects.get(id=ticket_id, agent_annexe=agent, statut='escalade')
            return None
        except Ticket.DoesNotExist:
            return None

    def get(self, request, ticket_id):
        ticket = self.get_ticket(ticket_id, request.user)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TicketDetailSerializer(ticket).data)

    def put(self, request, ticket_id):
        ticket = self.get_ticket(ticket_id, request.user)
        if not ticket:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        serializer = MettreAJourTicketSerializer(ticket, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(TicketDetailSerializer(ticket).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TicketsEscaladesView(APIView):
    permission_classes = [IsAuthenticated, EstAgentEscalade]

    def get(self, request):
        agent = request.user
        historique = request.query_params.get('historique', 'false').lower() == 'true'

        if agent.role == 'agent_technique':
            if historique:
                tickets = Ticket.objects.filter(agent_technique=agent).exclude(statut='escalade')
            else:
                tickets = Ticket.objects.filter(agent_technique=agent, statut='escalade')
        else:
            if historique:
                tickets = Ticket.objects.filter(agent_annexe=agent).exclude(statut='escalade')
            else:
                tickets = Ticket.objects.filter(agent_annexe=agent, statut='escalade')

        # Filtrer par commune si l'agent a une commune dÃ©finie
        if agent.commune:
            tickets = tickets.filter(client__commune__iexact=agent.commune)

        return Response(TicketListSerializer(tickets.order_by('-created_at'), many=True).data)


class TicketHistoriqueClientView(APIView):
    permission_classes = [IsAuthenticated, EstAgent]

    def get(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(id=ticket_id, agent=request.user)
            historique = Ticket.objects.filter(client=ticket.client).exclude(id=ticket.id).order_by('-created_at')
            return Response(TicketListSerializer(historique, many=True).data)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)


class TousLesTicketsView(APIView):
    permission_classes = [IsAuthenticated, EstAdmin]

    def get(self, request):
        tickets = Ticket.objects.filter(centre=request.user.centre).order_by('-created_at')
        statut = request.query_params.get('statut')
        priorite = request.query_params.get('priorite')
        agent_id = request.query_params.get('agent_id')
        service = request.query_params.get('service')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if statut:
            tickets = tickets.filter(statut=statut)
        if priorite:
            tickets = tickets.filter(priorite=priorite)
        if agent_id:
            tickets = tickets.filter(agent__id=agent_id)
        if service:
            tickets = tickets.filter(type_service__libelle__iexact=service)
        if start_date:
            tickets = tickets.filter(created_at__gte=start_date + 'T00:00:00Z')
        if end_date:
            tickets = tickets.filter(created_at__lte=end_date + 'T23:59:59Z')

        en_retard = request.query_params.get('en_retard')
        if en_retard == 'true':
            from django.utils import timezone
            tickets = tickets.filter(echeance_sla__lt=timezone.now()).exclude(statut__in=['resolu', 'ferme', 'rejete'])

        return Response(TicketListSerializer(tickets, many=True).data)


class AttribuerTicketView(APIView):
    permission_classes = [IsAuthenticated, EstAdmin]

    def post(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(id=ticket_id, centre=request.user.centre)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        agent_id = request.data.get('agent_id')
        if not agent_id:
            return Response({'error': 'agent_id requis'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.users.models import Utilisateur, Role
        try:
            agent = Utilisateur.objects.get(id=agent_id, centre=request.user.centre, role=Role.AGENT, actif=True)
        except Utilisateur.DoesNotExist:
            return Response({'error': 'Agent introuvable'}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone
        ticket.agent = agent
        ticket.statut = 'en_cours'
        ticket.pris_en_charge_a = timezone.now()
        ticket.attribution_auto = False
        ticket.save()
        return Response(TicketDetailSerializer(ticket).data)


class PiecesJointesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PieceJointeUploadSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(ticket=ticket, uploaded_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PieceJointeDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, piece_id):
        try:
            piece = PieceJointe.objects.get(id=piece_id)
        except PieceJointe.DoesNotExist:
            return Response({'error': 'Fichier introuvable'}, status=status.HTTP_404_NOT_FOUND)

        from django.http import HttpResponse
        response = HttpResponse(bytes(piece.contenu), content_type=piece.type_mime)
        response['Content-Disposition'] = f'inline; filename="{piece.nom_fichier}"'
        return response


class EscaladerTicketView(APIView):
    permission_classes = [IsAuthenticated, EstAgent]

    def post(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(id=ticket_id, agent=request.user)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CreerEscaladeSerializer(data=request.data, context={'ticket': ticket, 'request': request})
        if serializer.is_valid():
            escalade = serializer.save()
            return Response(EscaladeSerializer(escalade).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ToggleEmailView(APIView):
    """Active/dÃ©sactive le relais email pour un ticket source=email"""
    permission_classes = [IsAuthenticated, EstAgentOuPlus]

    def post(self, request, ticket_id):
        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.source != 'email':
            return Response({'error': 'Ce ticket n\'est pas un ticket email'}, status=status.HTTP_400_BAD_REQUEST)

        ticket.email_actif = not ticket.email_actif
        ticket.save(update_fields=['email_actif'])
        return Response({
            'email_actif': ticket.email_actif,
            'message': f"Relais email {'activÃ©' if ticket.email_actif else 'dÃ©sactivÃ©'}"
        })


class RetournerTicketView(APIView):
    """Permet Ã  un agent technique/annexe de renvoyer le ticket vers l'agent d'origine"""
    permission_classes = [IsAuthenticated, EstAgentEscalade]

    def post(self, request, ticket_id):
        agent = request.user
        try:
            if agent.role == 'agent_technique':
                ticket = Ticket.objects.get(id=ticket_id, agent_technique=agent, statut='escalade')
            elif agent.role == 'agent_annexe':
                ticket = Ticket.objects.get(id=ticket_id, agent_annexe=agent, statut='escalade')
            else:
                return Response({'error': 'Action non autorisÃ©e'}, status=status.HTTP_403_FORBIDDEN)
        except Ticket.DoesNotExist:
            return Response({'error': 'Ticket introuvable'}, status=status.HTTP_404_NOT_FOUND)

        commentaire = request.data.get('commentaire', '')

        # Remettre le ticket en_cours chez l'agent d'origine
        ticket.statut = 'en_cours'
        ticket.save(update_fields=['statut'])

        # CrÃ©er un message systÃ¨me dans le chat pour tracer le retour
        from apps.chat.models import Message
        note = f"ðŸ“‹ Ticket renvoyÃ© par {agent.prenom} {agent.nom} ({agent.get_role_display()})."
        if commentaire:
            note += f"\nðŸ’¬ Commentaire : {commentaire}"
        Message.objects.create(
            ticket=ticket,
            expediteur=agent,
            contenu=note,
            interne=True,
        )

        # Notification email à l'agent helpdesk et au client
        try:
            from apps.notifications.emails import notifier_retour_ticket
            notifier_retour_ticket(ticket, agent, commentaire)
        except Exception:
            pass

        return Response({
            'message': 'Ticket renvoyÃ© Ã  l\'agent d\'origine.',
            'ticket': TicketDetailSerializer(ticket).data
        })


class CreerTicketACTELView(APIView):
    """Permet Ã  un agent ACTEL de crÃ©er un ticket pour un client qui se prÃ©sente physiquement."""
    permission_classes = [IsAuthenticated, EstAgentEscalade]

    def post(self, request):
        agent = request.user
        if agent.role != 'agent_annexe':
            return Response({'detail': 'Seul un agent ACTEL peut utiliser cette fonctionnalitÃ©.'}, status=status.HTTP_403_FORBIDDEN)

        telephone = request.data.get('telephone')
        type_service_id = request.data.get('type_service')
        description = request.data.get('description', '')
        titre = request.data.get('titre', '')

        if not telephone or not type_service_id or not description:
            return Response({'detail': 'TÃ©lÃ©phone, type de service et description sont obligatoires.'}, status=status.HTTP_400_BAD_REQUEST)

        # Trouver le client par numÃ©ro de tÃ©lÃ©phone
        from apps.users.models import Utilisateur
        try:
            client = Utilisateur.objects.get(telephone=telephone, role='client')
        except Utilisateur.DoesNotExist:
            return Response({'detail': f'Aucun client trouvÃ© avec le numÃ©ro {telephone}.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            type_service = TypeService.objects.get(id=type_service_id, actif=True)
        except TypeService.DoesNotExist:
            return Response({'detail': 'Type de service invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        # DÃ©terminer la prioritÃ©
        priorite_map = {1: 'basse', 2: 'normale', 3: 'haute', 4: 'critique'}
        priorite = priorite_map.get(type_service.priorite_defaut, 'normale')

        # CrÃ©er le ticket
        from django.utils import timezone
        from datetime import timedelta
        from apps.centres.models import ParametresCentre

        centre = agent.centre or client.centre
        if not centre:
            return Response({'detail': 'Aucun centre associÃ©.'}, status=status.HTTP_400_BAD_REQUEST)

        ticket = Ticket.objects.create(
            client=client,
            agent_annexe=agent,
            centre=centre,
            type_service=type_service,
            titre=titre or description[:50],
            description=description,
            statut='escalade',
            priorite=priorite,
            source='web',
            attribution_auto=False,
        )

        # SLA
        try:
            params = ParametresCentre.objects.get(centre=centre)
            sla_map = {'normale': params.sla_heures_normale, 'haute': params.sla_heures_haute, 'critique': params.sla_heures_critique, 'basse': 72}
            ticket.echeance_sla = timezone.now() + timedelta(hours=sla_map.get(priorite, 48))
            ticket.save()
        except ParametresCentre.DoesNotExist:
            pass

        # CrÃ©er l'escalade pour traÃ§abilitÃ©
        Escalade.objects.create(
            ticket=ticket,
            type_escalade='annexe',
            agent_source=agent,
            agent_cible=agent,
            motif=f'RÃ©clamation dÃ©posÃ©e en agence ACTEL par le client {client.prenom} {client.nom}.',
        )

        # Notification email au client
        try:
            from apps.notifications.emails import notifier_ticket_ouvert
            notifier_ticket_ouvert(ticket)
        except Exception:
            pass

        return Response(TicketDetailSerializer(ticket).data, status=status.HTTP_201_CREATED)
class HFChatbotView(APIView):
    permission_classes = [IsAuthenticated, EstClient]

    def post(self, request):
        from .hf_triage import run_hf_triage
        service_name = request.data.get('service_name', 'Inconnu')
        issue_description = request.data.get('description', '')
        chat_history = request.data.get('history', 'Aucun')
        
        result = run_hf_triage(service_name, issue_description, chat_history)
        return Response(result, status=status.HTTP_200_OK)
