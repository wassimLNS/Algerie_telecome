from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):

    expediteur_nom    = serializers.CharField(source='expediteur.nom', read_only=True)
    expediteur_prenom = serializers.CharField(source='expediteur.prenom', read_only=True)
    expediteur_role   = serializers.CharField(source='expediteur_type', read_only=True)
    date_envoi        = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model  = Message
        fields = [
            'id', 'ticket',
            'expediteur', 'expediteur_nom', 'expediteur_prenom',
            'expediteur_type', 'expediteur_role', 'contenu',
            'lu_par_client', 'lu_par_agent',
            'created_at', 'date_envoi', 'modifie_at',
        ]
        read_only_fields = [
            'id', 'ticket', 'expediteur',
            'expediteur_type', 'expediteur_nom', 'expediteur_prenom',
            'lu_par_client', 'lu_par_agent',
            'created_at', 'modifie_at',
        ]


class EnvoyerMessageSerializer(serializers.Serializer):
    contenu = serializers.CharField()