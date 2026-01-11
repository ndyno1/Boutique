import os
import requests
import hashlib
import hmac
import time

API_KEY = os.getenv('BINANCE_API_KEY')
SECRET_KEY = os.getenv('BINANCE_SECRET_KEY')
GOOGLE_URL = os.getenv('https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec')  # ✅ FIX

def get_binance_pay_history():
    url = "https://api.binance.com/sapi/v1/pay/transactions"  # ⚠️ peut être différent selon ton accès
    timestamp = int(time.time() * 1000)
    query = f"timestamp={timestamp}"
    signature = hmac.new(SECRET_KEY.encode('utf-8'), query.encode('utf-8'), hashlib.sha256).hexdigest()

    headers = {'X-MBX-APIKEY': API_KEY}
    params = {'timestamp': timestamp, 'signature': signature}

    try:
        r = requests.get(url, headers=headers, params=params, timeout=20)
        if r.status_code != 200:
            print("❌ Binance HTTP:", r.status_code)
            print("Body:", r.text[:500])
            return []
        return r.json().get('data', [])
    except Exception as e:
        print(f"Erreur API Binance : {e}")
        return []

print("Lancement de la vérification des paiements...")
transactions = get_binance_pay_history()

if not transactions:
    print("Aucune transaction trouvée ou erreur API.")

for tx in transactions:
    note = (tx.get('note') or '')
    status = (tx.get('status') or '')  # SUCCESS ou autre

    if "#CMD-" in note.upper() and status == "SUCCESS":
        order_id = note.strip()
        print(f"✅ Paiement confirmé détecté : {order_id}")

        try:
            # ✅ FIX: le # doit être encodé, sinon Google ne reçoit pas orderId
            r = requests.get(
                GOOGLE_URL,
                params={"action": "auto_validate", "orderId": order_id},
                timeout=20
            )
            print(f"Réponse Google : {r.text}")
        except Exception as e:
            print(f"❌ Erreur lors de l'appel Google : {e}")

print("Fin de la session de vérification.")
