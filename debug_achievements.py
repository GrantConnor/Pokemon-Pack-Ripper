#!/usr/bin/env python3
"""
Debug Achievement Database Update Issue
"""

import requests
import json
import uuid

BASE_URL = "https://booster-hub-1.preview.emergentagent.com/api"

def log(message):
    print(f"[DEBUG] {message}")

def debug_achievement_database_update():
    """Debug the achievement database update issue"""
    log("=== DEBUGGING ACHIEVEMENT DATABASE UPDATE ===")
    
    # Create fresh user
    username = f"debug_db_{uuid.uuid4().hex[:8]}"
    response = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": username,
        "password": "testpass123"
    })
    
    if response.status_code != 200:
        log(f"❌ Failed to create user: {response.status_code}")
        return False
        
    user_data = response.json()['user']
    user_id = user_data['id']
    initial_points = user_data['points']
    initial_achievements = user_data.get('setAchievements', {})
    
    log(f"✅ Created user: {user_id}")
    log(f"   Initial points: {initial_points}")
    log(f"   Initial setAchievements: {initial_achievements}")
    
    # Open first pack
    log("\n--- Opening Pack 1 ---")
    response = requests.post(f"{BASE_URL}/packs/open", json={
        "userId": user_id,
        "setId": "base1",
        "bulk": False
    })
    
    if response.status_code == 200:
        data = response.json()
        points_after_pack1 = data.get('pointsRemaining', 0)
        achievements_pack1 = data.get('achievements')
        
        log(f"✅ Pack 1 opened successfully")
        log(f"   Points: {initial_points} -> {points_after_pack1}")
        
        if achievements_pack1:
            new_achievements = achievements_pack1.get('newAchievements', [])
            bonus_points = achievements_pack1.get('bonusPoints', 0)
            log(f"   Achievements earned: {len(new_achievements)}")
            log(f"   Bonus points: {bonus_points}")
            for ach in new_achievements:
                log(f"     - {ach.get('key')} (Reward: {ach.get('reward')})")
        else:
            log("   No achievements earned")
            
        # Check user session immediately after pack 1
        session_response = requests.get(f"{BASE_URL}/session?userId={user_id}")
        if session_response.status_code == 200:
            session_data = session_response.json()['user']
            session_points = session_data.get('points', 0)
            session_achievements = session_data.get('setAchievements', {})
            
            log(f"\n--- Session Data After Pack 1 ---")
            log(f"   Session points: {session_points}")
            log(f"   Session setAchievements: {session_achievements}")
            
            # Check if points were updated correctly
            expected_points = initial_points - 100  # Pack cost
            if achievements_pack1:
                expected_points += achievements_pack1.get('bonusPoints', 0)
                
            if session_points == expected_points:
                log(f"✅ Points updated correctly in database")
            else:
                log(f"❌ Points mismatch: expected {expected_points}, got {session_points}")
                
            # Check if achievements were saved
            base1_achievements = session_achievements.get('base1', [])
            if achievements_pack1 and achievements_pack1.get('newAchievements'):
                expected_achievement_keys = [ach['key'] for ach in achievements_pack1['newAchievements']]
                if set(base1_achievements) == set(expected_achievement_keys):
                    log(f"✅ Achievements saved correctly in database")
                else:
                    log(f"❌ Achievements not saved: expected {expected_achievement_keys}, got {base1_achievements}")
            else:
                log(f"📝 No achievements to save")
                
        # Open second pack to test single-fire
        log("\n--- Opening Pack 2 ---")
        response2 = requests.post(f"{BASE_URL}/packs/open", json={
            "userId": user_id,
            "setId": "base1",
            "bulk": False
        })
        
        if response2.status_code == 200:
            data2 = response2.json()
            points_after_pack2 = data2.get('pointsRemaining', 0)
            achievements_pack2 = data2.get('achievements')
            
            log(f"✅ Pack 2 opened successfully")
            log(f"   Points: {points_after_pack1} -> {points_after_pack2}")
            
            if achievements_pack2:
                new_achievements2 = achievements_pack2.get('newAchievements', [])
                bonus_points2 = achievements_pack2.get('bonusPoints', 0)
                log(f"   Achievements earned: {len(new_achievements2)}")
                log(f"   Bonus points: {bonus_points2}")
                for ach in new_achievements2:
                    log(f"     - {ach.get('key')} (Reward: {ach.get('reward')})")
                    
                # Check for duplicate achievements
                if achievements_pack1 and achievements_pack1.get('newAchievements'):
                    pack1_keys = [ach['key'] for ach in achievements_pack1['newAchievements']]
                    pack2_keys = [ach['key'] for ach in new_achievements2]
                    duplicates = set(pack1_keys) & set(pack2_keys)
                    
                    if duplicates:
                        log(f"❌ CRITICAL: Duplicate achievements: {duplicates}")
                        log("❌ Single-fire prevention is BROKEN")
                        return False
                    else:
                        log(f"✅ No duplicate achievements between packs")
            else:
                log("   No achievements earned (expected for single-fire)")
                
            # Final session check
            session_response2 = requests.get(f"{BASE_URL}/session?userId={user_id}")
            if session_response2.status_code == 200:
                session_data2 = session_response2.json()['user']
                final_achievements = session_data2.get('setAchievements', {})
                
                log(f"\n--- Final Session Data ---")
                log(f"   Final setAchievements: {final_achievements}")
                
                base1_final = final_achievements.get('base1', [])
                if len(base1_final) != len(set(base1_final)):
                    log(f"❌ CRITICAL: Duplicate entries in setAchievements array: {base1_final}")
                    return False
                else:
                    log(f"✅ No duplicates in final setAchievements array")
                    
        return True
        
    else:
        log(f"❌ Failed to open pack 1: {response.status_code}")
        return False

if __name__ == "__main__":
    success = debug_achievement_database_update()
    if success:
        log("\n🎉 Achievement system working correctly!")
    else:
        log("\n⚠️ Achievement system has critical issues!")