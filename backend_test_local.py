#!/usr/bin/env python3
"""
Backend API Testing for Pokemon Pack Ripper - Card Breakdown Quantity Feature (LOCAL)
Tests the POST /api/cards/breakdown-quantity endpoint after server restart using local server
"""

import requests
import json
import time
import uuid

# Configuration - Using local server
BASE_URL = "http://localhost:3000/api"

def test_card_breakdown_quantity():
    """Test the card breakdown quantity feature"""
    print("🧪 TESTING CARD BREAKDOWN QUANTITY FEATURE (LOCAL)")
    print("=" * 60)
    
    try:
        # Step 1: Create test user
        print("\n1️⃣ Creating test user...")
        test_username = f"testuser_{uuid.uuid4().hex[:8]}"
        test_password = "testpass123"
        
        signup_response = requests.post(f"{BASE_URL}/auth/signup", json={
            "username": test_username,
            "password": test_password
        })
        
        if signup_response.status_code != 200:
            print(f"❌ Failed to create user: {signup_response.status_code} - {signup_response.text}")
            return False
            
        user_data = signup_response.json()
        user_id = user_data["user"]["id"]
        print(f"✅ User created successfully: {test_username} (ID: {user_id})")
        print(f"   Starting points: {user_data['user']['points']}")
        
        # Step 2: Open a pack to get some cards
        print("\n2️⃣ Opening a pack to get cards...")
        pack_response = requests.post(f"{BASE_URL}/packs/open", json={
            "userId": user_id,
            "setId": "xy1"  # Using XY Base Set
        })
        
        if pack_response.status_code != 200:
            print(f"❌ Failed to open pack: {pack_response.status_code} - {pack_response.text}")
            return False
            
        pack_data = pack_response.json()
        cards = pack_data["cards"]
        print(f"✅ Pack opened successfully: {len(cards)} cards received")
        print(f"   Points after pack: {pack_data['pointsRemaining']}")
        
        # Find a Common card to test with
        common_card = None
        for card in cards:
            if card.get("rarity") == "Common":
                common_card = card
                break
                
        if not common_card:
            print("❌ No Common card found in pack")
            return False
            
        print(f"   Found Common card: {common_card['name']} (ID: {common_card['id']})")
        
        # Step 3: Open more packs to get multiple copies of cards
        print("\n3️⃣ Opening additional packs to get more cards...")
        for i in range(2):  # Open 2 more packs
            pack_response = requests.post(f"{BASE_URL}/packs/open", json={
                "userId": user_id,
                "setId": "xy1"
            })
            if pack_response.status_code == 200:
                pack_data = pack_response.json()
                print(f"   Pack {i+2} opened: {len(pack_data['cards'])} cards")
            else:
                print(f"   Pack {i+2} failed: {pack_response.status_code}")
        
        # Step 4: Get user collection to see what cards we have
        print("\n4️⃣ Checking user collection...")
        collection_response = requests.get(f"{BASE_URL}/collection", params={"userId": user_id})
        
        if collection_response.status_code != 200:
            print(f"❌ Failed to get collection: {collection_response.status_code}")
            return False
            
        collection = collection_response.json()["collection"]
        print(f"✅ Collection retrieved: {len(collection)} total cards")
        
        # Find a card we have multiple copies of
        card_counts = {}
        for card in collection:
            card_id = card["id"]
            if card_id not in card_counts:
                card_counts[card_id] = []
            card_counts[card_id].append(card)
        
        # Find a card with at least 2 copies
        target_card_id = None
        target_card_copies = []
        for card_id, copies in card_counts.items():
            if len(copies) >= 2:
                target_card_id = card_id
                target_card_copies = copies
                break
        
        if not target_card_id:
            # Use any card we have
            target_card_id = list(card_counts.keys())[0]
            target_card_copies = card_counts[target_card_id]
            
        target_card = target_card_copies[0]
        copies_count = len(target_card_copies)
        print(f"   Target card: {target_card['name']} (ID: {target_card_id})")
        print(f"   Copies available: {copies_count}")
        print(f"   Card rarity: {target_card.get('rarity', 'Unknown')}")
        
        # Step 5: Get user points before breakdown
        session_response = requests.get(f"{BASE_URL}/session", params={"userId": user_id})
        if session_response.status_code == 200:
            points_before = session_response.json()["user"]["points"]
            print(f"   Points before breakdown: {points_before}")
        else:
            print(f"   Could not get points: {session_response.status_code}")
            points_before = 0
        
        # Step 6: Test breakdown-quantity endpoint
        print("\n5️⃣ Testing breakdown-quantity endpoint...")
        breakdown_amount = min(2, copies_count)  # Break down 2 cards or all we have
        
        breakdown_response = requests.post(f"{BASE_URL}/cards/breakdown-quantity", json={
            "userId": user_id,
            "cardId": target_card_id,
            "amount": breakdown_amount
        })
        
        print(f"   Request: POST /api/cards/breakdown-quantity")
        print(f"   Body: userId={user_id}, cardId={target_card_id}, amount={breakdown_amount}")
        print(f"   Response status: {breakdown_response.status_code}")
        print(f"   Response body: {breakdown_response.text}")
        
        if breakdown_response.status_code != 200:
            print(f"❌ Breakdown-quantity failed: {breakdown_response.status_code}")
            print(f"   Error: {breakdown_response.text}")
            return False
            
        breakdown_data = breakdown_response.json()
        print(f"✅ Breakdown-quantity successful!")
        print(f"   Success: {breakdown_data.get('success')}")
        print(f"   Points awarded: {breakdown_data.get('pointsAwarded')}")
        print(f"   Cards broken down: {breakdown_data.get('cardsBreakdown')}")
        
        # Calculate expected points
        rarity = target_card.get('rarity', 'Common')
        expected_points_per_card = 10 if rarity == 'Common' else 20 if rarity == 'Uncommon' else 50
        expected_total_points = expected_points_per_card * breakdown_amount
        
        print(f"   Expected points: {expected_total_points} ({expected_points_per_card} per {rarity} × {breakdown_amount})")
        
        # Verify the points match
        actual_points = breakdown_data.get('pointsAwarded', 0)
        if actual_points == expected_total_points:
            print("✅ Points calculation correct")
        else:
            print(f"❌ Points mismatch: got {actual_points}, expected {expected_total_points}")
            return False
        
        # Step 7: Verify collection updated
        print("\n6️⃣ Verifying collection updated...")
        collection_response = requests.get(f"{BASE_URL}/collection", params={"userId": user_id})
        
        if collection_response.status_code == 200:
            new_collection = collection_response.json()["collection"]
            new_card_count = len([c for c in new_collection if c["id"] == target_card_id])
            expected_remaining = copies_count - breakdown_amount
            
            print(f"   Cards remaining: {new_card_count} (expected: {expected_remaining})")
            
            if new_card_count == expected_remaining:
                print("✅ Collection updated correctly")
            else:
                print(f"❌ Collection count mismatch: got {new_card_count}, expected {expected_remaining}")
                return False
        else:
            print(f"❌ Failed to verify collection: {collection_response.status_code}")
            return False
        
        # Step 8: Verify points updated
        print("\n7️⃣ Verifying points updated...")
        session_response = requests.get(f"{BASE_URL}/session", params={"userId": user_id})
        
        if session_response.status_code == 200:
            points_after = session_response.json()["user"]["points"]
            points_gained = points_after - points_before
            
            print(f"   Points after breakdown: {points_after}")
            print(f"   Points gained: {points_gained} (expected: {expected_total_points})")
            
            if points_gained == expected_total_points:
                print("✅ Points updated correctly")
            else:
                print(f"❌ Points mismatch: gained {points_gained}, expected {expected_total_points}")
                return False
        else:
            print(f"❌ Failed to verify points: {session_response.status_code}")
            return False
        
        print("\n🎉 BREAKDOWN-QUANTITY TEST PASSED!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        return False

def test_batch_breakdown():
    """Test that the batch breakdown endpoint still works"""
    print("\n\n🧪 TESTING BATCH BREAKDOWN ENDPOINT (LOCAL)")
    print("=" * 60)
    
    try:
        # Create another test user
        print("\n1️⃣ Creating test user for batch breakdown...")
        test_username = f"batchuser_{uuid.uuid4().hex[:8]}"
        test_password = "testpass123"
        
        signup_response = requests.post(f"{BASE_URL}/auth/signup", json={
            "username": test_username,
            "password": test_password
        })
        
        if signup_response.status_code != 200:
            print(f"❌ Failed to create user: {signup_response.status_code}")
            return False
            
        user_data = signup_response.json()
        user_id = user_data["user"]["id"]
        print(f"✅ User created: {test_username}")
        
        # Open a pack
        print("\n2️⃣ Opening pack for batch breakdown test...")
        pack_response = requests.post(f"{BASE_URL}/packs/open", json={
            "userId": user_id,
            "setId": "xy1"
        })
        
        if pack_response.status_code != 200:
            print(f"❌ Failed to open pack: {pack_response.status_code}")
            return False
            
        pack_data = pack_response.json()
        cards = pack_data["cards"]
        print(f"✅ Pack opened: {len(cards)} cards")
        
        # Get points before
        session_response = requests.get(f"{BASE_URL}/session", params={"userId": user_id})
        points_before = session_response.json()["user"]["points"] if session_response.status_code == 200 else 0
        
        # Test batch breakdown with first 2 cards
        print("\n3️⃣ Testing batch breakdown...")
        cards_to_breakdown = cards[:2]
        
        breakdown_response = requests.post(f"{BASE_URL}/cards/breakdown", json={
            "userId": user_id,
            "cards": cards_to_breakdown
        })
        
        print(f"   Request: POST /api/cards/breakdown")
        print(f"   Cards to breakdown: {len(cards_to_breakdown)}")
        print(f"   Response status: {breakdown_response.status_code}")
        
        if breakdown_response.status_code != 200:
            print(f"❌ Batch breakdown failed: {breakdown_response.status_code}")
            print(f"   Error: {breakdown_response.text}")
            return False
            
        breakdown_data = breakdown_response.json()
        print(f"✅ Batch breakdown successful!")
        print(f"   Points awarded: {breakdown_data.get('pointsAwarded')}")
        print(f"   Cards broken down: {breakdown_data.get('cardsBreakdown')}")
        
        print("\n🎉 BATCH BREAKDOWN TEST PASSED!")
        return True
        
    except Exception as e:
        print(f"❌ Batch breakdown test failed: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 STARTING CARD BREAKDOWN TESTING AFTER SERVER RESTART (LOCAL)")
    print("=" * 80)
    
    # Test breakdown-quantity endpoint
    quantity_test_passed = test_card_breakdown_quantity()
    
    # Test batch breakdown endpoint
    batch_test_passed = test_batch_breakdown()
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    print(f"Breakdown-Quantity Test: {'✅ PASSED' if quantity_test_passed else '❌ FAILED'}")
    print(f"Batch Breakdown Test: {'✅ PASSED' if batch_test_passed else '❌ FAILED'}")
    
    if quantity_test_passed and batch_test_passed:
        print("\n🎉 ALL TESTS PASSED - CARD BREAKDOWN FUNCTIONALITY WORKING!")
        return True
    else:
        print("\n❌ SOME TESTS FAILED - ISSUES DETECTED")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)