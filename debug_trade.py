#!/usr/bin/env python3
"""
Debug Trade Counter Issue
"""

import requests
import json

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def debug_trade_counter():
    """Debug the trade counter issue"""
    print("🔍 DEBUGGING TRADE COUNTER ISSUE")
    print("=" * 50)
    
    # Login as Spheal
    spheal_login = requests.post(f"{API_BASE}/auth/signin", json={
        "username": "Spheal",
        "password": "spheal"
    })
    
    if spheal_login.status_code != 200:
        print(f"❌ Failed to login as Spheal: {spheal_login.status_code}")
        return
        
    spheal_data = spheal_login.json()
    spheal_id = spheal_data['user']['id']
    
    print(f"✅ Spheal ID: {spheal_id}")
    print(f"✅ Spheal data: {json.dumps(spheal_data, indent=2)}")
    
    # Check session data
    session_response = requests.get(f"{API_BASE}/session?userId={spheal_id}")
    if session_response.status_code == 200:
        session_data = session_response.json()
        print(f"✅ Session data: {json.dumps(session_data, indent=2)}")
    else:
        print(f"❌ Failed to get session: {session_response.status_code}")

if __name__ == "__main__":
    debug_trade_counter()