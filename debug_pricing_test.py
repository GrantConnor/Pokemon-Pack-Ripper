#!/usr/bin/env python3
"""
Debug test to check what's happening with pricing
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def debug_pricing():
    """Debug pricing by checking server logs"""
    print("🔍 Debugging pack pricing...")
    
    # Create a test user
    test_username = f"debuguser_{int(time.time())}"
    test_password = "testpass123"
    
    session = requests.Session()
    
    try:
        # Sign up
        response = session.post(f"{API_BASE}/auth/signup", 
                               json={"username": test_username, "password": test_password})
        
        if response.status_code != 200:
            print(f"❌ Failed to create test user: {response.status_code}")
            return
        
        user_data = response.json()
        user_id = user_data.get('user', {}).get('id')
        initial_points = user_data.get('user', {}).get('points', 0)
        
        print(f"✅ Created test user: {test_username}")
        print(f"   User ID: {user_id}")
        print(f"   Initial points: {initial_points}")
        
        # Test different sets to see their costs
        test_sets = [
            ("base1", "Base Set", "Should be 200 (vintage)"),
            ("ex1", "Ruby & Sapphire", "Should be 150 (EX era)"),
            ("swsh1", "Sword & Shield", "Should be 100 (modern)"),
            ("base4", "Legendary Collection", "Should be 200 (vintage)"),
        ]
        
        current_points = initial_points
        
        for set_id, set_name, expected in test_sets:
            print(f"\n💰 Testing {set_name} ({set_id}) - {expected}")
            
            if current_points < 200:  # Not enough points
                print(f"   ⚠️  Skipping {set_name} - insufficient points ({current_points})")
                continue
            
            response = session.post(f"{API_BASE}/packs/open", 
                                   json={"userId": user_id, "setId": set_id, "bulk": False})
            
            if response.status_code == 200:
                data = response.json()
                points_remaining = data.get('pointsRemaining', 0)
                actual_cost = current_points - points_remaining
                print(f"   Points before: {current_points}")
                print(f"   Points after: {points_remaining}")
                print(f"   Actual cost: {actual_cost}")
                current_points = points_remaining
            elif response.status_code == 404:
                print(f"   ⚠️  Set {set_id} not found in API")
            else:
                print(f"   ❌ Failed: {response.status_code} - {response.text}")
        
    except Exception as e:
        print(f"❌ Error during debug: {str(e)}")

if __name__ == "__main__":
    debug_pricing()