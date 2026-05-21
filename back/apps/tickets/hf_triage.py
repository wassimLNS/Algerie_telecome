import json
import urllib.request
import urllib.error
import time
from decouple import config

GEMINI_API_KEY = config('GEMINI_API_KEY', default='')


# ─── Pre-filter: detect gibberish / off-topic before calling API ───
import re as _re

def _is_nonsense(text):
    """Return True if the message looks like gibberish or is clearly off-topic."""
    text = text.strip()
    if not text:
        return True
    # More than 60% non-alphabetic or non-space characters → gibberish
    alpha_ratio = sum(1 for c in text if c.isalpha() or c.isspace()) / max(len(text), 1)
    if alpha_ratio < 0.4:
        return True
    # Very short random-looking string (no vowels in a long word sequence)
    words = text.split()
    gibberish_words = 0
    for w in words:
        w_clean = _re.sub(r'[^a-zA-Z]', '', w.lower())
        if len(w_clean) > 4 and not _re.search(r'[aeiouàâäéèêëîïôùûü]', w_clean):
            gibberish_words += 1
    if words and gibberish_words / len(words) > 0.5:
        return True
    return False

# Off-topic keyword patterns (questions unrelated to telecom support)
_OFFTOPIC_PATTERNS = _re.compile(
    r'\b(président|president|premier ministre|capital|météo|weather|horoscope|sport|football|prix|recette|cuisine|histoire|politique|politique|religion)\b',
    _re.IGNORECASE
)

def _detect_offtopic(text):
    return bool(_OFFTOPIC_PATTERNS.search(text))

def run_hf_triage(service_name, issue_description, chat_history=''):
    # ─── Fast local pre-filter ───
    if _is_nonsense(issue_description) or _detect_offtopic(issue_description):
        return {
            "reply": "Cette demande est en dehors du périmètre de l'assistance technique.",
            "is_resolved": False,
            "can_submit": False,
            "auto_submit": False,
            "is_nonsense": True
        }

    if not GEMINI_API_KEY or GEMINI_API_KEY == 'REPLACE_ME_WITH_YOUR_GEMINI_KEY':
        # Fallback if no key
        return {
            "reply": "Je suis désolé, je n'arrive pas à joindre le serveur IA (Clé API manquante). Souhaitez-vous que je soumette la réclamation ?",
            "is_resolved": False,
            "can_submit": True,
            "auto_submit": False
        }
        
    API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    
    system_prompt = """You are a highly empathetic, conversational, and precise virtual technical support agent for Algérie Télécom. You must act exactly like a real human agent talking to a customer.

CRITICAL INSTRUCTIONS:
1. Strict Language Consistency: EVERY SINGLE MESSAGE you send MUST be EXACTLY in the same language as the language in which the INITIAL complaint was submitted. Do NOT switch languages.
2. Brief Responses: Keep your replies extremely brief, conversational, and precise. Avoid long paragraphs.
3. Maximum 3 Solutions: Suggest AT MOST 3 solutions for the client to try, ONE BY ONE. Suggest one step, ask the user to try it, and wait for their response. Do NOT give a list of steps.
4. Ticket Submission: If the 3 solutions did not work, immediately ask the client if they want to submit a ticket for an agent to contact them.
5. NONSENSE & OUT OF SCOPE (HIGHEST PRIORITY): If the user asks ANY question not related to their technical issue (e.g., "who is the president?", "what is the weather?"), types random letters ("sdfsdfsdf"), or uses insults, you MUST IMMEDIATELY ABORT. Do NOT try to redirect them, do NOT apologize, and do NOT repeat a previous solution. Reply EXACTLY with "This is outside the scope of technical support" in the user's language, and set "is_nonsense" to true.
6. JSON Output: You MUST respond ONLY with a valid JSON object containing exactly:
   - "reply" : (string) Your complete, short response to the client.
   - "is_resolved": (boolean) Set to true ONLY if the client confirms the problem is fully resolved.
   - "can_submit": (boolean) Set to true if the client wants to submit a ticket.
   - "auto_submit": (boolean) Set to true ONLY if the client explicitly replied 'yes' to submitting a ticket.
   - "is_nonsense": (boolean) Set to true ONLY if you aborted because the input was nonsense or out of scope.

Example 1:
User: Mon internet est très lent depuis ce matin.
Bot: { "reply": "Je suis désolé pour ces lenteurs. Pourrions-nous commencer par redémarrer votre modem ? Débranchez-le 30 secondes, rebranchez-le, et dites-moi si ça va mieux.", "is_resolved": false, "can_submit": false, "auto_submit": false, "is_nonsense": false }

Example 2:
User: sdfsdfsdf qui est le president de l'algerie ?
Bot: { "reply": "Cette demande est hors du périmètre de l'assistance technique.", "is_resolved": false, "can_submit": false, "auto_submit": false, "is_nonsense": true }

Example 3:
Bot: These 3 solutions did not work. Would you like me to submit a ticket?
User: Yes please.
Bot: { "reply": "Your ticket is being submitted.", "is_resolved": false, "can_submit": true, "auto_submit": true, "is_nonsense": false }
"""

    prompt = f"Historique :\n{chat_history}\n\nClient (Service: {service_name}): {issue_description}\n\nRéponds UNIQUEMENT en JSON valide."

    payload = {
        "system_instruction": {
            "parts": {"text": system_prompt}
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }
    
    max_retries = 3
    base_delay = 2

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(API_URL, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=20)
            
            data = json.loads(resp.read().decode('utf-8'))
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            
            # Clean JSON markdown
            text = text.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
                
            return json.loads(text.strip(), strict=False)
            
        except urllib.error.HTTPError as e:
            if e.code in [503, 429]:
                if attempt < max_retries - 1:
                    time.sleep(base_delay * (2 ** attempt))
                    continue
                else:
                    return {
                        "reply": "Nos serveurs IA sont actuellement très sollicités (forte demande). Veuillez réessayer dans quelques instants ou soumettre un ticket pour parler à un agent.",
                        "is_resolved": False,
                        "can_submit": True,
                        "auto_submit": False
                    }
            else:
                return {
                    "reply": "Une erreur de communication avec l'IA s'est produite. Veuillez réessayer plus tard ou soumettre un ticket.",
                    "is_resolved": False,
                    "can_submit": True,
                    "auto_submit": False
                }
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(base_delay * (2 ** attempt))
                continue
            return {
                "reply": "Erreur système lors de la connexion à l'IA. Souhaitez-vous transmettre le ticket aux agents ?",
                "is_resolved": False,
                "can_submit": True,
                "auto_submit": False
            }

def generer_resume_ia(historique_ia):
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'REPLACE_ME_WITH_YOUR_GEMINI_KEY':
        return "Résumé IA non disponible (Clé API manquante)."
        
    API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""Tu es un agent expert d'Algérie Télécom.
Voici l'historique complet d'une conversation entre un client et notre chatbot de triage initial.
Ton objectif est de rédiger un résumé clair, précis et professionnel de cette conversation pour l'agent de support technique qui va prendre en charge le ticket.

Le résumé doit inclure :
- Le problème principal rencontré par le client.
- Les solutions proposées par le chatbot et testées par le client.
- Le résultat de ces tests.
- Toute autre information pertinente donnée par le client.

Historique de la conversation :
{historique_ia}

Rédige uniquement le résumé, sans texte additionnel, en français.
"""

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2}
    }
    
    max_retries = 3
    base_delay = 2
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(API_URL, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=15)
            data = json.loads(resp.read().decode('utf-8'))
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return text.strip()
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                import time
                time.sleep(base_delay * (2 ** attempt))
                continue
            print(f"Erreur HTTP lors de la génération du résumé: {e}")
            break
        except Exception as e:
            print(f"Erreur lors de la génération du résumé: {e}")
            break
            
    return "Résumé IA non disponible en raison d'une erreur technique."

def generer_resume_escalade(historique_chat):
    if not GEMINI_API_KEY or GEMINI_API_KEY == 'REPLACE_ME_WITH_YOUR_GEMINI_KEY':
        return "Résumé IA non disponible (Clé API manquante)."
        
    API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""Tu es un agent expert d'Algérie Télécom.
Voici l'historique complet d'une conversation entre un agent du helpdesk et un client.
Ton objectif est de rédiger un résumé clair, précis et professionnel de cette conversation pour l'agent technique (ou annexe) qui va prendre le relais suite à une escalade du ticket.

Le résumé doit inclure :
- Le problème initial.
- Les actions tentées par le helpdesk.
- Les réponses du client.
- La raison de l'escalade (si explicite ou déduite de l'échange).

Historique de la conversation :
{historique_chat}

Rédige uniquement le résumé, sans texte additionnel, en français.
"""

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2}
    }
    
    max_retries = 3
    base_delay = 2
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(API_URL, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=15)
            data = json.loads(resp.read().decode('utf-8'))
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return text.strip()
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                import time
                time.sleep(base_delay * (2 ** attempt))
                continue
            print(f"Erreur HTTP lors de la génération du résumé d'escalade: {e}")
            break
        except Exception as e:
            print(f"Erreur lors de la génération du résumé d'escalade: {e}")
            break
            
    return "Résumé IA non disponible en raison d'une erreur technique."












