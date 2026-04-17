from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Utilisateur, HistoriqueConnexion, Role, LigneTelephonique


# ============================================================
# LOGIN CLIENT (téléphone + mot de passe)
# ============================================================
class LoginClientSerializer(serializers.Serializer):
    telephone      = serializers.CharField()
    mot_de_passe   = serializers.CharField(write_only=True)

    def validate(self, data):
        telephone    = data.get('telephone')
        mot_de_passe = data.get('mot_de_passe')

        try:
            user = Utilisateur.objects.get(telephone=telephone, role=Role.CLIENT)
        except Utilisateur.DoesNotExist:
            raise serializers.ValidationError("Numéro de téléphone introuvable.")

        if not user.check_password(mot_de_passe):
            raise serializers.ValidationError("Mot de passe incorrect.")

        if not user.actif:
            raise serializers.ValidationError("Compte désactivé.")

        data['user'] = user
        return data


# ============================================================
# LOGIN AGENT / ADMIN (email + mot de passe)
# ============================================================
class LoginAgentSerializer(serializers.Serializer):
    email        = serializers.EmailField()
    mot_de_passe = serializers.CharField(write_only=True)

    def validate(self, data):
        email        = data.get('email')
        mot_de_passe = data.get('mot_de_passe')

        try:
            user = Utilisateur.objects.get(
                email=email,
                role__in=[Role.AGENT, Role.AGENT_TECHNIQUE, Role.AGENT_ANNEXE, Role.ADMIN]
            )
        except Utilisateur.DoesNotExist:
            raise serializers.ValidationError("Email introuvable.")

        if not user.check_password(mot_de_passe):
            raise serializers.ValidationError("Mot de passe incorrect.")

        if not user.actif:
            raise serializers.ValidationError("Compte désactivé.")

        data['user'] = user
        return data


# ============================================================
# LIGNE TÉLÉPHONIQUE
# ============================================================
class LigneTelephoniqueSerializer(serializers.ModelSerializer):

    class Meta:
        model  = LigneTelephonique
        fields = [
            'id', 'numero', 'type_abonnement',
            'num_contrat', 'date_abonnement', 'actif', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate_numero(self, value):
        # Vérifier que le numéro n'est pas déjà utilisé
        instance = self.instance
        qs = LigneTelephonique.objects.filter(numero=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ce numéro est déjà utilisé.")
        return value


# ============================================================
# PROFIL UTILISATEUR (lecture)
# ============================================================
class UtilisateurProfilSerializer(serializers.ModelSerializer):

    centre_nom = serializers.CharField(source='centre.nom', read_only=True)
    lignes     = LigneTelephoniqueSerializer(many=True, read_only=True)

    class Meta:
        model  = Utilisateur
        fields = [
            'id', 'role', 'nom', 'prenom', 'email', 'telephone',
            'date_naissance', 'genre',
            'adresse_ligne1', 'adresse_ligne2', 'wilaya', 'commune', 'code_postal',
            'type_client',
            'centre', 'centre_nom',
            'lignes',
            'actif', 'email_verifie', 'tel_verifie',
            'created_at', 'derniere_connexion',
        ]
        read_only_fields = ['id', 'role', 'created_at', 'derniere_connexion']


# ============================================================
# CRÉER UN AGENT (par l'admin)
# ============================================================
class CreerAgentSerializer(serializers.ModelSerializer):
    mot_de_passe = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = Utilisateur
        fields = [
            'nom', 'prenom', 'email', 'telephone',
            'role', 'centre',
            'wilaya', 'commune',
            'mot_de_passe',
        ]

    def validate_role(self, value):
        roles_autorises = [Role.AGENT, Role.AGENT_TECHNIQUE, Role.AGENT_ANNEXE]
        if value not in roles_autorises:
            raise serializers.ValidationError("Rôle invalide pour un agent.")
        return value

    def validate_email(self, value):
        if Utilisateur.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value

    def create(self, validated_data):
        mot_de_passe = validated_data.pop('mot_de_passe')
        user = Utilisateur(**validated_data)
        user.set_password(mot_de_passe)
        user.save()
        return user


# ============================================================
# MODIFIER UN AGENT (par l'admin)
# ============================================================
class ModifierAgentSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Utilisateur
        fields = [
            'nom', 'prenom', 'email', 'telephone',
            'role', 'centre',
            'wilaya', 'commune',
            'actif',
        ]

    def validate_role(self, value):
        roles_autorises = [Role.AGENT, Role.AGENT_TECHNIQUE, Role.AGENT_ANNEXE]
        if value not in roles_autorises:
            raise serializers.ValidationError("Rôle invalide pour un agent.")
        return value


# ============================================================
# LISTE DES AGENTS (par l'admin)
# ============================================================
class AgentListSerializer(serializers.ModelSerializer):

    centre_nom    = serializers.CharField(source='centre.nom', read_only=True)
    tickets_actifs = serializers.SerializerMethodField()

    class Meta:
        model  = Utilisateur
        fields = [
            'id', 'nom', 'prenom', 'email', 'telephone',
            'role', 'centre', 'centre_nom',
            'actif', 'created_at', 'derniere_connexion',
            'tickets_actifs',
        ]

    def get_tickets_actifs(self, obj):
        return obj.tickets_agent.filter(
            statut__in=['ouvert', 'en_cours']
        ).count()


# ============================================================
# HISTORIQUE CONNEXIONS
# ============================================================
class HistoriqueConnexionSerializer(serializers.ModelSerializer):

    utilisateur_nom = serializers.CharField(source='utilisateur.__str__', read_only=True)

    class Meta:
        model  = HistoriqueConnexion
        fields = [
            'id', 'utilisateur', 'utilisateur_nom',
            'ip_adresse', 'user_agent',
            'succes', 'raison_echec',
            'connecte_a', 'deconnecte_a',
        ]