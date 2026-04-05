#!/usr/bin/env python3
"""
Final verification test for pack pricing with a regular user to see actual costs
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_pricing_with_regular_user():
    """Test pricing with a regular user to see actual costs"""
    print("🔍 Testing pack pricing with regular user to verify actual costs...")
    
    # Create a test user
    test_username = f"testuser_{int(time.time())}"
    test_password = "testpass123"
    
    session = requests.Session()
    
    try:
        # Sign up
        response = session.post(f"{API_BASE}/auth/signup", 
                               json={"username": test_username, "password": test_password})
        
        if response.status_code != 200:
            print(f"❌ Failed to create test user: {response.status_code}")
            return False
        
        user_data = response.json()
        user_id = user_data.get('user', {}).get('id')
        initial_points = user_data.get('user', {}).get('points', 0)
        
        print(f"✅ Created test user: {test_username}")
        print(f"   User ID: {user_id}")
        print(f"   Initial points: {initial_points}")
        
        # Test vintage set pricing (base1 - should cost 200)
        print(f"\n💰 Testing Vintage Set Pricing (base1)...")
        response = session.post(f"{API_BASE}/packs/open", 
                               json={"userId": user_id, "setId": "base1", "bulk": False})
        
        if response.status_code == 200:
            data = response.json()
            points_remaining = data.get('pointsRemaining', 0)
            actual_cost = initial_points - points_remaining
            print(f"   Points before: {initial_points}")
            print(f"   Points after: {points_remaining}")
            print(f"   Actual cost: {actual_cost}")
            print(f"   Expected cost: 200")
            
            if actual_cost == 200:
                print("✅ Vintage pricing correct (200 points)")
            else:
                print(f"❌ Vintage pricing incorrect: expected 200, got {actual_cost}")
                return False
        else:
            print(f"❌ Failed to open vintage pack: {response.status_code} - {response.text}")
            return False
        
        # Test EX era pricing (ex1 - should cost 150)
        print(f"\n💰 Testing EX Era Set Pricing (ex1)...")
        current_points = points_remaining
        response = session.post(f"{API_BASE}/packs/open", 
                               json={"userId": user_id, "setId": "ex1", "bulk": False})
        
        if response.status_code == 200:
            data = response.json()
            points_remaining = data.get('pointsRemaining', 0)
            actual_cost = current_points - points_remaining
            print(f"   Points before: {current_points}")
            print(f"   Points after: {points_remaining}")
            print(f"   Actual cost: {actual_cost}")
            print(f"   Expected cost: 150")
            
            if actual_cost == 150:
                print("✅ EX era pricing correct (150 points)")
            else:
                print(f"❌ EX era pricing incorrect: expected 150, got {actual_cost}")
                return False
        else:
            print(f"❌ Failed to open EX pack: {response.status_code} - {response.text}")
            return False
        
        # Test modern set pricing (find a set not in vintage/EX lists)
        print(f"\n💰 Testing Modern Set Pricing (swsh1)...")
        current_points = points_remaining
        response = session.post(f"{API_BASE}/packs/open", 
                               json={"userId": user_id, "setId": "swsh1", "bulk": False})
        
        if response.status_code == 200:
            data = response.json()
            points_remaining = data.get('pointsRemaining', 0)
            actual_cost = current_points - points_remaining
            print(f"   Points before: {current_points}")
            print(f"   Points after: {points_remaining}")
            print(f"   Actual cost: {actual_cost}")
            print(f"   Expected cost: 100")
            
            if actual_cost == 100:
                print("✅ Modern pricing correct (100 points)")
            else:
                print(f"❌ Modern pricing incorrect: expected 100, got {actual_cost}")
                return False
        else:
            print(f"❌ Failed to open modern pack: {response.status_code} - {response.text}")
            return False
        
        print("\n🎉 All pricing tiers verified with actual point deductions!")
        return True
        
    except Exception as e:
        print(f"❌ Error during pricing test: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_pricing_with_regular_user()
    if success:
        print("\n✅ Pricing verification completed successfully")
    else:
        print("\n❌ Pricing verification failed")