import urllib.request
import json
import os

url = "https://raw.githubusercontent.com/MarouaneSH/Algeria-Cities-JSON/master/algeria_cities.json"

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
        wilayas = {}
        for city in data:
            w_id = str(city.get('wilaya_id')).zfill(2)
            w_name = city.get('wilaya_name_ascii')
            commune = city.get('commune_name_ascii')
            
            if w_id not in wilayas:
                wilayas[w_id] = {'nom': w_name, 'communes': set()}
            wilayas[w_id]['communes'].add(commune)
            
        print(f"Found {len(wilayas)} wilayas in JSON")
        for wid, info in list(wilayas.items())[:3]:
            print(f"{wid} - {info['nom']}: {len(info['communes'])} communes")
except Exception as e:
    print(f"Error fetching/parsing JSON: {e}")
