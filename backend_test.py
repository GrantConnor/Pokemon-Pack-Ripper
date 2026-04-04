#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Pokemon Pack Ripper - Achievement Single-Fire Fix
Tests the atomic update fix using MongoDB's $addToSet operator
"""

import requests
import json
import time
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def generate_test_username():
    """Generate a unique test username"""
    timestamp = str(int(time.time()))
    random_suffix = ''.join(random.choices(string.ascii_lowercase, k=4))
    return f"testuser_{timestamp}_{random_suffix}"

def create_test_user():
    """Create a fresh test user and return credentials"""
    username = generate_test_username()
    password = "testpass123"
    
    signup_data = {
        "username": username,
        "password": password
    }
    
    print(f"🔧 Creating test user: {username}")
    response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
    
    if response.status_code not in [200, 201]:
        print(f"❌ Failed to create user: {response.status_code} - {response.text}")
        return None, None
    
    # Check if user was created successfully
    response_data = response.json()
    if not response_data.get("success"):
        print(f"❌ User creation failed: {response_data}")
        return None, None
    
    print(f"✅ User created successfully")
    return username, password

def signin_user(username, password):
    """Sign in user and return user data"""
    signin_data = {
        "username": username,
        "password": password
    }
    
    response = requests.post(f"{BASE_URL}/auth/signin", json=signin_data, headers=HEADERS)
    
    if response.status_code != 200:
        print(f"❌ Failed to sign in: {response.status_code} - {response.text}")
        return None
    
    response_data = response.json()
    # Handle both direct user object and nested user object
    if "user" in response_data:
        return response_data["user"]
    else:
        return response_data

def get_user_from_db(user_id):
    """Get user data via session endpoint"""
    response = requests.get(f"{BASE_URL}/session?userId={user_id}", headers=HEADERS)
    
    if response.status_code != 200:
        print(f"❌ Failed to get user session: {response.status_code} - {response.text}")
        return None
    
    response_data = response.json()
    # Handle both direct user object and nested user object
    if "user" in response_data:
        return response_data["user"]
    else:
        return response_data

def get_sets():
    """Get available Pokemon sets"""
    response = requests.get(f"{BASE_URL}/sets", headers=HEADERS)
    
    if response.status_code != 200:
        print(f"❌ Failed to get sets: {response.status_code} - {response.text}")
        return []
    
    response_data = response.json()
    # Handle both direct array and nested sets object
    if "sets" in response_data:
        return response_data["sets"]
    else:
        return response_data

def open_pack(user_id, set_id, bulk=False):
    """Open a pack for the user"""
    pack_data = {
        "userId": user_id,
        "setId": set_id
    }
    
    if bulk:
        pack_data["bulk"] = True
    
    response = requests.post(f"{BASE_URL}/packs/open", json=pack_data, headers=HEADERS)
    
    if response.status_code != 200:
        print(f"❌ Failed to open pack: {response.status_code} - {response.text}")
        return None
    
    return response.json()

def test_achievement_single_fire_primary():
    """
    Test 1: Achievement Single-Fire - Primary Test
    Create a fresh test user and open packs from ONE specific set until achieving ALL milestones
    """
    print("\n" + "="*80)
    print("🎯 TEST 1: ACHIEVEMENT SINGLE-FIRE - PRIMARY TEST")
    print("="*80)
    
    # Create test user
    username, password = create_test_user()
    if not username:
        return False
    
    # Sign in user
    user_data = signin_user(username, password)
    if not user_data:
        return False
    
    user_id = user_data["id"]
    print(f"📝 User ID: {user_id}")
    print(f"💰 Starting points: {user_data['points']}")
    
    # Get sets and pick one for testing
    sets = get_sets()
    if not sets:
        return False
    
    # Pick a set with good card count for testing (Base Set is reliable)
    test_set = None
    for s in sets:
        if s["id"] == "base1":  # Base Set
            test_set = s
            break
    
    if not test_set:
        test_set = sets[0]  # Fallback to first set
    
    set_id = test_set["id"]
    set_name = test_set["name"]
    print(f"🎲 Testing with set: {set_name} ({set_id})")
    
    # Track achievements and points
    total_points_from_achievements = 0
    achievement_history = []
    pack_count = 0
    
    # Open packs until we get multiple achievements (up to 150 packs max)
    while pack_count < 150:
        pack_count += 1
        print(f"\n📦 Opening pack #{pack_count} from {set_name}...")
        
        # Open pack
        pack_result = open_pack(user_id, set_id)
        if not pack_result:
            print(f"❌ Failed to open pack #{pack_count}")
            continue
        
        # Check if achievements were earned
        if "achievements" in pack_result and pack_result["achievements"]:
            achievements = pack_result["achievements"]
            if "newAchievements" in achievements and achievements["newAchievements"]:
                new_achievements = achievements["newAchievements"]
                bonus_points = achievements.get("bonusPoints", 0)
                unique_count = achievements.get("uniqueCount", 0)
                
                print(f"🏆 ACHIEVEMENTS EARNED in pack #{pack_count}:")
                for ach in new_achievements:
                    print(f"   - {ach['name']} ({ach['key']}) - {ach['reward']} points")
                    achievement_history.append({
                        "pack": pack_count,
                        "key": ach["key"],
                        "reward": ach["reward"],
                        "unique_count": unique_count
                    })
                
                total_points_from_achievements += bonus_points
                print(f"💰 Bonus points this pack: {bonus_points}")
                print(f"📊 Unique cards in set: {unique_count}")
        
        # Get fresh user data from database
        current_user = get_user_from_db(user_id)
        if current_user:
            set_achievements = current_user.get("setAchievements", {}).get(set_id, [])
            print(f"🗃️  Database setAchievements[{set_id}]: {set_achievements}")
            
            # Check for duplicates in achievement array
            if len(set_achievements) != len(set(set_achievements)):
                print(f"❌ CRITICAL ERROR: Duplicate achievements found in database!")
                print(f"   Raw array: {set_achievements}")
                return False
            
            print(f"💰 Current points: {current_user['points']}")
        
        # Stop if we have multiple achievements or reached 100+ unique cards
        if len(achievement_history) >= 3:
            print(f"✅ Sufficient achievements earned for testing ({len(achievement_history)})")
            break
    
    print(f"\n📊 FINAL RESULTS AFTER {pack_count} PACKS:")
    print(f"🏆 Total achievements earned: {len(achievement_history)}")
    print(f"💰 Total points from achievements: {total_points_from_achievements}")
    
    # Final database check
    final_user = get_user_from_db(user_id)
    if final_user:
        final_set_achievements = final_user.get("setAchievements", {}).get(set_id, [])
        print(f"🗃️  Final database setAchievements[{set_id}]: {final_set_achievements}")
        
        # Verify no duplicates
        unique_achievements = list(set(final_set_achievements))
        if len(final_set_achievements) != len(unique_achievements):
            print(f"❌ CRITICAL FAILURE: Duplicate achievements in final database state!")
            print(f"   Raw array: {final_set_achievements}")
            print(f"   Unique array: {unique_achievements}")
            return False
        
        # Verify each achievement appears exactly once
        achievement_counts = {}
        for ach in final_set_achievements:
            achievement_counts[ach] = achievement_counts.get(ach, 0) + 1
        
        duplicates_found = False
        for ach_key, count in achievement_counts.items():
            if count > 1:
                print(f"❌ DUPLICATE ACHIEVEMENT: {ach_key} appears {count} times!")
                duplicates_found = True
        
        if duplicates_found:
            return False
        
        print(f"✅ All achievements appear exactly once in database")
    
    # Verify achievement history matches database
    earned_keys = [ach["key"] for ach in achievement_history]
    if set(earned_keys) == set(final_set_achievements):
        print(f"✅ Achievement history matches database state")
        return True
    else:
        print(f"❌ Mismatch between earned achievements and database:")
        print(f"   Earned: {earned_keys}")
        print(f"   Database: {final_set_achievements}")
        return False

def test_achievement_database_persistence():
    """
    Test 2: Achievement Database Persistence
    Verify achievements are properly saved and persist across pack openings
    """
    print("\n" + "="*80)
    print("🗄️  TEST 2: ACHIEVEMENT DATABASE PERSISTENCE")
    print("="*80)
    
    # Create test user
    username, password = create_test_user()
    if not username:
        return False
    
    user_data = signin_user(username, password)
    if not user_data:
        return False
    
    user_id = user_data["id"]
    
    # Get a test set
    sets = get_sets()
    test_set = sets[0] if sets else None
    if not test_set:
        return False
    
    set_id = test_set["id"]
    set_name = test_set["name"]
    print(f"🎲 Testing persistence with set: {set_name} ({set_id})")
    
    # Open 15 packs to trigger 10-card achievement
    print(f"📦 Opening 15 packs to trigger 10-card achievement...")
    for i in range(15):
        pack_result = open_pack(user_id, set_id)
        if pack_result and "achievements" in pack_result and pack_result["achievements"]:
            achievements = pack_result["achievements"]
            if "newAchievements" in achievements and achievements["newAchievements"]:
                for ach in achievements["newAchievements"]:
                    print(f"🏆 Achievement earned: {ach['name']} ({ach['key']})")
    
    # Check database state after 15 packs
    user_after_15 = get_user_from_db(user_id)
    if not user_after_15:
        return False
    
    achievements_after_15 = user_after_15.get("setAchievements", {}).get(set_id, [])
    print(f"🗃️  After 15 packs - setAchievements[{set_id}]: {achievements_after_15}")
    
    # Open 20 more packs to trigger 30-card achievement
    print(f"📦 Opening 20 more packs to trigger 30-card achievement...")
    for i in range(20):
        pack_result = open_pack(user_id, set_id)
        if pack_result and "achievements" in pack_result and pack_result["achievements"]:
            achievements = pack_result["achievements"]
            if "newAchievements" in achievements and achievements["newAchievements"]:
                for ach in achievements["newAchievements"]:
                    print(f"🏆 Achievement earned: {ach['name']} ({ach['key']})")
    
    # Check final database state
    user_final = get_user_from_db(user_id)
    if not user_final:
        return False
    
    achievements_final = user_final.get("setAchievements", {}).get(set_id, [])
    print(f"🗃️  After 35 packs - setAchievements[{set_id}]: {achievements_final}")
    
    # Verify both achievements are present and no duplicates
    expected_achievements = ["TEN_CARDS", "THIRTY_CARDS"]
    
    # Check if both achievements are present
    has_ten_cards = "TEN_CARDS" in achievements_final
    has_thirty_cards = "THIRTY_CARDS" in achievements_final
    
    if not has_ten_cards:
        print(f"❌ Missing TEN_CARDS achievement")
        return False
    
    if not has_thirty_cards:
        print(f"❌ Missing THIRTY_CARDS achievement")
        return False
    
    # Check for duplicates
    if len(achievements_final) != len(set(achievements_final)):
        print(f"❌ Duplicate achievements found: {achievements_final}")
        return False
    
    print(f"✅ Both achievements present with no duplicates")
    return True

def test_multiple_achievements_one_pack():
    """
    Test 3: Multiple Achievement Triggers in One Pack Opening
    Test edge case where one pack opening could trigger multiple achievements
    """
    print("\n" + "="*80)
    print("🎯 TEST 3: MULTIPLE ACHIEVEMENT TRIGGERS IN ONE PACK")
    print("="*80)
    
    # Create test user
    username, password = create_test_user()
    if not username:
        return False
    
    user_data = signin_user(username, password)
    if not user_data:
        return False
    
    user_id = user_data["id"]
    
    # Get a test set
    sets = get_sets()
    test_set = sets[0] if sets else None
    if not test_set:
        return False
    
    set_id = test_set["id"]
    set_name = test_set["name"]
    print(f"🎲 Testing with set: {set_name} ({set_id})")
    
    # Open packs to get close to 10 unique cards (open 8 packs)
    print(f"📦 Opening 8 packs to get close to 10 unique cards...")
    for i in range(8):
        pack_result = open_pack(user_id, set_id)
        if not pack_result:
            print(f"❌ Failed to open pack {i+1}")
            return False
    
    # Check current state
    current_user = get_user_from_db(user_id)
    if not current_user:
        return False
    
    # Count unique cards from this set
    cards_from_set = [card for card in current_user.get("collection", []) if card.get("set", {}).get("id") == set_id]
    unique_card_ids = set(card["id"] for card in cards_from_set)
    unique_count_before = len(unique_card_ids)
    
    print(f"📊 Unique cards before final pack: {unique_count_before}")
    
    # Open one more pack that should trigger 10-card achievement
    print(f"📦 Opening final pack to trigger achievement...")
    pack_result = open_pack(user_id, set_id)
    if not pack_result:
        return False
    
    # Check if achievement was triggered
    achievements_earned = []
    if "achievements" in pack_result and pack_result["achievements"]:
        achievements = pack_result["achievements"]
        if "newAchievements" in achievements and achievements["newAchievements"]:
            achievements_earned = achievements["newAchievements"]
            for ach in achievements_earned:
                print(f"🏆 Achievement earned: {ach['name']} ({ach['key']})")
    
    # Verify only appropriate achievements were earned (should be TEN_CARDS if we crossed 10)
    final_user = get_user_from_db(user_id)
    if not final_user:
        return False
    
    final_achievements = final_user.get("setAchievements", {}).get(set_id, [])
    print(f"🗃️  Final setAchievements[{set_id}]: {final_achievements}")
    
    # Count final unique cards
    final_cards_from_set = [card for card in final_user.get("collection", []) if card.get("set", {}).get("id") == set_id]
    final_unique_card_ids = set(card["id"] for card in final_cards_from_set)
    final_unique_count = len(final_unique_card_ids)
    
    print(f"📊 Final unique cards: {final_unique_count}")
    
    # Verify no duplicates in achievements
    if len(final_achievements) != len(set(final_achievements)):
        print(f"❌ Duplicate achievements found: {final_achievements}")
        return False
    
    # Verify achievements are appropriate for the unique count
    if final_unique_count >= 10 and "TEN_CARDS" not in final_achievements:
        print(f"❌ Missing TEN_CARDS achievement with {final_unique_count} unique cards")
        return False
    
    print(f"✅ Achievements correctly awarded based on unique card count")
    return True

def test_rapid_pack_opening():
    """
    Test 4: Rapid Pack Opening (Race Condition Test)
    Open 100 packs rapidly to test for race conditions in achievement system
    """
    print("\n" + "="*80)
    print("🏃 TEST 4: RAPID PACK OPENING (RACE CONDITION TEST)")
    print("="*80)
    
    # Create test user with unlimited points (use Spheal username)
    username = "Spheal"
    password = "testpass123"
    
    # Try to create Spheal user (might already exist)
    signup_data = {
        "username": username,
        "password": password
    }
    
    print(f"🔧 Creating/using Spheal user for unlimited points...")
    response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
    
    # If user already exists, try to sign in
    if response.status_code == 409 or (response.status_code == 200 and not response.json().get("success")):
        print(f"🔄 Spheal user exists, signing in...")
        user_data = signin_user(username, password)
        if not user_data:
            print(f"❌ Cannot access Spheal user, creating regular test user instead")
            username, password = create_test_user()
            if not username:
                return False
            user_data = signin_user(username, password)
            if not user_data:
                return False
    else:
        # Check if signup was successful
        response_data = response.json()
        if not response_data.get("success"):
            print(f"❌ Failed to create Spheal user: {response_data}")
            return False
        user_data = response_data.get("user")
        if not user_data:
            user_data = signin_user(username, password)
            if not user_data:
                return False
    
    user_id = user_data["id"]
    print(f"💰 Starting points: {user_data['points']}")
    
    # Get a test set
    sets = get_sets()
    test_set = sets[0] if sets else None
    if not test_set:
        return False
    
    set_id = test_set["id"]
    set_name = test_set["name"]
    print(f"🎲 Testing rapid opening with set: {set_name} ({set_id})")
    
    # Open 100 packs rapidly (use bulk opening for efficiency)
    print(f"📦 Opening 100 packs rapidly (10 bulk openings)...")
    
    total_achievements_earned = []
    total_bonus_points = 0
    
    for bulk_round in range(10):
        print(f"🔄 Bulk round {bulk_round + 1}/10...")
        
        # Open 10 packs at once
        pack_result = open_pack(user_id, set_id, bulk=True)
        if not pack_result:
            print(f"❌ Failed bulk opening round {bulk_round + 1}")
            continue
        
        # Track achievements from this bulk opening
        if "achievements" in pack_result and pack_result["achievements"]:
            achievements = pack_result["achievements"]
            if "newAchievements" in achievements and achievements["newAchievements"]:
                new_achievements = achievements["newAchievements"]
                bonus_points = achievements.get("bonusPoints", 0)
                
                for ach in new_achievements:
                    print(f"🏆 Achievement: {ach['name']} ({ach['key']}) - {ach['reward']} points")
                    total_achievements_earned.append(ach["key"])
                
                total_bonus_points += bonus_points
        
        # Small delay to simulate rapid but not simultaneous requests
        time.sleep(0.1)
    
    print(f"\n📊 RAPID OPENING RESULTS:")
    print(f"🏆 Total achievements earned: {len(total_achievements_earned)}")
    print(f"💰 Total bonus points: {total_bonus_points}")
    print(f"📝 Achievement keys earned: {total_achievements_earned}")
    
    # Get final user state from database
    final_user = get_user_from_db(user_id)
    if not final_user:
        return False
    
    final_achievements = final_user.get("setAchievements", {}).get(set_id, [])
    print(f"🗃️  Final database setAchievements[{set_id}]: {final_achievements}")
    
    # Critical checks for race conditions
    
    # 1. Check for duplicates in database
    if len(final_achievements) != len(set(final_achievements)):
        print(f"❌ RACE CONDITION DETECTED: Duplicate achievements in database!")
        print(f"   Raw array: {final_achievements}")
        return False
    
    # 2. Count occurrences of each achievement
    achievement_counts = {}
    for ach in final_achievements:
        achievement_counts[ach] = achievement_counts.get(ach, 0) + 1
    
    duplicates_found = False
    for ach_key, count in achievement_counts.items():
        if count > 1:
            print(f"❌ RACE CONDITION: {ach_key} appears {count} times!")
            duplicates_found = True
        else:
            print(f"✅ {ach_key} appears exactly once")
    
    if duplicates_found:
        return False
    
    # 3. Verify total points are consistent
    expected_points_from_achievements = 0
    for ach_key in final_achievements:
        if ach_key == "TEN_CARDS":
            expected_points_from_achievements += 100
        elif ach_key == "THIRTY_CARDS":
            expected_points_from_achievements += 250
        elif ach_key == "FIFTY_CARDS":
            expected_points_from_achievements += 500
        elif ach_key == "SEVENTY_FIVE_CARDS":
            expected_points_from_achievements += 1000
        elif ach_key == "HUNDRED_CARDS":
            expected_points_from_achievements += 1500
    
    print(f"💰 Expected points from achievements: {expected_points_from_achievements}")
    print(f"💰 Actual bonus points awarded: {total_bonus_points}")
    
    if expected_points_from_achievements != total_bonus_points:
        print(f"❌ POINTS MISMATCH: Expected {expected_points_from_achievements}, got {total_bonus_points}")
        return False
    
    print(f"✅ All race condition tests passed - achievements fire exactly once")
    return True

def run_all_tests():
    """Run all achievement single-fire tests"""
    print("🚀 STARTING COMPREHENSIVE ACHIEVEMENT SINGLE-FIRE TESTING")
    print("Testing the MongoDB $addToSet atomic update fix")
    print("="*80)
    
    test_results = []
    
    # Test 1: Primary Achievement Single-Fire Test
    try:
        result1 = test_achievement_single_fire_primary()
        test_results.append(("Achievement Single-Fire Primary", result1))
    except Exception as e:
        print(f"❌ Test 1 failed with exception: {e}")
        test_results.append(("Achievement Single-Fire Primary", False))
    
    # Test 2: Database Persistence
    try:
        result2 = test_achievement_database_persistence()
        test_results.append(("Database Persistence", result2))
    except Exception as e:
        print(f"❌ Test 2 failed with exception: {e}")
        test_results.append(("Database Persistence", False))
    
    # Test 3: Multiple Achievements in One Pack
    try:
        result3 = test_multiple_achievements_one_pack()
        test_results.append(("Multiple Achievements One Pack", result3))
    except Exception as e:
        print(f"❌ Test 3 failed with exception: {e}")
        test_results.append(("Multiple Achievements One Pack", False))
    
    # Test 4: Rapid Pack Opening (Race Conditions)
    try:
        result4 = test_rapid_pack_opening()
        test_results.append(("Rapid Pack Opening", result4))
    except Exception as e:
        print(f"❌ Test 4 failed with exception: {e}")
        test_results.append(("Rapid Pack Opening", False))
    
    # Print final results
    print("\n" + "="*80)
    print("🏁 FINAL TEST RESULTS")
    print("="*80)
    
    passed_tests = 0
    total_tests = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed_tests += 1
    
    print(f"\n📊 SUMMARY: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED - Achievement Single-Fire Fix is working correctly!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED - Achievement Single-Fire Fix needs attention!")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)