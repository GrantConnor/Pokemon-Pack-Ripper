#!/usr/bin/env python3

import requests
import json
import time
import random

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_bulk_with_achievements():
    """Test bulk pack opening with achievement bonus points"""
    print("=== TESTING BULK PACK WITH ACHIEVEMENT BONUS ===")
    
    # Create test user
    username = f"bulk_achieve_user_{random.randint(1000, 9999)}_{int(time.time())}"
    password = "testpass123"
    
    print(f"1. Creating test user: {username}")
    signup_data = {"username": username, "password": password}
    signup_response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
    
    if signup_response.status_code != 200:
        print(f"❌ Signup failed")
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
    
    bulk_response = requests.post(f"{BASE_URL}/packs/open", json=bulk_data, headers=HEADERS)
    
    if bulk_response.status_code == 200:
        result = bulk_response.json()
        cards_count = len(result.get("cards", []))
        points_remaining = result.get("pointsRemaining", 0)
        achievements_info = result.get("achievements")
        
        print(f"✅ Bulk pack opened successfully")
        print(f"   Cards received: {cards_count}")
        print(f"   Points before: {initial_points}")
        print(f"   Points after: {points_remaining}")
        print(f"   Raw points deducted: {initial_points - points_remaining}")
        
        # Check for achievements
        total_bonus_points = 0
        if achievements_info:
            earned_achievements = achievements_info.get("earned", [])
            total_bonus_points = achievements_info.get("bonusPoints", 0)
            
            print(f"   Achievements earned: {len(earned_achievements)}")
            for achievement in earned_achievements:
                print(f"     - {achievement.get('name', 'Unknown')}")
            print(f"   Total bonus points: {total_bonus_points}")
        else:
            print("   No achievements earned")
        
        # Calculate actual pack cost
        actual_pack_cost = initial_points - points_remaining + total_bonus_points
        print(f"   Actual pack cost: {initial_points} - {points_remaining} + {total_bonus_points} = {actual_pack_cost}")
        
        if actual_pack_cost == 1000:
            print("✅ CORRECT: 1000 points deducted for bulk opening (accounting for achievement bonuses)")
        else:
            print(f"❌ INCORRECT: Expected 1000 points deducted, got {actual_pack_cost}")
            
    else:
        print(f"❌ Bulk opening failed: {bulk_response.status_code} - {bulk_response.text}")

def test_single_pack_with_achievements():
    """Test single pack opening to see if achievements affect points"""
    print("\n=== TESTING SINGLE PACK WITH POTENTIAL ACHIEVEMENTS ===")
    
    # Create test user
    username = f"single_achieve_user_{random.randint(1000, 9999)}_{int(time.time())}"
    password = "testpass123"
    
    signup_data = {"username": username, "password": password}
    signup_response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
    
    user_data = signup_response.json()
    user_id = user_data["user"]["id"]
    initial_points = user_data["user"]["points"]
    
    # Get test sets
    sets_response = requests.get(f"{BASE_URL}/sets", headers=HEADERS)
    sets_data = sets_response.json()
    available_sets = sets_data["sets"][:3]
    
    print(f"1. User starts with {initial_points} points")
    
    total_pack_cost = 0
    total_bonus_points = 0
    
    for i, set_data in enumerate(available_sets):
        set_id = set_data["id"]
        set_name = set_data["name"]
        
        print(f"\n2. Opening pack {i+1} from {set_name}...")
        
        # Get current points before pack
        session_response = requests.get(f"{BASE_URL}/session?userId={user_id}", headers=HEADERS)
        session_data = session_response.json()
        points_before = session_data["user"]["points"]
        
        pack_data = {
            "userId": user_id,
            "setId": set_id,
            "bulk": False
        }
        
        pack_response = requests.post(f"{BASE_URL}/packs/open", json=pack_data, headers=HEADERS)
        
        if pack_response.status_code == 200:
            result = pack_response.json()
            points_after = result.get("pointsRemaining", 0)
            achievements_info = result.get("achievements")
            
            raw_deduction = points_before - points_after
            pack_bonus = 0
            
            if achievements_info:
                pack_bonus = achievements_info.get("bonusPoints", 0)
                earned_achievements = achievements_info.get("earned", [])
                print(f"   🏆 Achievements: {[a.get('name') for a in earned_achievements]} (+{pack_bonus} points)")
            
            actual_cost = raw_deduction - pack_bonus
            total_pack_cost += actual_cost
            total_bonus_points += pack_bonus
            
            print(f"   Points: {points_before} -> {points_after} (raw: -{raw_deduction}, bonus: +{pack_bonus}, actual cost: {actual_cost})")
            
        elif pack_response.status_code == 402:
            print("   ⚠️  User ran out of points")
            break
    
    print(f"\n3. Summary:")
    print(f"   Total actual pack cost: {total_pack_cost}")
    print(f"   Total bonus points: {total_bonus_points}")
    print(f"   Expected cost per pack: 100")
    print(f"   Packs opened: {total_pack_cost // 100}")

if __name__ == "__main__":
    test_bulk_with_achievements()
    test_single_pack_with_achievements()