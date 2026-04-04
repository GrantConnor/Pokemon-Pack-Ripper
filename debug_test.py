#!/usr/bin/env python3

import requests
import json
import time
import random

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def debug_bulk_pack_cost():
    """Debug the bulk pack cost issue"""
    print("=== DEBUGGING BULK PACK COST ===")
    
    # Create test user
    username = f"debug_user_{random.randint(1000, 9999)}_{int(time.time())}"
    password = "testpass123"
    
    print(f"1. Creating test user: {username}")
    signup_data = {"username": username, "password": password}
    signup_response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
    
    if signup_response.status_code != 200:
        print(f"❌ Signup failed: {signup_response.text}")
        return
        
    user_data = signup_response.json()
    user_id = user_data["user"]["id"]
    initial_points = user_data["user"]["points"]
    print(f"✅ User created with {initial_points} points")
    
    # Get test set
    sets_response = requests.get(f"{BASE_URL}/sets", headers=HEADERS)
    sets_data = sets_response.json()
    test_set = sets_data["sets"][0]
    set_id = test_set["id"]
    
    print(f"2. Testing bulk pack opening with set: {test_set['name']}")
    
    # Test bulk opening
    bulk_data = {
        "userId": user_id,
        "setId": set_id,
        "bulk": True
    }
    
    print(f"3. Sending bulk request: {bulk_data}")
    bulk_response = requests.post(f"{BASE_URL}/packs/open", json=bulk_data, headers=HEADERS)
    
    print(f"4. Response status: {bulk_response.status_code}")
    
    if bulk_response.status_code == 200:
        result = bulk_response.json()
        cards_count = len(result.get("cards", []))
        points_remaining = result.get("pointsRemaining", 0)
        
        print(f"✅ Bulk pack opened successfully")
        print(f"   Cards received: {cards_count}")
        print(f"   Points before: {initial_points}")
        print(f"   Points after: {points_remaining}")
        print(f"   Points deducted: {initial_points - points_remaining}")
        print(f"   Expected deduction: 1000 (BULK_PACK_COST)")
        
        if initial_points - points_remaining == 1000:
            print("✅ CORRECT: 1000 points deducted for bulk opening")
        else:
            print(f"❌ INCORRECT: Expected 1000 points deducted, got {initial_points - points_remaining}")
            
    elif bulk_response.status_code == 402:
        print(f"⚠️  Insufficient points: {bulk_response.text}")
    else:
        print(f"❌ Bulk opening failed: {bulk_response.status_code} - {bulk_response.text}")

def debug_achievement_issue():
    """Debug the achievement duplicate issue"""
    print("\n=== DEBUGGING ACHIEVEMENT DUPLICATES ===")
    
    # Create test user
    username = f"achieve_user_{random.randint(1000, 9999)}_{int(time.time())}"
    password = "testpass123"
    
    print(f"1. Creating test user: {username}")
    signup_data = {"username": username, "password": password}
    signup_response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
    
    if signup_response.status_code != 200:
        print(f"❌ Signup failed")
        return
        
    user_data = signup_response.json()
    user_id = user_data["user"]["id"]
    
    # Get test sets
    sets_response = requests.get(f"{BASE_URL}/sets", headers=HEADERS)
    sets_data = sets_response.json()
    available_sets = sets_data["sets"][:6]  # Use 6 sets for variety
    
    print("2. Opening packs systematically...")
    unique_cards = set()
    all_achievements = []
    
    for i, set_data in enumerate(available_sets):
        set_id = set_data["id"]
        set_name = set_data["name"]
        
        print(f"\n   Pack {i+1} from {set_name}...")
        pack_data = {
            "userId": user_id,
            "setId": set_id,
            "bulk": False
        }
        
        pack_response = requests.post(f"{BASE_URL}/packs/open", json=pack_data, headers=HEADERS)
        
        if pack_response.status_code == 200:
            result = pack_response.json()
            cards = result.get("cards", [])
            achievements_info = result.get("achievements")
            
            # Track unique cards
            for card in cards:
                unique_cards.add(card["id"])
            
            unique_count = len(unique_cards)
            print(f"   Cards: {len(cards)}, Unique total: {unique_count}")
            
            # Check for achievements
            if achievements_info:
                earned_achievements = achievements_info.get("earned", [])
                bonus_points = achievements_info.get("bonusPoints", 0)
                
                for achievement in earned_achievements:
                    achievement_id = achievement.get("id", "unknown")
                    achievement_name = achievement.get("name", "Unknown")
                    print(f"   🏆 ACHIEVEMENT: {achievement_name} (ID: {achievement_id}) +{bonus_points} points")
                    all_achievements.append(achievement_id)
            else:
                print("   No achievements earned")
                
        elif pack_response.status_code == 402:
            print("   ⚠️  User ran out of points")
            break
        else:
            print(f"   ❌ Pack opening failed: {pack_response.status_code}")
            break
    
    print(f"\n3. Summary:")
    print(f"   Total unique cards: {len(unique_cards)}")
    print(f"   All achievements earned: {all_achievements}")
    
    # Check for duplicates
    achievement_counts = {}
    for achievement in all_achievements:
        achievement_counts[achievement] = achievement_counts.get(achievement, 0) + 1
    
    duplicates_found = False
    for achievement, count in achievement_counts.items():
        if count > 1:
            print(f"   ❌ DUPLICATE: {achievement} earned {count} times")
            duplicates_found = True
    
    if not duplicates_found:
        print("   ✅ No duplicate achievements found")
    
    # Check final user state
    session_response = requests.get(f"{BASE_URL}/session?userId={user_id}", headers=HEADERS)
    if session_response.status_code == 200:
        session_data = session_response.json()
        final_achievements = session_data["user"].get("achievements", [])
        print(f"   Final user achievements: {final_achievements}")

if __name__ == "__main__":
    debug_bulk_pack_cost()
    debug_achievement_issue()