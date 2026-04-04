#!/usr/bin/env python3
"""
Focused Pokemon Pack Ripper Testing - Critical Issues Found
"""

import requests
import json
import uuid
from collections import Counter

BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"

def log(message):
    print(f"[TEST] {message}")

def test_single_pack_opening():
    """Test single pack opening to verify 10 cards"""
    log("\n=== FOCUSED TEST: Single Pack Opening (10 Cards) ===")
    
    # Create test user
    username = f"pack_test_{uuid.uuid4().hex[:8]}"
    response = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": username,
        "password": "testpass123"
    })
    
    if response.status_code != 200:
        log(f"❌ Failed to create user: {response.status_code}")
        return False
        
    user_id = response.json()['user']['id']
    starting_points = response.json()['user']['points']
    log(f"✅ Created user with {starting_points} points")
    
    # Open single pack
    response = requests.post(f"{BASE_URL}/packs/open", json={
        "userId": user_id,
        "setId": "base1",
        "bulk": False
    })
    
    if response.status_code == 200:
        data = response.json()
        cards = data.get('cards', [])
        points_remaining = data.get('pointsRemaining', 0)
        
        log(f"✅ Pack opened successfully")
        log(f"   Cards in pack: {len(cards)}")
        log(f"   Points: {starting_points} -> {points_remaining}")
        log(f"   Points deducted: {starting_points - points_remaining}")
        
        # Verify exactly 10 cards
        if len(cards) == 10:
            log("✅ Pack contains exactly 10 cards")
            
            # Check for duplicates within pack
            card_ids = [card['id'] for card in cards]
            if len(card_ids) == len(set(card_ids)):
                log("✅ No duplicate cards within pack")
                
                # Analyze distribution
                rarities = [card.get('rarity', 'Unknown') for card in cards]
                rarity_counts = Counter(rarities)
                log(f"📊 Rarity distribution: {dict(rarity_counts)}")
                
                return True
            else:
                log("❌ Duplicate cards found within pack")
                return False
        else:
            log(f"❌ Pack contains {len(cards)} cards, expected 10")
            return False
    else:
        log(f"❌ Failed to open pack: {response.status_code} - {response.text}")
        return False

def test_achievement_single_fire_detailed():
    """Detailed test of achievement single-fire issue"""
    log("\n=== FOCUSED TEST: Achievement Single-Fire Issue ===")
    
    # Create fresh user
    username = f"achievement_debug_{uuid.uuid4().hex[:8]}"
    response = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": username,
        "password": "testpass123"
    })
    
    if response.status_code != 200:
        log(f"❌ Failed to create user: {response.status_code}")
        return False
        
    user_id = response.json()['user']['id']
    log(f"✅ Created user: {user_id}")
    
    # Open first pack and check achievements
    response = requests.post(f"{BASE_URL}/packs/open", json={
        "userId": user_id,
        "setId": "base1",
        "bulk": False
    })
    
    if response.status_code == 200:
        data = response.json()
        achievements = data.get('achievements')
        
        if achievements:
            new_achievements = achievements.get('newAchievements', [])
            log(f"🏆 Pack 1 - Achievements earned: {len(new_achievements)}")
            for ach in new_achievements:
                log(f"   - {ach.get('key', 'Unknown')} (Reward: {ach.get('reward', 0)})")
        else:
            log("📝 Pack 1 - No achievements earned")
            
        # Check user's setAchievements
        session_response = requests.get(f"{BASE_URL}/session?userId={user_id}")
        if session_response.status_code == 200:
            user_data = session_response.json()['user']
            set_achievements = user_data.get('setAchievements', {}).get('base1', [])
            log(f"📋 User setAchievements for base1: {set_achievements}")
            
            # Open second pack
            response2 = requests.post(f"{BASE_URL}/packs/open", json={
                "userId": user_id,
                "setId": "base1",
                "bulk": False
            })
            
            if response2.status_code == 200:
                data2 = response2.json()
                achievements2 = data2.get('achievements')
                
                if achievements2:
                    new_achievements2 = achievements2.get('newAchievements', [])
                    log(f"🏆 Pack 2 - Achievements earned: {len(new_achievements2)}")
                    for ach in new_achievements2:
                        log(f"   - {ach.get('key', 'Unknown')} (Reward: {ach.get('reward', 0)})")
                        
                    # Check if same achievements are being awarded again
                    pack1_keys = [ach.get('key') for ach in new_achievements] if achievements else []
                    pack2_keys = [ach.get('key') for ach in new_achievements2]
                    
                    duplicates = set(pack1_keys) & set(pack2_keys)
                    if duplicates:
                        log(f"❌ CRITICAL: Same achievements awarded again: {duplicates}")
                        return False
                    else:
                        log("✅ No duplicate achievements between packs")
                        
                else:
                    log("📝 Pack 2 - No achievements earned")
                    
                # Check updated setAchievements
                session_response2 = requests.get(f"{BASE_URL}/session?userId={user_id}")
                if session_response2.status_code == 200:
                    user_data2 = session_response2.json()['user']
                    set_achievements2 = user_data2.get('setAchievements', {}).get('base1', [])
                    log(f"📋 Updated setAchievements for base1: {set_achievements2}")
                    
                    # Check for duplicates in the array
                    if len(set_achievements2) != len(set(set_achievements2)):
                        log(f"❌ CRITICAL: Duplicate entries in setAchievements: {set_achievements2}")
                        return False
                    else:
                        log("✅ No duplicates in setAchievements array")
                        return True
                        
    return False

if __name__ == "__main__":
    log("🔍 Running focused tests on critical issues...")
    
    # Test 1: 10-card pack verification
    pack_test_result = test_single_pack_opening()
    
    # Test 2: Achievement single-fire issue
    achievement_test_result = test_achievement_single_fire_detailed()
    
    log(f"\n📊 FOCUSED TEST RESULTS:")
    log(f"   Pack Opening (10 cards): {'✅ PASS' if pack_test_result else '❌ FAIL'}")
    log(f"   Achievement Single-Fire: {'✅ PASS' if achievement_test_result else '❌ FAIL'}")
    
    if pack_test_result and achievement_test_result:
        log("\n🎉 Critical fixes are working correctly!")
    else:
        log("\n⚠️ Critical issues found that need immediate attention!")