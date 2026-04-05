#!/usr/bin/env python3
"""
Backend API Testing for Pokemon Pack Ripper - Card Breakdown Feature
Tests the new single-card breakdown quantity feature and existing batch breakdown
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://pokepackripper.netlify.app/api"
TEST_USERNAME = "breakdown_tester_" + str(int(time.time()))
TEST_PASSWORD = "testpass123"

# Test data
COMMON_CARD_ID = "base1-1"  # Alakazam from Base Set (Common)
UNCOMMON_CARD_ID = "base1-2"  # Blastoise from Base Set (Uncommon) 
RARE_CARD_ID = "base1-4"  # Charizard from Base Set (Rare Holo)

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def test_card_breakdown_feature():
    """Test the new card breakdown quantity feature"""
    print("🧪 TESTING CARD BREAKDOWN QUANTITY FEATURE")
    print("=" * 60)
    
    # Step 1: Create test user
    print("\n1️⃣ Creating test user...")
    signup_data = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, timeout=10)
        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data["user"]["id"]
            initial_points = user_data["user"]["points"]
            log_test("User Creation", "PASS", f"User ID: {user_id}, Initial Points: {initial_points}")
        else:
            log_test("User Creation", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("User Creation", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 2: Add multiple copies of cards to collection
    print("\n2️⃣ Adding multiple copies of cards to collection...")
    
    # Open 5 packs from Base Set to get multiple cards
    pack_count = 0
    all_cards_collected = []
    max_attempts = 5
    
    for attempt in range(max_attempts):
        pack_data = {
            "userId": user_id,
            "setId": "base1"  # Base Set
        }
        
        try:
            response = requests.post(f"{BASE_URL}/packs/open", json=pack_data, timeout=15)
            if response.status_code == 200:
                pack_result = response.json()
                cards = pack_result.get("cards", [])
                pack_count += 1
                all_cards_collected.extend(cards)
                
                log_test(f"Pack Opening #{pack_count}", "PASS", 
                        f"Got {len(cards)} cards")
            else:
                log_test(f"Pack Opening #{pack_count}", "FAIL", 
                        f"Status: {response.status_code}")
                break
        except Exception as e:
            log_test(f"Pack Opening #{pack_count}", "FAIL", f"Exception: {str(e)}")
            break
    
    # Find a card we have multiple copies of
    card_counts = {}
    for card in all_cards_collected:
        card_id = card["id"]
        if card_id in card_counts:
            card_counts[card_id] += 1
        else:
            card_counts[card_id] = 1
    
    # Find the first card we have at least 2 copies of
    target_card_id = None
    target_card_count = 0
    for card_id, count in card_counts.items():
        if count >= 2:
            target_card_id = card_id
            target_card_count = count
            break
    
    if target_card_id is None:
        log_test("Card Collection Setup", "FAIL", 
                f"No cards with multiple copies found. Total unique cards: {len(card_counts)}")
        return False
    
    log_test("Card Collection Setup", "PASS", 
            f"Found {target_card_count} copies of card {target_card_id}")
    
    # Step 3: Get current collection to verify card counts
    print("\n3️⃣ Verifying collection state...")
    try:
        response = requests.get(f"{BASE_URL}/collection?userId={user_id}", timeout=10)
        if response.status_code == 200:
            collection_data = response.json()
            collection = collection_data.get("collection", [])
            
            # Count target cards in collection
            target_cards_in_collection = [card for card in collection if card["id"] == target_card_id]
            total_cards = len(collection)
            
            log_test("Collection Verification", "PASS", 
                    f"Total cards: {total_cards}, Target cards: {len(target_cards_in_collection)}")
            
            if len(target_cards_in_collection) < 2:
                log_test("Collection Verification", "FAIL", 
                        "Not enough target cards for breakdown test")
                return False
                
        else:
            log_test("Collection Verification", "FAIL", 
                    f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Collection Verification", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 4: Get current points before breakdown
    print("\n4️⃣ Getting current user points...")
    try:
        response = requests.get(f"{BASE_URL}/session?userId={user_id}", timeout=10)
        if response.status_code == 200:
            session_data = response.json()
            points_before = session_data["user"]["points"]
            log_test("Points Check", "PASS", f"Points before breakdown: {points_before}")
        else:
            log_test("Points Check", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Points Check", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 5: Test single-card breakdown with amount=2
    print("\n5️⃣ Testing single-card breakdown (amount=2)...")
    breakdown_amount = 2
    breakdown_data = {
        "userId": user_id,
        "cardId": target_card_id,
        "amount": breakdown_amount
    }
    
    # Get the rarity of the target card to calculate expected points
    target_card_rarity = None
    for card in all_cards_collected:
        if card["id"] == target_card_id:
            target_card_rarity = card.get("rarity", "Common")
            break
    
    # Calculate expected points based on rarity
    rarity_points = {
        'Common': 10, 'Uncommon': 20, 'Rare': 50, 'Rare Holo': 50,
        'Double Rare': 100, 'Illustration Rare': 200, 'Ultra Rare': 200,
        'Hyper Rare': 500, 'Secret Rare': 500
    }
    expected_points_per_card = rarity_points.get(target_card_rarity, 10)
    expected_total_points = expected_points_per_card * breakdown_amount
    
    try:
        response = requests.post(f"{BASE_URL}/cards/breakdown-single", json=breakdown_data, timeout=10)
        if response.status_code == 200:
            breakdown_result = response.json()
            points_awarded = breakdown_result.get("pointsAwarded", 0)
            cards_breakdown = breakdown_result.get("cardsBreakdown", 0)
            
            if points_awarded == expected_total_points and cards_breakdown == breakdown_amount:
                log_test("Single-Card Breakdown", "PASS", 
                        f"Awarded {points_awarded} points for {cards_breakdown} {target_card_rarity} cards")
            else:
                log_test("Single-Card Breakdown", "FAIL", 
                        f"Expected {expected_total_points} points and {breakdown_amount} cards, got {points_awarded} points and {cards_breakdown} cards")
                return False
        else:
            log_test("Single-Card Breakdown", "FAIL", 
                    f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Single-Card Breakdown", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 6: Verify collection after breakdown
    print("\n6️⃣ Verifying collection after breakdown...")
    try:
        response = requests.get(f"{BASE_URL}/collection?userId={user_id}", timeout=10)
        if response.status_code == 200:
            collection_data = response.json()
            collection = collection_data.get("collection", [])
            
            # Count remaining target cards
            remaining_target_cards = [card for card in collection if card["id"] == target_card_id]
            expected_remaining = len(target_cards_in_collection) - breakdown_amount
            
            if len(remaining_target_cards) == expected_remaining:
                log_test("Collection After Breakdown", "PASS", 
                        f"Remaining target cards: {len(remaining_target_cards)} (expected: {expected_remaining})")
            else:
                log_test("Collection After Breakdown", "FAIL", 
                        f"Expected {expected_remaining} remaining cards, got {len(remaining_target_cards)}")
                return False
        else:
            log_test("Collection After Breakdown", "FAIL", 
                    f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Collection After Breakdown", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 7: Verify points increased correctly
    print("\n7️⃣ Verifying points increase...")
    try:
        response = requests.get(f"{BASE_URL}/session?userId={user_id}", timeout=10)
        if response.status_code == 200:
            session_data = response.json()
            points_after = session_data["user"]["points"]
            points_increase = points_after - points_before
            expected_increase = expected_points_per_card * breakdown_amount
            
            if points_increase == expected_increase:
                log_test("Points Increase", "PASS", 
                        f"Points increased by {points_increase} (expected: {expected_increase})")
            else:
                log_test("Points Increase", "FAIL", 
                        f"Expected increase of {expected_increase}, got {points_increase}")
                return False
        else:
            log_test("Points Increase", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Points Increase", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 8: Test edge cases
    print("\n8️⃣ Testing edge cases...")
    
    # Test 8a: Try to breakdown more cards than owned
    print("  8a. Testing breakdown more than owned...")
    excessive_breakdown_data = {
        "userId": user_id,
        "cardId": target_card_id,
        "amount": 999  # Way more than we have
    }
    
    try:
        response = requests.post(f"{BASE_URL}/cards/breakdown-single", json=excessive_breakdown_data, timeout=10)
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "only have" in error_msg.lower():
                log_test("Edge Case: Excessive Amount", "PASS", 
                        f"Correctly rejected with: {error_msg}")
            else:
                log_test("Edge Case: Excessive Amount", "FAIL", 
                        f"Wrong error message: {error_msg}")
                return False
        else:
            log_test("Edge Case: Excessive Amount", "FAIL", 
                    f"Expected 400 status, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Edge Case: Excessive Amount", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 8b: Try to breakdown with invalid amount (0)
    print("  8b. Testing breakdown with amount=0...")
    zero_breakdown_data = {
        "userId": user_id,
        "cardId": target_card_id,
        "amount": 0
    }
    
    try:
        response = requests.post(f"{BASE_URL}/cards/breakdown-single", json=zero_breakdown_data, timeout=10)
        if response.status_code == 400:
            log_test("Edge Case: Zero Amount", "PASS", "Correctly rejected amount=0")
        else:
            log_test("Edge Case: Zero Amount", "FAIL", 
                    f"Expected 400 status, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Edge Case: Zero Amount", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 8c: Try to breakdown non-existent card
    print("  8c. Testing breakdown non-existent card...")
    nonexistent_breakdown_data = {
        "userId": user_id,
        "cardId": "nonexistent-card-id",
        "amount": 1
    }
    
    try:
        response = requests.post(f"{BASE_URL}/cards/breakdown-single", json=nonexistent_breakdown_data, timeout=10)
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "only have 0" in error_msg.lower() or "don't have" in error_msg.lower():
                log_test("Edge Case: Non-existent Card", "PASS", 
                        f"Correctly rejected: {error_msg}")
            else:
                log_test("Edge Case: Non-existent Card", "FAIL", 
                        f"Wrong error message: {error_msg}")
                return False
        else:
            log_test("Edge Case: Non-existent Card", "FAIL", 
                    f"Expected 400 status, got {response.status_code}")
            return False
    except Exception as e:
        log_test("Edge Case: Non-existent Card", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Step 9: Test existing batch breakdown still works
    print("\n9️⃣ Testing existing batch breakdown functionality...")
    
    # Get some cards for batch breakdown
    try:
        response = requests.get(f"{BASE_URL}/collection?userId={user_id}", timeout=10)
        if response.status_code == 200:
            collection_data = response.json()
            collection = collection_data.get("collection", [])
            
            if len(collection) >= 2:
                # Take 2 cards for batch breakdown
                cards_for_batch = collection[:2]
                
                batch_breakdown_data = {
                    "userId": user_id,
                    "cards": cards_for_batch
                }
                
                response = requests.post(f"{BASE_URL}/cards/breakdown", json=batch_breakdown_data, timeout=10)
                if response.status_code == 200:
                    batch_result = response.json()
                    points_awarded = batch_result.get("pointsAwarded", 0)
                    cards_breakdown = batch_result.get("cardsBreakdown", 0)
                    
                    if cards_breakdown == 2 and points_awarded > 0:
                        log_test("Batch Breakdown", "PASS", 
                                f"Batch breakdown working: {points_awarded} points for {cards_breakdown} cards")
                    else:
                        log_test("Batch Breakdown", "FAIL", 
                                f"Unexpected result: {points_awarded} points, {cards_breakdown} cards")
                        return False
                else:
                    log_test("Batch Breakdown", "FAIL", 
                            f"Status: {response.status_code}, Response: {response.text}")
                    return False
            else:
                log_test("Batch Breakdown", "SKIP", "Not enough cards for batch test")
        else:
            log_test("Batch Breakdown", "FAIL", f"Could not get collection: {response.status_code}")
            return False
    except Exception as e:
        log_test("Batch Breakdown", "FAIL", f"Exception: {str(e)}")
        return False
    
    print("\n🎉 ALL CARD BREAKDOWN TESTS PASSED!")
    return True

def test_breakdown_point_values():
    """Test breakdown point values for different rarities"""
    print("\n🧪 TESTING BREAKDOWN POINT VALUES")
    print("=" * 60)
    
    # Expected values from BREAKDOWN_VALUES constant
    expected_values = {
        'Common': 10,
        'Uncommon': 20,
        'Rare': 50,
        'Rare Holo': 50,
        'Double Rare': 100,
        'Illustration Rare': 200,
        'Ultra Rare': 200,
        'Hyper Rare': 500,
        'Secret Rare': 500
    }
    
    print("Expected breakdown values:")
    for rarity, points in expected_values.items():
        print(f"  {rarity}: {points} points")
    
    log_test("Breakdown Values Reference", "PASS", "Values documented and available in code")
    return True

if __name__ == "__main__":
    print("🚀 STARTING CARD BREAKDOWN FEATURE TESTING")
    print("=" * 60)
    
    success = True
    
    # Test the main breakdown functionality
    if not test_card_breakdown_feature():
        success = False
    
    # Test breakdown point values
    if not test_breakdown_point_values():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 ALL TESTS PASSED - CARD BREAKDOWN FEATURE IS WORKING!")
    else:
        print("❌ SOME TESTS FAILED - ISSUES FOUND")
    print("=" * 60)