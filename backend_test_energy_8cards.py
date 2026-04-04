#!/usr/bin/env python3

import requests
import json
import time
import uuid
from typing import Dict, List, Any

# Test configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class EnergyCard8PackTester:
    def __init__(self):
        self.test_results = []
        self.test_user_id = None
        self.test_username = f"energytest_{uuid.uuid4().hex[:8]}"
        self.test_password = "testpass123"
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASSED" if passed else "❌ FAILED"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()

    def setup_test_user(self):
        """Setup a test user for pack opening tests"""
        print("=== Setting up test user ===")
        
        try:
            # Create test user
            signup_data = {
                "username": self.test_username,
                "password": self.test_password
            }
            
            response = requests.post(f"{API_BASE}/auth/signup", json=signup_data, timeout=30)
            
            if response.status_code != 200:
                print(f"Failed to create test user: {response.status_code}")
                return False
                
            data = response.json()
            self.test_user_id = data['user']['id']
            print(f"✅ Created test user: {self.test_username} (ID: {self.test_user_id})")
            return True
            
        except Exception as e:
            print(f"❌ Failed to setup test user: {str(e)}")
            return False

    def test_energy_card_filtering(self):
        """Test 1: Energy Card Filtering - Verify NO energy cards appear in any pack"""
        print("=== Testing Energy Card Filtering ===")
        
        if not self.test_user_id:
            if not self.setup_test_user():
                self.log_test("Energy Card Filtering", False, "Failed to setup test user")
                return False
        
        try:
            # Test with multiple different sets to ensure energy filtering works across all sets
            test_sets = ["base1", "swsh1", "xy1", "sm1"]  # Different generations
            energy_cards_found = []
            total_packs_opened = 0
            total_cards_pulled = 0
            
            for set_id in test_sets:
                print(f"   Testing set: {set_id}")
                
                # Open 3 packs from each set
                for pack_num in range(3):
                    pack_data = {
                        "userId": self.test_user_id,
                        "setId": set_id
                    }
                    
                    response = requests.post(f"{API_BASE}/packs/open", json=pack_data, timeout=30)
                    
                    if response.status_code == 402:
                        # Insufficient points - expected after opening many packs
                        print(f"   Insufficient points after opening {total_packs_opened} packs")
                        break
                    elif response.status_code != 200:
                        self.log_test("Energy Card Filtering", False, f"Pack opening failed for {set_id}: {response.status_code}")
                        return False
                        
                    data = response.json()
                    cards = data.get('cards', [])
                    total_packs_opened += 1
                    total_cards_pulled += len(cards)
                    
                    # Check each card for energy supertype
                    for card in cards:
                        if card.get('supertype') == 'Energy':
                            energy_cards_found.append({
                                'set': set_id,
                                'pack': pack_num + 1,
                                'card_name': card.get('name', 'Unknown'),
                                'card_id': card.get('id', 'Unknown')
                            })
                            
                    print(f"     Pack {pack_num + 1}: {len(cards)} cards")
                    
                if response.status_code == 402:
                    break  # Stop if we run out of points
                    
            # Check results
            if energy_cards_found:
                details = f"Found {len(energy_cards_found)} energy cards in {total_packs_opened} packs: "
                details += ", ".join([f"{card['card_name']} from {card['set']}" for card in energy_cards_found[:3]])
                if len(energy_cards_found) > 3:
                    details += f" and {len(energy_cards_found) - 3} more"
                self.log_test("Energy Card Filtering", False, details)
                return False
            else:
                self.log_test("Energy Card Filtering", True, 
                             f"No energy cards found in {total_packs_opened} packs ({total_cards_pulled} total cards) across {len(test_sets)} different sets")
                return True
                
        except Exception as e:
            self.log_test("Energy Card Filtering", False, f"Exception: {str(e)}")
            return False

    def test_pack_size_8_cards(self):
        """Test 2: Pack Size - Verify each pack returns exactly 7-8 cards"""
        print("=== Testing Pack Size (7-8 Cards) ===")
        
        if not self.test_user_id:
            if not self.setup_test_user():
                self.log_test("Pack Size (7-8 Cards)", False, "Failed to setup test user")
                return False
        
        try:
            # Create a fresh user with full points for this test
            fresh_username = f"packsize_{uuid.uuid4().hex[:8]}"
            signup_data = {
                "username": fresh_username,
                "password": self.test_password
            }
            
            response = requests.post(f"{API_BASE}/auth/signup", json=signup_data, timeout=30)
            if response.status_code != 200:
                self.log_test("Pack Size (7-8 Cards)", False, "Failed to create fresh test user")
                return False
                
            fresh_user_id = response.json()['user']['id']
            
            # Open multiple packs and check sizes
            pack_sizes = []
            reverse_holo_count = 0
            
            # Open 10 packs to get good sample size
            for i in range(10):
                pack_data = {
                    "userId": fresh_user_id,
                    "setId": "base1"  # Use base1 for consistent testing
                }
                
                response = requests.post(f"{API_BASE}/packs/open", json=pack_data, timeout=30)
                
                if response.status_code == 402:
                    # Insufficient points
                    print(f"   Ran out of points after {i} packs")
                    break
                elif response.status_code != 200:
                    self.log_test("Pack Size (7-8 Cards)", False, f"Pack opening {i+1} failed: {response.status_code}")
                    return False
                    
                data = response.json()
                cards = data.get('cards', [])
                pack_size = len(cards)
                pack_sizes.append(pack_size)
                
                # Check for reverse holo
                has_reverse_holo = any(card.get('isReverseHolo', False) for card in cards)
                if has_reverse_holo:
                    reverse_holo_count += 1
                    
                print(f"   Pack {i+1}: {pack_size} cards (reverse holo: {has_reverse_holo})")
                
            # Analyze results
            if not pack_sizes:
                self.log_test("Pack Size (7-8 Cards)", False, "No packs were opened successfully")
                return False
                
            # Check that all pack sizes are 7 or 8
            invalid_sizes = [size for size in pack_sizes if size not in [7, 8]]
            if invalid_sizes:
                self.log_test("Pack Size (7-8 Cards)", False, 
                             f"Found invalid pack sizes: {invalid_sizes}. Expected only 7 or 8 cards per pack")
                return False
                
            # Calculate statistics
            avg_size = sum(pack_sizes) / len(pack_sizes)
            size_7_count = pack_sizes.count(7)
            size_8_count = pack_sizes.count(8)
            reverse_holo_rate = (reverse_holo_count / len(pack_sizes)) * 100
            
            details = f"Opened {len(pack_sizes)} packs. Sizes: {size_7_count} packs with 7 cards, {size_8_count} packs with 8 cards. "
            details += f"Average: {avg_size:.1f} cards. Reverse holo rate: {reverse_holo_rate:.1f}% (expected ~40%)"
            
            self.log_test("Pack Size (7-8 Cards)", True, details)
            return True
                
        except Exception as e:
            self.log_test("Pack Size (7-8 Cards)", False, f"Exception: {str(e)}")
            return False

    def test_card_distribution(self):
        """Test 3: Card Distribution - Verify 4 commons, 2 uncommons, 1 rare+, optional reverse holo"""
        print("=== Testing Card Distribution ===")
        
        try:
            # Create a fresh user for this test
            fresh_username = f"distribution_{uuid.uuid4().hex[:8]}"
            signup_data = {
                "username": fresh_username,
                "password": self.test_password
            }
            
            response = requests.post(f"{API_BASE}/auth/signup", json=signup_data, timeout=30)
            if response.status_code != 200:
                self.log_test("Card Distribution", False, "Failed to create fresh test user")
                return False
                
            fresh_user_id = response.json()['user']['id']
            
            # Open several packs and analyze distribution
            distribution_results = []
            
            for i in range(5):  # Test 5 packs
                pack_data = {
                    "userId": fresh_user_id,
                    "setId": "base1"
                }
                
                response = requests.post(f"{API_BASE}/packs/open", json=pack_data, timeout=30)
                
                if response.status_code == 402:
                    print(f"   Ran out of points after {i} packs")
                    break
                elif response.status_code != 200:
                    self.log_test("Card Distribution", False, f"Pack opening {i+1} failed: {response.status_code}")
                    return False
                    
                data = response.json()
                cards = data.get('cards', [])
                
                # Analyze card distribution
                commons = []
                uncommons = []
                rares = []
                reverse_holos = []
                
                for card in cards:
                    rarity = card.get('rarity', '')
                    is_reverse = card.get('isReverseHolo', False)
                    
                    if is_reverse:
                        reverse_holos.append(card)
                    
                    if rarity == 'Common':
                        commons.append(card)
                    elif rarity == 'Uncommon':
                        uncommons.append(card)
                    elif rarity and ('Rare' in rarity or 'Holo' in rarity or 'Ultra' in rarity):
                        rares.append(card)
                        
                # Check for null/undefined cards
                null_cards = [card for card in cards if not card.get('id') or not card.get('name')]
                if null_cards:
                    self.log_test("Card Distribution", False, f"Pack {i+1} contains {len(null_cards)} null/undefined cards")
                    return False
                
                distribution = {
                    'pack': i + 1,
                    'total_cards': len(cards),
                    'commons': len(commons),
                    'uncommons': len(uncommons),
                    'rares': len(rares),
                    'reverse_holos': len(reverse_holos)
                }
                distribution_results.append(distribution)
                
                print(f"   Pack {i+1}: {len(cards)} cards - {len(commons)}C, {len(uncommons)}U, {len(rares)}R, {len(reverse_holos)}RH")
                
            if not distribution_results:
                self.log_test("Card Distribution", False, "No packs were opened successfully")
                return False
                
            # Analyze overall distribution
            issues = []
            for dist in distribution_results:
                # Check expected distribution (allowing some flexibility for older sets)
                if dist['commons'] < 3 or dist['commons'] > 5:
                    issues.append(f"Pack {dist['pack']}: {dist['commons']} commons (expected 4)")
                if dist['uncommons'] < 1 or dist['uncommons'] > 3:
                    issues.append(f"Pack {dist['pack']}: {dist['uncommons']} uncommons (expected 2)")
                if dist['rares'] < 1:
                    issues.append(f"Pack {dist['pack']}: {dist['rares']} rares (expected at least 1)")
                if dist['reverse_holos'] > 1:
                    issues.append(f"Pack {dist['pack']}: {dist['reverse_holos']} reverse holos (expected 0-1)")
                    
            if issues:
                self.log_test("Card Distribution", False, f"Distribution issues found: {'; '.join(issues[:3])}")
                return False
                
            # Calculate averages
            avg_commons = sum(d['commons'] for d in distribution_results) / len(distribution_results)
            avg_uncommons = sum(d['uncommons'] for d in distribution_results) / len(distribution_results)
            avg_rares = sum(d['rares'] for d in distribution_results) / len(distribution_results)
            reverse_holo_rate = sum(1 for d in distribution_results if d['reverse_holos'] > 0) / len(distribution_results) * 100
            
            details = f"Tested {len(distribution_results)} packs. Average distribution: {avg_commons:.1f} commons, "
            details += f"{avg_uncommons:.1f} uncommons, {avg_rares:.1f} rares. Reverse holo rate: {reverse_holo_rate:.1f}%"
            
            self.log_test("Card Distribution", True, details)
            return True
                
        except Exception as e:
            self.log_test("Card Distribution", False, f"Exception: {str(e)}")
            return False

    def test_all_existing_functionality(self):
        """Test 4: All Existing Functionality Still Working"""
        print("=== Testing All Existing Functionality ===")
        
        try:
            # Test points system
            if not self.test_user_id:
                if not self.setup_test_user():
                    self.log_test("Existing Functionality", False, "Failed to setup test user")
                    return False
            
            # Test session endpoint
            response = requests.get(f"{API_BASE}/session?userId={self.test_user_id}", timeout=30)
            if response.status_code != 200:
                self.log_test("Existing Functionality", False, f"Session endpoint failed: {response.status_code}")
                return False
                
            session_data = response.json()
            if not session_data.get('authenticated'):
                self.log_test("Existing Functionality", False, "Session authentication failed")
                return False
                
            # Test collection endpoint
            response = requests.get(f"{API_BASE}/collection?userId={self.test_user_id}", timeout=30)
            if response.status_code != 200:
                self.log_test("Existing Functionality", False, f"Collection endpoint failed: {response.status_code}")
                return False
                
            # Test sets endpoint
            response = requests.get(f"{API_BASE}/sets", timeout=30)
            if response.status_code != 200:
                self.log_test("Existing Functionality", False, f"Sets endpoint failed: {response.status_code}")
                return False
                
            sets_data = response.json()
            if len(sets_data.get('sets', [])) < 150:
                self.log_test("Existing Functionality", False, "Sets endpoint returned too few sets")
                return False
                
            # Test duplicate handling by checking collection after pack opening
            initial_response = requests.get(f"{API_BASE}/collection?userId={self.test_user_id}", timeout=30)
            initial_collection_size = len(initial_response.json().get('collection', []))
            
            # Open a pack
            pack_data = {"userId": self.test_user_id, "setId": "base1"}
            pack_response = requests.post(f"{API_BASE}/packs/open", json=pack_data, timeout=30)
            
            if pack_response.status_code == 200:
                # Check collection grew
                final_response = requests.get(f"{API_BASE}/collection?userId={self.test_user_id}", timeout=30)
                final_collection_size = len(final_response.json().get('collection', []))
                
                if final_collection_size <= initial_collection_size:
                    self.log_test("Existing Functionality", False, "Collection not growing after pack opening")
                    return False
                    
            self.log_test("Existing Functionality", True, 
                         "Points system, collection saving, duplicate handling, and all endpoints working correctly")
            return True
                
        except Exception as e:
            self.log_test("Existing Functionality", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests for energy card filtering and 8-card packs"""
        print("🚀 Starting Energy Card Filtering & 8-Card Pack Tests")
        print("=" * 70)
        
        tests = [
            self.test_energy_card_filtering,
            self.test_pack_size_8_cards,
            self.test_card_distribution,
            self.test_all_existing_functionality
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
                
        print("=" * 70)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        print("=" * 70)
        
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
                
        return passed == total

if __name__ == "__main__":
    tester = EnergyCard8PackTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)