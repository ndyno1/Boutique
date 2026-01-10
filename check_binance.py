import os
import requests
import hashlib
import hmac
import time

# Récupération sécurisée via les Secrets GitHub
API_KEY = os.getenv('BINANCE_API_KEY')
SECRET_KEY = os.getenv('BINANCE_SECRET_KEY')
GOOGLE_URL = os.getenv('https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec')

def get_binance_pay_history():
    url = "https://api.binance.com/sapi/v1/pay/transactions"
    timestamp = int(time.time() * 1000)
    query = f"timestamp={timestamp}"
    signature = hmac.new(SECRET_KEY.encode('utf-8'), query.encode('utf-8'), hashlib.sha256).hexdigest()
    
    headers = {'X-MBX-APIKEY': API_KEY}
    params = {'timestamp': timestamp, 'signature': signature}
    
    try:
        r = requests.get(url, headers=headers, params=params)
        return r.json().get('data', [])
    except Exception as e:
        print(f"Erreur API Binance : {e}")
        return []

# --- LOGIQUE DE VÉRIFICATION ---
print("Lancement de la vérification des paiements...")
transactions = get_binance_pay_history()

if not transactions:
    print("Aucune transaction trouvée ou erreur API.")

for tx in transactions:
    note = tx.get('note', '')
    status = tx.get('status', '') # SUCCESS ou autre
    
    if "#CMD-" in note.upper() and status == "SUCCESS":
        order_id = note.strip()
        print(f"✅ Paiement confirmé détecté : {order_id}")
        
        try:
            # Appel vers Google Apps Script
            r = requests.get(f"{GOOGLE_URL}?action=auto_validate&orderId={order_id}")
            print(f"Réponse Google : {r.text}")
        except Exception as e:
            print(f"❌ Erreur lors de l'appel Google : {e}")

print("Fin de la session de vérification.")
