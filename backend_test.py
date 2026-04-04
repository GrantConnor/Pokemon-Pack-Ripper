#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Pokemon Pack Ripper - Friends & Trading System
Tests all friend request flows, trading functionality, and admin features.
"""

import requests
import json
import time
import random
import string
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://pokepackripper.netlify.app/api"
HEADERS = {"Content-Type": "application/json"}

class FriendsAndTradingTester:
    def __init__(self):
        self.test_users = []
        self.test_results = []
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASSED" if passed else "❌ FAILED"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        
    def generate_username(self) -> str:
        """Generate a unique test username"""
        return f"testuser_{random.randint(1000, 9999)}"
        
    def create_test_user(self, username: str = None) -> Dict[str, Any]:
        """Create a test user and return user data"""
        if not username:
            username = self.generate_username()
        password = "testpass123"
        
        try:
            response = requests.post(
                f"{BASE_URL}/auth/signup",
                headers=HEADERS,
                json={"username": username, "password": password}
            )
            
            if response.status_code == 201 or response.status_code == 200:
                data = response.json()
                user_data = {
                    "username": username,
                    "password": password,
                    "id": data["user"]["id"],
                    "points": data["user"]["points"]
                }
                self.test_users.append(user_data)
                return user_data
            else:
                print(f"Failed to create user {username}: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error creating user {username}: {str(e)}")
            return None
            
    def give_user_cards(self, user: Dict[str, Any], num_packs: int = 2) -> bool:
        """Give a user some cards by opening packs"""
        try:
            # Open packs to get cards
            for i in range(num_packs):
                response = requests.post(
                    f"{BASE_URL}/packs/open",
                    headers=HEADERS,
                    json={
                        "userId": user["id"],
                        "setId": "base1",  # Base Set
                        "bulk": False
                    }
                )
                
                if response.status_code != 200:
                    print(f"Failed to open pack for {user['username']}: {response.status_code}")
                    return False
                    
            return True
            
        except Exception as e:
            print(f"Error giving cards to {user['username']}: {str(e)}")
            return False
            
    def get_user_collection(self, user: Dict[str, Any]) -> List[Dict]:
        """Get user's card collection"""
        try:
            response = requests.get(
                f"{BASE_URL}/collection",
                params={"userId": user["id"]}
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("collection", [])
            else:
                print(f"Failed to get collection for {user['username']}: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"Error getting collection for {user['username']}: {str(e)}")
            return []
            
    def test_friend_request_flow(self):
        """Test 1: Complete friend request flow (send, accept)"""
        print("\n=== TEST 1: Friend Request Flow ===")
        
        # Create two test users
        user1 = self.create_test_user()
        user2 = self.create_test_user()
        
        if not user1 or not user2:
            self.log_test("Friend Request Flow - User Creation", False, "Failed to create test users")
            return
            
        self.log_test("Friend Request Flow - User Creation", True, f"Created {user1['username']} and {user2['username']}")
        
        # User1 sends friend request to User2
        try:
            response = requests.post(
                f"{BASE_URL}/friends/send-request",
                headers=HEADERS,
                json={
                    "userId": user1["id"],
                    "targetUsername": user2["username"]
                }
            )
            
            if response.status_code == 200:
                self.log_test("Friend Request Flow - Send Request", True, f"{user1['username']} sent request to {user2['username']}")
            else:
                self.log_test("Friend Request Flow - Send Request", False, f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_test("Friend Request Flow - Send Request", False, f"Error: {str(e)}")
            return
            
        # Verify User2 has pending request
        try:
            response = requests.get(
                f"{BASE_URL}/friends",
                params={"userId": user2["id"]}
            )
            
            if response.status_code == 200:
                data = response.json()
                pending_requests = data.get("pendingRequests", [])
                
                if any(req["id"] == user1["id"] for req in pending_requests):
                    self.log_test("Friend Request Flow - Verify Pending", True, f"{user2['username']} has pending request from {user1['username']}")
                else:
                    self.log_test("Friend Request Flow - Verify Pending", False, f"No pending request found. Requests: {pending_requests}")
                    return
            else:
                self.log_test("Friend Request Flow - Verify Pending", False, f"Status: {response.status_code}")
                return
                
        except Exception as e:
            self.log_test("Friend Request Flow - Verify Pending", False, f"Error: {str(e)}")
            return
            
        # User2 accepts the request
        try:
            response = requests.post(
                f"{BASE_URL}/friends/accept",
                headers=HEADERS,
                json={
                    "userId": user2["id"],
                    "friendId": user1["id"]
                }
            )
            
            if response.status_code == 200:
                self.log_test("Friend Request Flow - Accept Request", True, f"{user2['username']} accepted {user1['username']}'s request")
            else:
                self.log_test("Friend Request Flow - Accept Request", False, f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_test("Friend Request Flow - Accept Request", False, f"Error: {str(e)}")
            return
            
        # Verify both users are now friends
        try:
            # Check User1's friends list
            response1 = requests.get(f"{BASE_URL}/friends", params={"userId": user1["id"]})
            response2 = requests.get(f"{BASE_URL}/friends", params={"userId": user2["id"]})
            
            if response1.status_code == 200 and response2.status_code == 200:
                data1 = response1.json()
                data2 = response2.json()
                
                friends1 = data1.get("friends", [])
                friends2 = data2.get("friends", [])
                
                user1_has_user2 = any(friend["id"] == user2["id"] for friend in friends1)
                user2_has_user1 = any(friend["id"] == user1["id"] for friend in friends2)
                
                if user1_has_user2 and user2_has_user1:
                    self.log_test("Friend Request Flow - Verify Friendship", True, "Both users are now friends")
                else:
                    self.log_test("Friend Request Flow - Verify Friendship", False, f"User1 friends: {friends1}, User2 friends: {friends2}")
            else:
                self.log_test("Friend Request Flow - Verify Friendship", False, f"Failed to get friends lists")
                
        except Exception as e:
            self.log_test("Friend Request Flow - Verify Friendship", False, f"Error: {str(e)}")
            
    def test_friend_request_decline(self):
        """Test 2: Friend request decline flow"""
        print("\n=== TEST 2: Friend Request Decline ===")
        
        # Create two test users
        user1 = self.create_test_user()
        user2 = self.create_test_user()
        
        if not user1 or not user2:
            self.log_test("Friend Request Decline - User Creation", False, "Failed to create test users")
            return
            
        # User1 sends friend request to User2
        try:
            response = requests.post(
                f"{BASE_URL}/friends/send-request",
                headers=HEADERS,
                json={
                    "userId": user1["id"],
                    "targetUsername": user2["username"]
                }
            )
            
            if response.status_code != 200:
                self.log_test("Friend Request Decline - Send Request", False, f"Status: {response.status_code}")
                return
                
        except Exception as e:
            self.log_test("Friend Request Decline - Send Request", False, f"Error: {str(e)}")
            return
            
        # User2 declines the request
        try:
            response = requests.post(
                f"{BASE_URL}/friends/decline",
                headers=HEADERS,
                json={
                    "userId": user2["id"],
                    "friendId": user1["id"]
                }
            )
            
            if response.status_code == 200:
                self.log_test("Friend Request Decline - Decline Request", True, f"{user2['username']} declined {user1['username']}'s request")
            else:
                self.log_test("Friend Request Decline - Decline Request", False, f"Status: {response.status_code}")
                return
                
        except Exception as e:
            self.log_test("Friend Request Decline - Decline Request", False, f"Error: {str(e)}")
            return
            
        # Verify request is removed from both users
        try:
            response1 = requests.get(f"{BASE_URL}/friends", params={"userId": user1["id"]})
            response2 = requests.get(f"{BASE_URL}/friends", params={"userId": user2["id"]})
            
            if response1.status_code == 200 and response2.status_code == 200:
                data1 = response1.json()
                data2 = response2.json()
                
                sent_requests = data1.get("sentRequests", [])
                pending_requests = data2.get("pendingRequests", [])
                
                user1_has_sent = any(req["id"] == user2["id"] for req in sent_requests)
                user2_has_pending = any(req["id"] == user1["id"] for req in pending_requests)
                
                if not user1_has_sent and not user2_has_pending:
                    self.log_test("Friend Request Decline - Verify Removal", True, "Request removed from both users")
                else:
                    self.log_test("Friend Request Decline - Verify Removal", False, f"Sent: {sent_requests}, Pending: {pending_requests}")
            else:
                self.log_test("Friend Request Decline - Verify Removal", False, "Failed to get friends data")
                
        except Exception as e:
            self.log_test("Friend Request Decline - Verify Removal", False, f"Error: {str(e)}")
            
    def test_trading_flow(self):
        """Test 3: Complete trading flow"""
        print("\n=== TEST 3: Trading Flow ===")
        
        # Create two users and make them friends
        user1 = self.create_test_user()
        user2 = self.create_test_user()
        
        if not user1 or not user2:
            self.log_test("Trading Flow - User Creation", False, "Failed to create test users")
            return
            
        # Make them friends first
        try:
            # Send friend request
            requests.post(
                f"{BASE_URL}/friends/send-request",
                headers=HEADERS,
                json={"userId": user1["id"], "targetUsername": user2["username"]}
            )
            
            # Accept friend request
            requests.post(
                f"{BASE_URL}/friends/accept",
                headers=HEADERS,
                json={"userId": user2["id"], "friendId": user1["id"]}
            )
            
            self.log_test("Trading Flow - Setup Friendship", True, "Users are now friends")
            
        except Exception as e:
            self.log_test("Trading Flow - Setup Friendship", False, f"Error: {str(e)}")
            return
            
        # Give both users some cards
        if not self.give_user_cards(user1, 2) or not self.give_user_cards(user2, 2):
            self.log_test("Trading Flow - Give Cards", False, "Failed to give users cards")
            return
            
        self.log_test("Trading Flow - Give Cards", True, "Both users have cards")
        
        # Get their collections
        user1_collection = self.get_user_collection(user1)
        user2_collection = self.get_user_collection(user2)
        
        if len(user1_collection) < 3 or len(user2_collection) < 2:
            self.log_test("Trading Flow - Verify Collections", False, f"User1: {len(user1_collection)} cards, User2: {len(user2_collection)} cards")
            return
            
        self.log_test("Trading Flow - Verify Collections", True, f"User1: {len(user1_collection)} cards, User2: {len(user2_collection)} cards")
        
        # User1 sends trade with 3 cards to User2
        offered_cards = user1_collection[:3]  # First 3 cards
        
        try:
            response = requests.post(
                f"{BASE_URL}/trades/send",
                headers=HEADERS,
                json={
                    "userId": user1["id"],
                    "friendId": user2["id"],
                    "offeredCards": offered_cards
                }
            )
            
            if response.status_code == 200:
                self.log_test("Trading Flow - Send Trade", True, f"{user1['username']} sent trade with {len(offered_cards)} cards")
            else:
                self.log_test("Trading Flow - Send Trade", False, f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_test("Trading Flow - Send Trade", False, f"Error: {str(e)}")
            return
            
        # Verify User2 receives the trade request
        try:
            response = requests.get(f"{BASE_URL}/friends", params={"userId": user2["id"]})
            
            if response.status_code == 200:
                data = response.json()
                trade_requests = data.get("tradeRequests", [])
                
                if len(trade_requests) > 0 and trade_requests[0]["from"] == user1["id"]:
                    trade_id = trade_requests[0]["id"]
                    self.log_test("Trading Flow - Verify Trade Request", True, f"{user2['username']} received trade request")
                else:
                    self.log_test("Trading Flow - Verify Trade Request", False, f"No trade request found. Requests: {trade_requests}")
                    return
            else:
                self.log_test("Trading Flow - Verify Trade Request", False, f"Status: {response.status_code}")
                return
                
        except Exception as e:
            self.log_test("Trading Flow - Verify Trade Request", False, f"Error: {str(e)}")
            return
            
        # User2 accepts trade with 2 cards
        requested_cards = user2_collection[:2]  # First 2 cards
        
        try:
            response = requests.post(
                f"{BASE_URL}/trades/accept",
                headers=HEADERS,
                json={
                    "userId": user2["id"],
                    "tradeId": trade_id,
                    "requestedCards": requested_cards
                }
            )
            
            if response.status_code == 200:
                self.log_test("Trading Flow - Accept Trade", True, f"{user2['username']} accepted trade with {len(requested_cards)} cards")
            else:
                self.log_test("Trading Flow - Accept Trade", False, f"Status: {response.status_code}, Response: {response.text}")
                return
                
        except Exception as e:
            self.log_test("Trading Flow - Accept Trade", False, f"Error: {str(e)}")
            return
            
        # Verify cards have swapped
        try:
            new_user1_collection = self.get_user_collection(user1)
            new_user2_collection = self.get_user_collection(user2)
            
            # User1 should have lost 3 cards and gained 2 cards
            user1_change = len(new_user1_collection) - len(user1_collection)
            # User2 should have lost 2 cards and gained 3 cards  
            user2_change = len(new_user2_collection) - len(user2_collection)
            
            if user1_change == -1 and user2_change == 1:  # Net change: User1 -1, User2 +1
                self.log_test("Trading Flow - Verify Card Swap", True, f"Cards swapped correctly. User1: {user1_change}, User2: {user2_change}")
            else:
                self.log_test("Trading Flow - Verify Card Swap", False, f"Unexpected card counts. User1 change: {user1_change}, User2 change: {user2_change}")
                
        except Exception as e:
            self.log_test("Trading Flow - Verify Card Swap", False, f"Error: {str(e)}")
            
    def test_trading_validation(self):
        """Test 4: Trading validation rules"""
        print("\n=== TEST 4: Trading Validation ===")
        
        # Create users - one pair as friends, one non-friend
        user1 = self.create_test_user()
        user2 = self.create_test_user()
        user3 = self.create_test_user()  # Non-friend
        
        if not user1 or not user2 or not user3:
            self.log_test("Trading Validation - User Creation", False, "Failed to create test users")
            return
            
        # Make user1 and user2 friends
        try:
            requests.post(f"{BASE_URL}/friends/send-request", headers=HEADERS, 
                         json={"userId": user1["id"], "targetUsername": user2["username"]})
            requests.post(f"{BASE_URL}/friends/accept", headers=HEADERS,
                         json={"userId": user2["id"], "friendId": user1["id"]})
        except:
            pass
            
        # Give user1 some cards
        self.give_user_cards(user1, 2)
        user1_collection = self.get_user_collection(user1)
        
        if len(user1_collection) < 11:
            self.log_test("Trading Validation - Setup Cards", False, f"User1 only has {len(user1_collection)} cards, need 11+")
            return
            
        # Test 1: Try to trade with non-friend (should fail)
        try:
            response = requests.post(
                f"{BASE_URL}/trades/send",
                headers=HEADERS,
                json={
                    "userId": user1["id"],
                    "friendId": user3["id"],
                    "offeredCards": user1_collection[:1]
                }
            )
            
            if response.status_code == 403:
                self.log_test("Trading Validation - Non-Friend Trade", True, "Correctly rejected trade with non-friend")
            else:
                self.log_test("Trading Validation - Non-Friend Trade", False, f"Expected 403, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Trading Validation - Non-Friend Trade", False, f"Error: {str(e)}")
            
        # Test 2: Try to trade 0 cards (should fail)
        try:
            response = requests.post(
                f"{BASE_URL}/trades/send",
                headers=HEADERS,
                json={
                    "userId": user1["id"],
                    "friendId": user2["id"],
                    "offeredCards": []
                }
            )
            
            if response.status_code == 400:
                self.log_test("Trading Validation - Zero Cards", True, "Correctly rejected trade with 0 cards")
            else:
                self.log_test("Trading Validation - Zero Cards", False, f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Trading Validation - Zero Cards", False, f"Error: {str(e)}")
            
        # Test 3: Try to trade 11 cards (should fail)
        if len(user1_collection) >= 11:
            try:
                response = requests.post(
                    f"{BASE_URL}/trades/send",
                    headers=HEADERS,
                    json={
                        "userId": user1["id"],
                        "friendId": user2["id"],
                        "offeredCards": user1_collection[:11]
                    }
                )
                
                if response.status_code == 400:
                    self.log_test("Trading Validation - Too Many Cards", True, "Correctly rejected trade with 11 cards")
                else:
                    self.log_test("Trading Validation - Too Many Cards", False, f"Expected 400, got {response.status_code}")
                    
            except Exception as e:
                self.log_test("Trading Validation - Too Many Cards", False, f"Error: {str(e)}")
        else:
            self.log_test("Trading Validation - Too Many Cards", False, f"Not enough cards to test (have {len(user1_collection)})")
            
    def test_admin_users_list(self):
        """Test 5: Admin users list endpoint"""
        print("\n=== TEST 5: Admin Users List ===")
        
        try:
            # Test without admin authentication (should work for this endpoint)
            response = requests.get(f"{BASE_URL}/admin/users")
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                
                if len(users) > 0:
                    # Check if users have required fields
                    first_user = users[0]
                    required_fields = ["id", "username", "points", "createdAt"]
                    
                    has_all_fields = all(field in first_user for field in required_fields)
                    
                    if has_all_fields:
                        self.log_test("Admin Users List - Endpoint", True, f"Retrieved {len(users)} users with all required fields")
                    else:
                        self.log_test("Admin Users List - Endpoint", False, f"Missing fields in user data: {first_user}")
                else:
                    self.log_test("Admin Users List - Endpoint", True, "Endpoint works but no users found")
            else:
                self.log_test("Admin Users List - Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Admin Users List - Endpoint", False, f"Error: {str(e)}")
            
    def run_all_tests(self):
        """Run all Friends & Trading system tests"""
        print("🎯 STARTING FRIENDS & TRADING SYSTEM TESTING")
        print("=" * 60)
        
        start_time = time.time()
        
        # Run all tests
        self.test_friend_request_flow()
        self.test_friend_request_decline()
        self.test_trading_flow()
        self.test_trading_validation()
        self.test_admin_users_list()
        
        # Summary
        end_time = time.time()
        duration = end_time - start_time
        
        passed_tests = sum(1 for result in self.test_results if result["passed"])
        total_tests = len(self.test_results)
        
        print("\n" + "=" * 60)
        print("🎯 FRIENDS & TRADING SYSTEM TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED! Friends & Trading system is working correctly.")
        else:
            print(f"\n⚠️  {total_tests - passed_tests} test(s) failed. Review the details above.")
            
        # Print failed tests
        failed_tests = [result for result in self.test_results if not result["passed"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
                
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = FriendsAndTradingTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)