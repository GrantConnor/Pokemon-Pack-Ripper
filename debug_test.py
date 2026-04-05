#!/usr/bin/env python3

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://pokepackripper.netlify.app/api"

def test_breakdown_endpoints():
    """Test both breakdown endpoints with a real user and cards"""
    print("🧪 TESTING BREAKDOWN ENDPOINTS WITH REAL DATA")
    print("=" * 60)
    
    try:
        # Step 1: Create a test user
        test_username = f"breakdown_test_{int(time.time())}"
        signup_data = {
            "username": test_username,
            "password": "testpass123"
        }
        
        print(f"\n📝 Step 1: Creating test user '{test_username}'...")
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
        if response.status_code != 200:
            print(f"❌ Failed to create user: {response.status_code} - {response.text}")
            return False
            
        user_data = response.json()
        user_id = user_data['user']['id']
        print(f"✅ User created: {user_id}")
        
        # Step 2: Open a pack to get cards
        print(f"\n📦 Step 2: Opening pack to get cards...")
        pack_data = {
            "userId": user_id,
            "setId": "base1"
        }
        
        response = requests.post(f"{BASE_URL}/packs/open", json=pack_data)
        if response.status_code != 200:
            print(f"❌ Failed to open pack: {response.status_code} - {response.text}")
            return False
            
        pack_result = response.json()
        cards = pack_result.get('cards', [])
        print(f"✅ Pack opened: {len(cards)} cards received")
        
        if not cards:
            print("❌ No cards received from pack")
            return False
        
        # Find a common card for testing
        common_card = None
        for card in cards:
            if card.get('rarity') == 'Common':
                common_card = card
                break
        
        if not common_card:
            print("❌ No common card found for testing")
            return False
            
        print(f"✅ Found test card: {common_card['name']} (ID: {common_card['id']})")
        
        # Step 3: Test breakdown-quantity endpoint
        print(f"\n🔧 Step 3: Testing breakdown-quantity endpoint...")
        breakdown_data = {
            "userId": user_id,
            "cardId": common_card['id'],
            "amount": 1
        }
        
        print(f"Request data: {breakdown_data}")
        response = requests.post(f"{BASE_URL}/cards/breakdown-quantity", json=breakdown_data)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Breakdown-quantity successful: {result}")
        else:
            print(f"❌ Breakdown-quantity failed: {response.status_code} - {response.text}")
            
        # Step 4: Test batch breakdown endpoint
        print(f"\n📦 Step 4: Testing batch breakdown endpoint...")
        
        # Get remaining cards for batch test
        remaining_cards = [card for card in cards if card['id'] != common_card['id']][:2]
        
        if len(remaining_cards) >= 1:
            batch_data = {
                "userId": user_id,
                "cards": remaining_cards[:1]  # Test with 1 card
            }
            
            print(f"Batch request data: {batch_data}")
            response = requests.post(f"{BASE_URL}/cards/breakdown", json=batch_data)
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Batch breakdown successful: {result}")
            else:
                print(f"❌ Batch breakdown failed: {response.status_code} - {response.text}")
        else:
            print("⚠️ Not enough cards for batch breakdown test")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_breakdown_endpoints()
    if success:
        print("\n✅ BREAKDOWN ENDPOINT TESTING COMPLETED")
    else:
        print("\n❌ BREAKDOWN ENDPOINT TESTING FAILED")