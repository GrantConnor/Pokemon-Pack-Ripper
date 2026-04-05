#!/usr/bin/env python3
"""
Quick Vintage Drop Rate Test - Minimal version for fast testing
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"
TEST_USER = "Spheal"
TEST_PASSWORD = "spheal"

def authenticate():
    """Authenticate with Spheal account"""
    print("🔐 Authenticating...")
    
    response = requests.post(f"{BASE_URL}/auth/signin", json={
        "username": TEST_USER,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        user_data = data.get('user', {})
        print(f"✅ Authenticated! Points: {user_data.get('points')}")
        return user_data.get('id')
    else:
        print(f"❌ Auth failed: {response.status_code}")
        return None

def open_pack(user_id, set_id):
    """Open a single pack"""
    response = requests.post(f"{BASE_URL}/packs/open", json={
        "userId": user_id,
        "setId": set_id,
        "bulk": False
    })
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Pack failed: {response.status_code}")
        return None

def count_rares(cards):
    """Count rare cards in pack"""
    rare_count = 0
    for card in cards:
        rarity = card.get('rarity', '').lower()
        if 'rare' in rarity:
            rare_count += 1
    return rare_count

def quick_test():
    """Quick test of vintage vs normal drop rates"""
    print("🧪 QUICK VINTAGE DROP RATE TEST")
    print("=" * 40)
    
    user_id = authenticate()
    if not user_id:
        return
    
    # Test sets
    test_sets = [
        {"id": "base1", "name": "Base Set (Vintage)", "expected": "15%"},
        {"id": "ex1", "name": "Ruby & Sapphire (EX)", "expected": "100%"},
        {"id": "swsh1", "name": "Sword & Shield (Modern)", "expected": "100%"}
    ]
    
    for set_info in test_sets:
        print(f"\n🎯 Testing {set_info['name']} (Expected: {set_info['expected']})")
        print("-" * 50)
        
        packs_with_rares = 0
        total_packs = 10  # Small sample for quick test
        
        for i in range(total_packs):
            print(f"   Pack {i+1}/10...", end=" ")
            
            pack_result = open_pack(user_id, set_info['id'])
            if pack_result:
                cards = pack_result.get('cards', [])
                rare_count = count_rares(cards)
                
                if rare_count > 0:
                    packs_with_rares += 1
                    print(f"✨ {rare_count} rare(s)")
                else:
                    print("❌ No rares")
            else:
                print("❌ Failed")
            
            time.sleep(0.5)  # Delay between packs
        
        # Results
        rare_rate = (packs_with_rares / total_packs) * 100
        print(f"\n📊 RESULTS: {packs_with_rares}/{total_packs} packs had rares ({rare_rate:.0f}%)")
        
        # Assessment
        if set_info['id'] == 'base1':  # Vintage
            status = "✅ PASS" if 5 <= rare_rate <= 30 else "❌ FAIL"
        else:  # EX/Modern
            status = "✅ PASS" if rare_rate >= 80 else "❌ FAIL"
        
        print(f"   Assessment: {status}")
    
    print(f"\n🎯 QUICK TEST COMPLETE!")

if __name__ == "__main__":
    try:
        quick_test()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()