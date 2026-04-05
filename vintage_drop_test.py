#!/usr/bin/env python3
"""
Backend Testing Script for 15% Vintage Drop Rate Feature
Tests the newly implemented vintage set rare drop rate system.
"""

import requests
import json
import time
from collections import defaultdict, Counter

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"
TEST_USER = "Spheal"
TEST_PASSWORD = "spheal"

# Test sets
VINTAGE_SETS = [
    {"id": "base1", "name": "Base Set"},
    {"id": "jungle", "name": "Jungle"}, 
    {"id": "fossil", "name": "Fossil"}
]

EX_SETS = [
    {"id": "ex1", "name": "Ruby & Sapphire"}
]

MODERN_SETS = [
    {"id": "swsh1", "name": "Sword & Shield"}
]

def authenticate():
    """Authenticate with Spheal account (unlimited points)"""
    print("🔐 Authenticating with Spheal account...")
    
    signin_data = {
        "username": TEST_USER,
        "password": TEST_PASSWORD
    }
    
    response = requests.post(f"{BASE_URL}/auth/signin", json=signin_data)
    
    if response.status_code == 200:
        data = response.json()
        user_data = data.get('user', {})
        print(f"✅ Authentication successful! Points: {user_data.get('points', 'Unknown')}")
        return user_data.get('id')
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def open_pack(user_id, set_id):
    """Open a single pack from specified set"""
    pack_data = {
        "userId": user_id,
        "setId": set_id,
        "bulk": False
    }
    
    response = requests.post(f"{BASE_URL}/packs/open", json=pack_data)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Pack opening failed: {response.status_code} - {response.text}")
        return None

def count_rares_in_cards(cards):
    """Count how many rare cards are in the pack"""
    rare_count = 0
    rare_cards = []
    
    for card in cards:
        rarity = card.get('rarity', '').lower()
        if any(rare_word in rarity for rare_word in ['rare', 'ultra', 'secret', 'rainbow', 'illustration', 'double']):
            rare_count += 1
            rare_cards.append(f"{card.get('name', 'Unknown')} ({rarity})")
    
    return rare_count, rare_cards

def test_vintage_drop_rate(user_id, set_info, num_packs=20):
    """Test vintage set drop rate with statistical analysis"""
    print(f"\n🎯 Testing {set_info['name']} ({set_info['id']}) - {num_packs} packs")
    print("=" * 60)
    
    packs_with_rares = 0
    packs_without_rares = 0
    total_rares = 0
    rare_details = []
    
    for i in range(num_packs):
        if (i + 1) % 5 == 0:
            print(f"   Progress: {i + 1}/{num_packs} packs opened...")
        
        pack_result = open_pack(user_id, set_info['id'])
        if not pack_result:
            print(f"❌ Failed to open pack {i + 1}")
            continue
            
        cards = pack_result.get('cards', [])
        rare_count, rare_cards = count_rares_in_cards(cards)
        
        if rare_count > 0:
            packs_with_rares += 1
            total_rares += rare_count
            rare_details.extend(rare_cards)
        else:
            packs_without_rares += 1
        
        # Small delay to avoid overwhelming the server
        time.sleep(0.5)
    
    # Calculate statistics
    total_tested = packs_with_rares + packs_without_rares
    rare_percentage = (packs_with_rares / total_tested * 100) if total_tested > 0 else 0
    
    print(f"\n📊 RESULTS for {set_info['name']}:")
    print(f"   Total packs tested: {total_tested}")
    print(f"   Packs with rares: {packs_with_rares}")
    print(f"   Packs without rares: {packs_without_rares}")
    print(f"   Rare drop rate: {rare_percentage:.1f}%")
    print(f"   Total rare cards found: {total_rares}")
    
    # Show some example rare cards found
    if rare_details:
        print(f"   Example rares found: {', '.join(rare_details[:5])}")
        if len(rare_details) > 5:
            print(f"   ... and {len(rare_details) - 5} more")
    
    return {
        'set_name': set_info['name'],
        'set_id': set_info['id'],
        'total_packs': total_tested,
        'packs_with_rares': packs_with_rares,
        'packs_without_rares': packs_without_rares,
        'rare_percentage': rare_percentage,
        'total_rares': total_rares,
        'expected_vintage': True
    }

def test_normal_drop_rate(user_id, set_info, num_packs=20):
    """Test EX/Modern set drop rate (should be 100%)"""
    print(f"\n🎯 Testing {set_info['name']} ({set_info['id']}) - {num_packs} packs")
    print("=" * 60)
    
    packs_with_rares = 0
    packs_without_rares = 0
    total_rares = 0
    
    for i in range(num_packs):
        pack_result = open_pack(user_id, set_info['id'])
        if not pack_result:
            print(f"❌ Failed to open pack {i + 1}")
            continue
            
        cards = pack_result.get('cards', [])
        rare_count, rare_cards = count_rares_in_cards(cards)
        
        if rare_count > 0:
            packs_with_rares += 1
            total_rares += rare_count
        else:
            packs_without_rares += 1
            print(f"⚠️  Pack {i + 1} had NO rares! Cards: {[c.get('name', 'Unknown') + ' (' + c.get('rarity', 'Unknown') + ')' for c in cards]}")
        
        time.sleep(0.3)
    
    # Calculate statistics
    total_tested = packs_with_rares + packs_without_rares
    rare_percentage = (packs_with_rares / total_tested * 100) if total_tested > 0 else 0
    
    print(f"\n📊 RESULTS for {set_info['name']}:")
    print(f"   Total packs tested: {total_tested}")
    print(f"   Packs with rares: {packs_with_rares}")
    print(f"   Packs without rares: {packs_without_rares}")
    print(f"   Rare drop rate: {rare_percentage:.1f}%")
    print(f"   Total rare cards found: {total_rares}")
    
    return {
        'set_name': set_info['name'],
        'set_id': set_info['id'],
        'total_packs': total_tested,
        'packs_with_rares': packs_with_rares,
        'packs_without_rares': packs_without_rares,
        'rare_percentage': rare_percentage,
        'total_rares': total_rares,
        'expected_vintage': False
    }

def main():
    """Main testing function"""
    print("🧪 VINTAGE DROP RATE TESTING SUITE")
    print("=" * 50)
    print("Testing 15% rare drop rate for vintage sets vs 100% for EX/modern sets")
    
    # Authenticate
    user_id = authenticate()
    if not user_id:
        print("❌ Cannot proceed without authentication")
        return
    
    results = []
    
    # Test vintage sets (should have ~15% rare rate)
    print("\n🏛️  TESTING VINTAGE SETS (Expected: ~15% rare rate)")
    print("=" * 60)
    
    for vintage_set in VINTAGE_SETS:
        try:
            result = test_vintage_drop_rate(user_id, vintage_set, num_packs=100)
            results.append(result)
        except Exception as e:
            print(f"❌ Error testing {vintage_set['name']}: {e}")
    
    # Test EX sets (should have 100% rare rate)
    print("\n⚔️  TESTING EX SETS (Expected: 100% rare rate)")
    print("=" * 60)
    
    for ex_set in EX_SETS:
        try:
            result = test_normal_drop_rate(user_id, ex_set, num_packs=20)
            results.append(result)
        except Exception as e:
            print(f"❌ Error testing {ex_set['name']}: {e}")
    
    # Test modern sets (should have 100% rare rate)
    print("\n🚀 TESTING MODERN SETS (Expected: 100% rare rate)")
    print("=" * 60)
    
    for modern_set in MODERN_SETS:
        try:
            result = test_normal_drop_rate(user_id, modern_set, num_packs=20)
            results.append(result)
        except Exception as e:
            print(f"❌ Error testing {modern_set['name']}: {e}")
    
    # Final summary
    print("\n" + "=" * 80)
    print("🎯 FINAL TESTING SUMMARY")
    print("=" * 80)
    
    vintage_results = [r for r in results if r['expected_vintage']]
    normal_results = [r for r in results if not r['expected_vintage']]
    
    print("\n📊 VINTAGE SETS RESULTS:")
    for result in vintage_results:
        status = "✅ PASS" if 10 <= result['rare_percentage'] <= 25 else "❌ FAIL"
        print(f"   {result['set_name']}: {result['rare_percentage']:.1f}% rare rate ({result['packs_with_rares']}/{result['total_packs']} packs) {status}")
    
    print("\n📊 EX/MODERN SETS RESULTS:")
    for result in normal_results:
        status = "✅ PASS" if result['rare_percentage'] >= 95 else "❌ FAIL"
        print(f"   {result['set_name']}: {result['rare_percentage']:.1f}% rare rate ({result['packs_with_rares']}/{result['total_packs']} packs) {status}")
    
    # Overall assessment
    vintage_pass = all(10 <= r['rare_percentage'] <= 25 for r in vintage_results)
    normal_pass = all(r['rare_percentage'] >= 95 for r in normal_results)
    
    print(f"\n🎯 OVERALL ASSESSMENT:")
    print(f"   Vintage sets (15% target): {'✅ PASS' if vintage_pass else '❌ FAIL'}")
    print(f"   EX/Modern sets (100% target): {'✅ PASS' if normal_pass else '❌ FAIL'}")
    
    if vintage_pass and normal_pass:
        print("\n🎉 ALL TESTS PASSED! 15% vintage drop rate implementation is working correctly!")
    else:
        print("\n⚠️  SOME TESTS FAILED! Implementation may need review.")
    
    return results

if __name__ == "__main__":
    try:
        results = main()
    except KeyboardInterrupt:
        print("\n\n⏹️  Testing interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()