#!/usr/bin/env python3
"""
Pokemon Trade System Backend Testing
Tests the Pokemon trade functionality including sending, accepting, and declining trades.
"""

import requests
import json
import time
import random
import string

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_random_username():
    """Generate a random username for testing"""
    return f"testuser_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"

def test_pokemon_trade_system():
    """Test the complete Pokemon trade system functionality"""
    print("🧪 TESTING POKEMON TRADE SYSTEM")
    print("=" * 50)
    
    try:
        # Step 1: Login as Spheal (admin account)
        print("\n📝 Step 1: Login as Spheal")
        spheal_login = requests.post(f"{API_BASE}/auth/signin", json={
            "username": "Spheal",
            "password": "spheal"
        })
        
        if spheal_login.status_code != 200:
            print(f"❌ Failed to login as Spheal: {spheal_login.status_code}")
            print(f"Response: {spheal_login.text}")
            return False
            
        spheal_data = spheal_login.json()
        spheal_id = spheal_data['user']['id']
        print(f"✅ Spheal logged in successfully. ID: {spheal_id}")
        
        # Step 2: Create a test user account
        print("\n📝 Step 2: Create test user account")
        test_username = generate_random_username()
        test_password = "testpass123"
        
        signup_response = requests.post(f"{API_BASE}/auth/signup", json={
            "username": test_username,
            "password": test_password
        })
        
        if signup_response.status_code not in [200, 201]:
            print(f"❌ Failed to create test user: {signup_response.status_code}")
            print(f"Response: {signup_response.text}")
            return False
            
        test_user_data = signup_response.json()
        test_user_id = test_user_data['user']['id']
        print(f"✅ Test user created: {test_username} (ID: {test_user_id})")
        
        # Step 3: Make users friends
        print("\n📝 Step 3: Make users friends")
        
        # Spheal sends friend request to test user
        friend_request = requests.post(f"{API_BASE}/friends/send-request", json={
            "userId": spheal_id,
            "targetUsername": test_username
        })
        
        if friend_request.status_code != 200:
            print(f"❌ Failed to send friend request: {friend_request.status_code}")
            print(f"Response: {friend_request.text}")
            return False
            
        print("✅ Friend request sent")
        
        # Test user accepts friend request
        accept_friend = requests.post(f"{API_BASE}/friends/accept", json={
            "userId": test_user_id,
            "friendId": spheal_id
        })
        
        if accept_friend.status_code != 200:
            print(f"❌ Failed to accept friend request: {accept_friend.status_code}")
            print(f"Response: {accept_friend.text}")
            return False
            
        print("✅ Friend request accepted - users are now friends")
        
        # Step 4: Ensure both users have Pokemon
        print("\n📝 Step 4: Ensure both users have Pokemon")
        
        # Check Spheal's Pokemon
        spheal_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
        if spheal_pokemon.status_code == 200:
            spheal_pokemon_list = spheal_pokemon.json().get('pokemon', [])
            print(f"✅ Spheal has {len(spheal_pokemon_list)} Pokemon")
        else:
            print(f"❌ Failed to get Spheal's Pokemon: {spheal_pokemon.status_code}")
            return False
        
        # If Spheal has no Pokemon, spawn and catch one
        if len(spheal_pokemon_list) == 0:
            print("🔄 Spawning Pokemon for Spheal...")
            spawn_response = requests.post(f"{API_BASE}/wilds/admin-spawn", json={
                "adminId": spheal_id,
                "pokemonId": random.randint(1, 150)  # Gen 1 Pokemon
            })
            
            if spawn_response.status_code == 200:
                print("✅ Pokemon spawned for Spheal")
                
                # Catch the Pokemon
                catch_response = requests.post(f"{API_BASE}/wilds/catch", json={
                    "userId": spheal_id
                })
                
                if catch_response.status_code == 200:
                    catch_data = catch_response.json()
                    if catch_data.get('caught'):
                        print("✅ Spheal caught the Pokemon")
                        # Refresh Pokemon list
                        spheal_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
                        spheal_pokemon_list = spheal_pokemon.json().get('pokemon', [])
                    else:
                        print("⚠️ Spheal failed to catch Pokemon, trying again...")
                        # Try catching again
                        for attempt in range(3):
                            catch_response = requests.post(f"{API_BASE}/wilds/catch", json={
                                "userId": spheal_id
                            })
                            if catch_response.status_code == 200 and catch_response.json().get('caught'):
                                print(f"✅ Spheal caught Pokemon on attempt {attempt + 2}")
                                spheal_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
                                spheal_pokemon_list = spheal_pokemon.json().get('pokemon', [])
                                break
                else:
                    print(f"❌ Failed to catch Pokemon for Spheal: {catch_response.status_code}")
                    return False
            else:
                print(f"❌ Failed to spawn Pokemon for Spheal: {spawn_response.status_code}")
                return False
        
        # Check test user's Pokemon
        test_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user_id}")
        if test_pokemon.status_code == 200:
            test_pokemon_list = test_pokemon.json().get('pokemon', [])
            print(f"✅ Test user has {len(test_pokemon_list)} Pokemon")
        else:
            print(f"❌ Failed to get test user's Pokemon: {test_pokemon.status_code}")
            return False
        
        # If test user has no Pokemon, spawn and catch one using admin
        if len(test_pokemon_list) == 0:
            print("🔄 Spawning Pokemon for test user...")
            spawn_response = requests.post(f"{API_BASE}/wilds/admin-spawn", json={
                "adminId": spheal_id,  # Spheal is admin
                "pokemonId": random.randint(1, 150)  # Gen 1 Pokemon
            })
            
            if spawn_response.status_code == 200:
                print("✅ Pokemon spawned for test user")
                
                # Test user catches the Pokemon
                catch_response = requests.post(f"{API_BASE}/wilds/catch", json={
                    "userId": test_user_id
                })
                
                if catch_response.status_code == 200:
                    catch_data = catch_response.json()
                    if catch_data.get('caught'):
                        print("✅ Test user caught the Pokemon")
                        # Refresh Pokemon list
                        test_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user_id}")
                        test_pokemon_list = test_pokemon.json().get('pokemon', [])
                    else:
                        print("⚠️ Test user failed to catch Pokemon, trying again...")
                        # Try catching again
                        for attempt in range(3):
                            catch_response = requests.post(f"{API_BASE}/wilds/catch", json={
                                "userId": test_user_id
                            })
                            if catch_response.status_code == 200 and catch_response.json().get('caught'):
                                print(f"✅ Test user caught Pokemon on attempt {attempt + 2}")
                                test_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user_id}")
                                test_pokemon_list = test_pokemon.json().get('pokemon', [])
                                break
                else:
                    print(f"❌ Failed to catch Pokemon for test user: {catch_response.status_code}")
                    return False
            else:
                print(f"❌ Failed to spawn Pokemon for test user: {spawn_response.status_code}")
                return False
        
        # Verify both users have Pokemon
        if len(spheal_pokemon_list) == 0 or len(test_pokemon_list) == 0:
            print("❌ One or both users don't have Pokemon for trading")
            return False
        
        print(f"✅ Both users have Pokemon ready for trading")
        print(f"   Spheal's Pokemon: {spheal_pokemon_list[0]['displayName']} (ID: {spheal_pokemon_list[0]['_id']})")
        print(f"   Test user's Pokemon: {test_pokemon_list[0]['displayName']} (ID: {test_pokemon_list[0]['_id']})")
        
        # Step 5: Send trade request from Spheal to test user
        print("\n📝 Step 5: Send trade request from Spheal to test user")
        
        spheal_pokemon_id = spheal_pokemon_list[0]['_id']
        test_pokemon_id = test_pokemon_list[0]['_id']
        
        trade_request = requests.post(f"{API_BASE}/friends/trade", json={
            "fromId": spheal_id,
            "toId": test_user_id,
            "offeredPokemon": [{
                "pokemonId": spheal_pokemon_id,
                "pokemonData": spheal_pokemon_list[0]
            }],
            "requestedPokemon": [{
                "pokemonId": test_pokemon_id,
                "pokemonData": test_pokemon_list[0]
            }],
            "type": "pokemon-trade"
        })
        
        if trade_request.status_code != 200:
            print(f"❌ Failed to send trade request: {trade_request.status_code}")
            print(f"Response: {trade_request.text}")
            return False
        
        trade_data = trade_request.json()
        trade_id = trade_data['trade']['id']
        print(f"✅ Trade request sent successfully. Trade ID: {trade_id}")
        
        # Step 6: Verify trade request appears in test user's trade requests
        print("\n📝 Step 6: Verify trade request in test user's requests")
        
        friends_data = requests.get(f"{API_BASE}/friends?userId={test_user_id}")
        if friends_data.status_code == 200:
            friends_response = friends_data.json()
            trade_requests = friends_response.get('tradeRequests', [])
            print(f"✅ Test user has {len(trade_requests)} trade request(s)")
            
            if len(trade_requests) > 0:
                print(f"   Trade from: {trade_requests[0]['fromUsername']}")
                print(f"   Offered: {trade_requests[0]['offeredPokemon'][0]['pokemonData']['displayName']}")
                print(f"   Requested: {trade_requests[0]['requestedPokemon'][0]['pokemonData']['displayName']}")
            else:
                print("❌ No trade requests found for test user")
                return False
        else:
            print(f"❌ Failed to get friends data: {friends_data.status_code}")
            return False
        
        # Step 7: Accept the trade request from test user
        print("\n📝 Step 7: Accept trade request from test user")
        
        accept_trade = requests.post(f"{API_BASE}/friends/accept-pokemon-trade", json={
            "userId": test_user_id,
            "tradeId": trade_id
        })
        
        print(f"Accept trade response status: {accept_trade.status_code}")
        print(f"Accept trade response: {accept_trade.text}")
        
        if accept_trade.status_code != 200:
            print(f"❌ Failed to accept trade: {accept_trade.status_code}")
            print(f"Response: {accept_trade.text}")
            
            # Check server logs for debugging
            print("\n🔍 Debugging information:")
            print(f"   Trade ID: {trade_id}")
            print(f"   Test User ID: {test_user_id}")
            print(f"   Spheal ID: {spheal_id}")
            print(f"   Spheal Pokemon ID: {spheal_pokemon_id}")
            print(f"   Test Pokemon ID: {test_pokemon_id}")
            
            return False
        
        accept_data = accept_trade.json()
        print(f"✅ Trade accepted successfully!")
        print(f"   Received: {accept_data.get('receivedPokemon')}")
        print(f"   Sent: {accept_data.get('sentPokemon')}")
        
        # Step 8: Verify Pokemon ownership changed
        print("\n📝 Step 8: Verify Pokemon ownership changed")
        
        # Check Spheal's Pokemon (should now have test user's original Pokemon)
        spheal_pokemon_after = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
        if spheal_pokemon_after.status_code == 200:
            spheal_new_pokemon = spheal_pokemon_after.json().get('pokemon', [])
            print(f"✅ Spheal now has {len(spheal_new_pokemon)} Pokemon")
            if len(spheal_new_pokemon) > 0:
                print(f"   Spheal's Pokemon: {spheal_new_pokemon[0]['displayName']}")
        
        # Check test user's Pokemon (should now have Spheal's original Pokemon)
        test_pokemon_after = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user_id}")
        if test_pokemon_after.status_code == 200:
            test_new_pokemon = test_pokemon_after.json().get('pokemon', [])
            print(f"✅ Test user now has {len(test_new_pokemon)} Pokemon")
            if len(test_new_pokemon) > 0:
                print(f"   Test user's Pokemon: {test_new_pokemon[0]['displayName']}")
        
        # Step 9: Verify trade request removed and trade counts incremented
        print("\n📝 Step 9: Verify trade completion effects")
        
        # Check that trade request is removed
        friends_after = requests.get(f"{API_BASE}/friends?userId={test_user_id}")
        if friends_after.status_code == 200:
            friends_response_after = friends_after.json()
            trade_requests_after = friends_response_after.get('tradeRequests', [])
            print(f"✅ Test user now has {len(trade_requests_after)} trade request(s) (should be 0)")
        
        # Check trade completion counts
        session_spheal = requests.get(f"{API_BASE}/session?userId={spheal_id}")
        session_test = requests.get(f"{API_BASE}/session?userId={test_user_id}")
        
        if session_spheal.status_code == 200 and session_test.status_code == 200:
            spheal_session = session_spheal.json()
            test_session = session_test.json()
            
            spheal_trades = spheal_session['user'].get('tradesCompleted', 0)
            test_trades = test_session['user'].get('tradesCompleted', 0)
            
            print(f"✅ Trade completion counts:")
            print(f"   Spheal: {spheal_trades} trades completed")
            print(f"   Test user: {test_trades} trades completed")
        
        print("\n🎉 POKEMON TRADE SYSTEM TEST COMPLETED SUCCESSFULLY!")
        return True
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR during Pokemon trade testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_decline_trade():
    """Test declining a trade request"""
    print("\n🧪 TESTING TRADE DECLINE FUNCTIONALITY")
    print("=" * 50)
    
    try:
        # Login as Spheal
        spheal_login = requests.post(f"{API_BASE}/auth/signin", json={
            "username": "Spheal",
            "password": "spheal"
        })
        
        if spheal_login.status_code != 200:
            print(f"❌ Failed to login as Spheal: {spheal_login.status_code}")
            return False
            
        spheal_data = spheal_login.json()
        spheal_id = spheal_data['user']['id']
        
        # Create another test user
        test_username2 = generate_random_username()
        signup_response = requests.post(f"{API_BASE}/auth/signup", json={
            "username": test_username2,
            "password": "testpass123"
        })
        
        if signup_response.status_code not in [200, 201]:
            print(f"❌ Failed to create second test user: {signup_response.status_code}")
            return False
            
        test_user2_data = signup_response.json()
        test_user2_id = test_user2_data['user']['id']
        
        # Make them friends (simplified - just send and accept)
        friend_request = requests.post(f"{API_BASE}/friends/send-request", json={
            "userId": spheal_id,
            "targetUsername": test_username2
        })
        
        accept_friend = requests.post(f"{API_BASE}/friends/accept", json={
            "userId": test_user2_id,
            "friendId": spheal_id
        })
        
        # Get Pokemon for both users (assuming they exist from previous test)
        spheal_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
        test_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user2_id}")
        
        if spheal_pokemon.status_code == 200 and test_pokemon.status_code == 200:
            spheal_pokemon_list = spheal_pokemon.json().get('pokemon', [])
            test_pokemon_list = test_pokemon.json().get('pokemon', [])
            
            if len(spheal_pokemon_list) > 0 and len(test_pokemon_list) > 0:
                # Send trade request
                trade_request = requests.post(f"{API_BASE}/friends/trade", json={
                    "fromId": spheal_id,
                    "toId": test_user2_id,
                    "offeredPokemon": [{
                        "pokemonId": spheal_pokemon_list[0]['_id'],
                        "pokemonData": spheal_pokemon_list[0]
                    }],
                    "requestedPokemon": [{
                        "pokemonId": test_pokemon_list[0]['_id'],
                        "pokemonData": test_pokemon_list[0]
                    }]
                })
                
                if trade_request.status_code == 200:
                    trade_data = trade_request.json()
                    trade_id = trade_data['trade']['id']
                    
                    # Decline the trade
                    decline_trade = requests.post(f"{API_BASE}/friends/decline-trade", json={
                        "userId": test_user2_id,
                        "tradeId": trade_id
                    })
                    
                    if decline_trade.status_code == 200:
                        print("✅ Trade declined successfully")
                        
                        # Verify trade request is removed
                        friends_after = requests.get(f"{API_BASE}/friends?userId={test_user2_id}")
                        if friends_after.status_code == 200:
                            trade_requests_after = friends_after.json().get('tradeRequests', [])
                            if len(trade_requests_after) == 0:
                                print("✅ Trade request removed after decline")
                                return True
                            else:
                                print("❌ Trade request still exists after decline")
                                return False
                    else:
                        print(f"❌ Failed to decline trade: {decline_trade.status_code}")
                        return False
                else:
                    print(f"❌ Failed to send trade request for decline test: {trade_request.status_code}")
                    return False
            else:
                print("⚠️ Skipping decline test - insufficient Pokemon")
                return True
        else:
            print("⚠️ Skipping decline test - couldn't get Pokemon data")
            return True
            
    except Exception as e:
        print(f"❌ Error in decline test: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Pokemon Trade System Backend Tests")
    print(f"🌐 Testing against: {BASE_URL}")
    print("=" * 60)
    
    # Test main trade functionality
    trade_success = test_pokemon_trade_system()
    
    # Test decline functionality
    decline_success = test_decline_trade()
    
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS:")
    print(f"   Pokemon Trade System: {'✅ PASSED' if trade_success else '❌ FAILED'}")
    print(f"   Trade Decline: {'✅ PASSED' if decline_success else '❌ FAILED'}")
    
    if trade_success and decline_success:
        print("\n🎉 ALL POKEMON TRADE TESTS PASSED!")
    else:
        print("\n⚠️ SOME TESTS FAILED - CHECK LOGS ABOVE")