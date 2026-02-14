import os
import requests
import hashlib
import hmac
import time

# ✅ Récupération des clés (Assure-toi qu'elles sont bien dans tes variables d'environnement)
API_KEY = os.getenv('BINANCE_API_KEY')
SECRET_KEY = os.getenv('BINANCE_SECRET_KEY')
# ✅ L'URL de ton Apps Script (Correction de la variable d'env)
GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec"

def get_binance_pay_history():
    """
    Récupère l'historique des transactions Binance Pay (SAPI).
    """
    # Endpoint officiel pour l'historique des transactions Binance Pay
    url = "https://api.binance.com/sapi/v1/pay/transactions"
    
    timestamp = int(time.time() * 1000)
    query = f"timestamp={timestamp}"
    
    # Génération de la signature HMAC SHA256
    signature = hmac.new(
        SECRET_KEY.encode('utf-8'), 
        query.encode('utf-8'), 
        hashlib.sha256
    ).hexdigest()

    headers = {'X-MBX-APIKEY': API_KEY}
    params = {'timestamp': timestamp, 'signature': signature}

    try:
        r = requests.get(url, headers=headers, params=params, timeout=20)
        if r.status_code != 200:
            print(f"❌ Erreur Binance HTTP {r.status_code}: {r.text}")
            return []
        
        # Binance renvoie un objet avec une clé 'data' contenant la liste
        return r.json().get('data', [])
    except Exception as e:
        print(f"❌ Erreur API Binance : {e}")
        return []

def run_payment_verification():
    print(f"--- [{time.strftime('%Y-%m-%d %H:%M:%S')}] Début de vérification ---")
    
    transactions = get_binance_pay_history()

    if not transactions:
        print("ℹ️ Aucune transaction récente trouvée sur Binance Pay.")
        return

    for tx in transactions:
        # On récupère les infos cruciales
        transaction_id = str(tx.get('transactionId')) # L'ID que le client va coller
        amount = tx.get('amount')                     # Le montant payé
        status = tx.get('status')                     # Doit être "SUCCESS"
        currency = tx.get('currency')                 # ex: USDT
        
        # ✅ Logique de validation
        # On vérifie si la transaction est réussie
        if status == "SUCCESS":
            print(f"🔍 Analyse transaction : {transaction_id} | Montant : {amount} {currency}")

            try:
                # On envoie l'ID à Google Apps Script pour :
                # 1. Vérifier si cet ID a déjà été utilisé (anti-fraude)
                # 2. Créditer le Wallet de l'utilisateur correspondant
                r = requests.get(
                    GOOGLE_URL,
                    params={
                        "action": "auto_validate_binance", 
                        "transactionId": transaction_id,
                        "amount": amount,
                        "currency": currency
                    },
                    timeout=20
                )
                print(f"➡️ Réponse Google pour {transaction_id} : {r.text}")
                
            except Exception as e:
                print(f"❌ Erreur lors de l'appel Google Apps Script : {e}")

    print("--- Fin de la session ---")

if __name__ == "__main__":
    # Ce script doit tourner en boucle (ex: toutes les 1 minute)
    run_payment_verification()
