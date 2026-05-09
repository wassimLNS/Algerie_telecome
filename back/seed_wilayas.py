import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.centres.models import CentreDistribution

# Liste officielle des 58 Wilayas d'Algérie avec leur commune chef-lieu
# Pour un projet complet, il faudrait charger un fichier JSON avec les 1541 communes.
wilayas_data = {
    "01": {"nom": "Adrar", "communes": ["Adrar", "Fenoughil", "Reggane"]},
    "02": {"nom": "Chlef", "communes": ["Chlef", "Tenes", "Ouled Fares"]},
    "03": {"nom": "Laghouat", "communes": ["Laghouat", "Aflou"]},
    "04": {"nom": "Oum El Bouaghi", "communes": ["Oum El Bouaghi", "Ain Beida", "Ain M'lila"]},
    "05": {"nom": "Batna", "communes": ["Batna", "Barika", "Arris"]},
    "06": {"nom": "Béjaïa", "communes": ["Béjaïa", "Akbou", "Amizour"]},
    "07": {"nom": "Biskra", "communes": ["Biskra", "Tolga", "Sidi Okba"]},
    "08": {"nom": "Béchar", "communes": ["Béchar", "Kenadsa", "Abadla"]},
    "09": {"nom": "Blida", "communes": ["Blida", "Boufarik", "El Affroun"]},
    "10": {"nom": "Bouira", "communes": ["Bouira", "Lakhdaria", "Sour El Ghozlane"]},
    "11": {"nom": "Tamanrasset", "communes": ["Tamanrasset", "In Amguel"]},
    "12": {"nom": "Tébessa", "communes": ["Tébessa", "Bir El Ater", "Cheria"]},
    "13": {"nom": "Tlemcen", "communes": ["Tlemcen", "Maghnia", "Remchi"]},
    "14": {"nom": "Tiaret", "communes": ["Tiaret", "Sougueur", "Frenda"]},
    "15": {"nom": "Tizi Ouzou", "communes": ["Tizi Ouzou", "Azazga", "Draa El Mizan"]},
    "16": {"nom": "Alger", "communes": ["Alger-Centre", "Bab El Oued", "Hussein Dey", "Rouiba"]},
    "17": {"nom": "Djelfa", "communes": ["Djelfa", "Ain Oussera", "Messaad"]},
    "18": {"nom": "Jijel", "communes": ["Jijel", "Taher", "El Milia"]},
    "19": {"nom": "Sétif", "communes": ["Sétif", "El Eulma", "Ain Oulmene"]},
    "20": {"nom": "Saïda", "communes": ["Saïda", "Ain El Hadjar"]},
    "21": {"nom": "Skikda", "communes": ["Skikda", "Azzaba", "Collo"]},
    "22": {"nom": "Sidi Bel Abbès", "communes": ["Sidi Bel Abbès", "Sfisef", "Telagh"]},
    "23": {"nom": "Annaba", "communes": ["Annaba", "El Bouni", "Sidi Amar"]},
    "24": {"nom": "Guelma", "communes": ["Guelma", "Bouchegouf", "Oued Zenati"]},
    "25": {"nom": "Constantine", "communes": ["Constantine", "El Khroub", "Ain Smara"]},
    "26": {"nom": "Médéa", "communes": ["Médéa", "Berrouaghia", "Ksar El Boukhari"]},
    "27": {"nom": "Mostaganem", "communes": ["Mostaganem", "Ain Nouissy", "Bouguirat"]},
    "28": {"nom": "M'Sila", "communes": ["M'Sila", "Bou Saada", "Sidi Aissa"]},
    "29": {"nom": "Mascara", "communes": ["Mascara", "Sig", "Mohammadia"]},
    "30": {"nom": "Ouargla", "communes": ["Ouargla", "Rouissat", "Hassi Messaoud"]},
    "31": {"nom": "Oran", "communes": ["Oran", "Arzew", "Es Senia", "Bir El Djir"]},
    "32": {"nom": "El Bayadh", "communes": ["El Bayadh", "Bougtob"]},
    "33": {"nom": "Illizi", "communes": ["Illizi", "In Amenas"]},
    "34": {"nom": "Bordj Bou Arreridj", "communes": ["Bordj Bou Arreridj", "Ras El Oued"]},
    "35": {"nom": "Boumerdès", "communes": ["Boumerdès", "Boudouaou", "Dellys"]},
    "36": {"nom": "El Tarf", "communes": ["El Tarf", "El Kala", "Besbes"]},
    "37": {"nom": "Tindouf", "communes": ["Tindouf", "Oum El Assel"]},
    "38": {"nom": "Tissemsilt", "communes": ["Tissemsilt", "Theniet El Had"]},
    "39": {"nom": "El Oued", "communes": ["El Oued", "Magrane", "Guemar"]},
    "40": {"nom": "Khenchela", "communes": ["Khenchela", "Kais"]},
    "41": {"nom": "Souk Ahras", "communes": ["Souk Ahras", "Sedrata", "Taoura"]},
    "42": {"nom": "Tipaza", "communes": ["Tipaza", "Cherchell", "Kolea"]},
    "43": {"nom": "Mila", "communes": ["Mila", "Chelghoum Laid", "Tadjenanet"]},
    "44": {"nom": "Aïn Defla", "communes": ["Aïn Defla", "Khemis Miliana"]},
    "45": {"nom": "Naâma", "communes": ["Naâma", "Mecheria", "Ain Sefra"]},
    "46": {"nom": "Aïn Témouchent", "communes": ["Aïn Témouchent", "Beni Saf"]},
    "47": {"nom": "Ghardaïa", "communes": ["Ghardaïa", "Metlili", "El Guerrara"]},
    "48": {"nom": "Relizane", "communes": ["Relizane", "Oued Rhiou", "Mazouna"]},
    "49": {"nom": "Timimoun", "communes": ["Timimoun", "Aougrout"]},
    "50": {"nom": "Bordj Badji Mokhtar", "communes": ["Bordj Badji Mokhtar"]},
    "51": {"nom": "Ouled Djellal", "communes": ["Ouled Djellal", "Sidi Khaled"]},
    "52": {"nom": "Béni Abbès", "communes": ["Béni Abbès", "Igli"]},
    "53": {"nom": "In Salah", "communes": ["In Salah", "Foggaret Ezzaouia"]},
    "54": {"nom": "In Guezzam", "communes": ["In Guezzam", "Tin Zaouatine"]},
    "55": {"nom": "Touggourt", "communes": ["Touggourt", "Temacine"]},
    "56": {"nom": "Djanet", "communes": ["Djanet", "Bordj El Houasse"]},
    "57": {"nom": "El M'Ghair", "communes": ["El M'Ghair", "Djamaa"]},
    "58": {"nom": "El Meniaâ", "communes": ["El Meniaâ", "Hassi Gara"]}
}

# Création des centres
created = 0
updated = 0

for code, data in wilayas_data.items():
    code_centre = f"AT-{data['nom'].upper().replace(' ', '')}-{code}"[:20]
    
    # Vérifier si le centre existe déjà
    centre, is_new = CentreDistribution.objects.get_or_create(
        wilaya=data['nom'],
        defaults={
            'code': code_centre,
            'nom': f"Direction {data['nom']}",
            'communes': data['communes']
        }
    )
    
    if is_new:
        created += 1
    else:
        # Met à jour les communes sans écraser celles déjà existantes
        existing = set(centre.communes)
        existing.update(data['communes'])
        centre.communes = sorted(list(existing))
        centre.save(update_fields=['communes'])
        updated += 1

print(f"Terminé : {created} centres créés, {updated} mis à jour.")
