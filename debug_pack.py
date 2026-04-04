#!/usr/bin/env python3
"""
Debug script to investigate pack opening response structure
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def debug_pack_opening():
    """Debug pack opening to see actual response structure"""
    print("🔍 DEBUGGING PACK OPENING RESPONSE")
    print("=" * 50)
    
    try:
        # Create test user
        test_username = f"debuguser_{int(time.time())}"
        test_password = "testpass123"
        
        signup_data = {
            "username": test_username,
            "password": test_password
        }
        
        signup_response = requests.post(f"{API_BASE}/auth/signup", json=signup_data)
        if signup_response.status_code != 200:
            print(f"Failed to create user: {signup_response.text}")
            return
            
        signup_result = signup_response.json()
        user_id = signup_result['user']['id']
        
        print(f"Created user: {user_id}")
        
        # Open a pack
        pack_data = {
            "userId": user_id,
            "setId": "base1",
            "bulk": False
        }
        
        pack_response = requests.post(f"{API_BASE}/packs/open", json=pack_data)
        print(f"Pack opening status: {pack_response.status_code}")
        
        if pack_response.status_code == 200:
            pack_result = pack_response.json()
            print("\nFull response structure:")
            print(json.dumps(pack_result, indent=2))
            
            print(f"\nNumber of cards: {len(pack_result.get('cards', []))}")
            
            # Check first card structure
            if pack_result.get('cards'):
                first_card = pack_result['cards'][0]
                print(f"\nFirst card structure:")
                print(json.dumps(first_card, indent=2))
                
                print(f"\nFirst card keys: {list(first_card.keys())}")
                
                # Check if pulledAt is in the card
                if 'pulledAt' in first_card:
                    print(f"✅ pulledAt found: {first_card['pulledAt']}")
                else:
                    print("❌ pulledAt NOT found in card")
                    
        else:
            print(f"Pack opening failed: {pack_response.text}")
            
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    debug_pack_opening()