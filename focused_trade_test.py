#!/usr/bin/env python3
"""
Focused Pokemon Trade System Testing
Tests specific aspects of the trade system including completion counters and decline functionality.
"""

import requests
import json
import random
import string

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_random_username():
    """Generate a random username for testing"""
    return f"testuser_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"

def test_trade_completion_counter():
    """Test that trade completion counters are properly incremented"""
    print("🧪 TESTING TRADE COMPLETION COUNTER")
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
        
        # Get initial trade count for Spheal
        initial_session = requests.get(f"{API_BASE}/session?userId={spheal_id}")
        if initial_session.status_code == 200:
            initial_trades = initial_session.json()['user'].get('tradesCompleted', 0)
            print(f"✅ Spheal's initial trade count: {initial_trades}")
        else:
            print("❌ Failed to get initial session data")
            return False
        
        # Create test user
        test_username = generate_random_username()
        signup_response = requests.post(f"{API_BASE}/auth/signup", json={
            "username": test_username,
            "password": "testpass123"
        })
        
        if signup_response.status_code not in [200, 201]:
            print(f"❌ Failed to create test user: {signup_response.status_code}")
            return False
            
        test_user_data = signup_response.json()
        test_user_id = test_user_data['user']['id']
        
        # Make them friends
        friend_request = requests.post(f"{API_BASE}/friends/send-request", json={
            "userId": spheal_id,
            "targetUsername": test_username
        })
        
        accept_friend = requests.post(f"{API_BASE}/friends/accept", json={
            "userId": test_user_id,
            "friendId": spheal_id
        })
        
        # Ensure both have Pokemon
        spheal_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
        spheal_pokemon_list = spheal_pokemon.json().get('pokemon', [])
        
        # Spawn Pokemon for test user
        spawn_response = requests.post(f"{API_BASE}/wilds/admin-spawn", json={
            "adminId": spheal_id,
            "pokemonId": random.randint(1, 150)
        })
        
        catch_response = requests.post(f"{API_BASE}/wilds/catch", json={
            "userId": test_user_id
        })
        
        # Get test user's Pokemon
        test_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user_id}")
        test_pokemon_list = test_pokemon.json().get('pokemon', [])
        
        if len(spheal_pokemon_list) == 0 or len(test_pokemon_list) == 0:
            print("❌ Insufficient Pokemon for trade test")
            return False
        
        # Send trade request
        trade_request = requests.post(f"{API_BASE}/friends/trade", json={
            "fromId": spheal_id,
            "toId": test_user_id,
            "offeredPokemon": [{
                "pokemonId": spheal_pokemon_list[0]['_id'],
                "pokemonData": spheal_pokemon_list[0]
            }],
            "requestedPokemon": [{
                "pokemonId": test_pokemon_list[0]['_id'],
                "pokemonData": test_pokemon_list[0]
            }]
        })
        
        if trade_request.status_code != 200:
            print(f"❌ Failed to send trade request: {trade_request.status_code}")
            return False
        
        trade_data = trade_request.json()
        trade_id = trade_data['trade']['id']
        
        # Accept trade
        accept_trade = requests.post(f"{API_BASE}/friends/accept-pokemon-trade", json={
            "userId": test_user_id,
            "tradeId": trade_id
        })
        
        if accept_trade.status_code != 200:
            print(f"❌ Failed to accept trade: {accept_trade.status_code}")
            return False
        
        print("✅ Trade completed successfully")
        
        # Check final trade counts
        final_session_spheal = requests.get(f"{API_BASE}/session?userId={spheal_id}")
        final_session_test = requests.get(f"{API_BASE}/session?userId={test_user_id}")
        
        if final_session_spheal.status_code == 200 and final_session_test.status_code == 200:
            final_spheal_trades = final_session_spheal.json()['user'].get('tradesCompleted', 0)
            final_test_trades = final_session_test.json()['user'].get('tradesCompleted', 0)
            
            print(f"✅ Final trade counts:")
            print(f"   Spheal: {initial_trades} → {final_spheal_trades} (expected +1)")
            print(f"   Test user: 0 → {final_test_trades} (expected +1)")
            
            if final_spheal_trades == initial_trades + 1 and final_test_trades == 1:
                print("✅ Trade completion counters working correctly!")
                return True
            else:
                print("❌ Trade completion counters not incremented properly")
                return False
        else:
            print("❌ Failed to get final session data")
            return False
            
    except Exception as e:
        print(f"❌ Error in trade completion test: {str(e)}")
        return False

def test_trade_decline():
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
        
        # Create test user
        test_username = generate_random_username()
        signup_response = requests.post(f"{API_BASE}/auth/signup", json={
            "username": test_username,
            "password": "testpass123"
        })
        
        if signup_response.status_code not in [200, 201]:
            print(f"❌ Failed to create test user: {signup_response.status_code}")
            return False
            
        test_user_data = signup_response.json()
        test_user_id = test_user_data['user']['id']
        
        # Make them friends
        friend_request = requests.post(f"{API_BASE}/friends/send-request", json={
            "userId": spheal_id,
            "targetUsername": test_username
        })
        
        accept_friend = requests.post(f"{API_BASE}/friends/accept", json={
            "userId": test_user_id,
            "friendId": spheal_id
        })
        
        # Get Pokemon for both users
        spheal_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={spheal_id}")
        spheal_pokemon_list = spheal_pokemon.json().get('pokemon', [])
        
        # Spawn Pokemon for test user
        spawn_response = requests.post(f"{API_BASE}/wilds/admin-spawn", json={
            "adminId": spheal_id,
            "pokemonId": random.randint(1, 150)
        })
        
        catch_response = requests.post(f"{API_BASE}/wilds/catch", json={
            "userId": test_user_id
        })
        
        test_pokemon = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={test_user_id}")
        test_pokemon_list = test_pokemon.json().get('pokemon', [])
        
        if len(spheal_pokemon_list) == 0 or len(test_pokemon_list) == 0:
            print("❌ Insufficient Pokemon for decline test")
            return False
        
        # Send trade request
        trade_request = requests.post(f"{API_BASE}/friends/trade", json={
            "fromId": spheal_id,
            "toId": test_user_id,
            "offeredPokemon": [{
                "pokemonId": spheal_pokemon_list[0]['_id'],
                "pokemonData": spheal_pokemon_list[0]
            }],
            "requestedPokemon": [{
                "pokemonId": test_pokemon_list[0]['_id'],
                "pokemonData": test_pokemon_list[0]
            }]
        })
        
        if trade_request.status_code != 200:
            print(f"❌ Failed to send trade request: {trade_request.status_code}")
            return False
        
        trade_data = trade_request.json()
        trade_id = trade_data['trade']['id']
        print(f"✅ Trade request sent. Trade ID: {trade_id}")
        
        # Verify trade request exists
        friends_before = requests.get(f"{API_BASE}/friends?userId={test_user_id}")
        if friends_before.status_code == 200:
            trade_requests_before = friends_before.json().get('tradeRequests', [])
            print(f"✅ Test user has {len(trade_requests_before)} trade request(s) before decline")
        
        # Decline the trade
        decline_trade = requests.post(f"{API_BASE}/friends/decline-trade", json={
            "userId": test_user_id,
            "tradeId": trade_id
        })
        
        if decline_trade.status_code != 200:
            print(f"❌ Failed to decline trade: {decline_trade.status_code}")
            print(f"Response: {decline_trade.text}")
            return False
        
        print("✅ Trade declined successfully")
        
        # Verify trade request is removed
        friends_after = requests.get(f"{API_BASE}/friends?userId={test_user_id}")
        if friends_after.status_code == 200:
            trade_requests_after = friends_after.json().get('tradeRequests', [])
            print(f"✅ Test user has {len(trade_requests_after)} trade request(s) after decline")
            
            if len(trade_requests_after) == 0:
                print("✅ Trade request successfully removed after decline")
                return True
            else:
                print("❌ Trade request still exists after decline")
                return False
        else:
            print("❌ Failed to get friends data after decline")
            return False
            
    except Exception as e:
        print(f"❌ Error in decline test: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Focused Pokemon Trade System Tests")
    print(f"🌐 Testing against: {BASE_URL}")
    print("=" * 60)
    
    # Test trade completion counter
    counter_success = test_trade_completion_counter()
    
    # Test decline functionality
    decline_success = test_trade_decline()
    
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS:")
    print(f"   Trade Completion Counter: {'✅ PASSED' if counter_success else '❌ FAILED'}")
    print(f"   Trade Decline: {'✅ PASSED' if decline_success else '❌ FAILED'}")
    
    if counter_success and decline_success:
        print("\n🎉 ALL FOCUSED TRADE TESTS PASSED!")
    else:
        print("\n⚠️ SOME TESTS FAILED - CHECK LOGS ABOVE")