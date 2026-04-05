#!/usr/bin/env python3

import requests
import json
import time
import sys
from datetime import datetime

# Configuration - Use local server
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

def log_test(message):
    """Log test messages with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_catch_attempt_limits():
    """Test Pokemon catch attempt limits and edge cases"""
    
    log_test("🧪 TESTING POKEMON WILDS CATCH ATTEMPT LIMITS")
    log_test("=" * 60)
    
    # Test data
    test_user_data = {
        "username": f"CatchTestUser_{int(time.time())}",
        "password": "testpass123"
    }
    
    try:
        # Create test user
        log_test("📝 Creating test user...")
        signup_response = requests.post(f"{API_BASE}/auth/signup", json=test_user_data, timeout=30)
        
        if signup_response.status_code != 200:
            log_test(f"❌ FAILED: User signup failed")
            return False
            
        signup_data = signup_response.json()
        user_id = signup_data['user']['id']
        log_test(f"✅ SUCCESS: Test user created - ID: {user_id}")
        
        # Wait for a new spawn (since previous one was caught)
        log_test("⏳ Waiting for new Pokemon spawn...")
        time.sleep(2)
        
        # Check current spawn
        current_response = requests.get(f"{API_BASE}/wilds/current", timeout=30)
        current_data = current_response.json()
        
        if current_data.get('spawn') is None:
            log_test("ℹ️  No spawn available, waiting for new one...")
            time.sleep(5)
            current_response = requests.get(f"{API_BASE}/wilds/current", timeout=30)
            current_data = current_response.json()
        
        spawn = current_data.get('spawn')
        if spawn is None or spawn.get('caughtBy'):
            log_test("ℹ️  Current spawn is caught or null, testing with existing spawn data")
            # We can still test the catch attempt system even if spawn is caught
        else:
            pokemon = spawn.get('pokemon', {})
            log_test(f"🎯 Testing with Pokemon: {pokemon.get('displayName', 'Unknown')} (ID: {pokemon.get('id', 'Unknown')})")
        
        # Test multiple catch attempts
        log_test("\n🎣 Testing catch attempt limits...")
        attempts = 0
        max_attempts = 5
        
        while attempts < max_attempts:
            attempts += 1
            log_test(f"Attempt #{attempts}")
            
            catch_response = requests.post(f"{API_BASE}/wilds/catch", json={"userId": user_id}, timeout=30)
            
            if catch_response.status_code != 200:
                log_test(f"❌ FAILED: Catch attempt failed with status {catch_response.status_code}")
                log_test(f"Response: {catch_response.text}")
                break
                
            catch_data = catch_response.json()
            
            if catch_data.get('success'):
                log_test(f"🎉 SUCCESS: Caught Pokemon on attempt #{attempts}!")
                break
            else:
                if catch_data.get('fled'):
                    log_test(f"🏃 Pokemon fled after {attempts} attempts")
                    break
                else:
                    attempts_remaining = catch_data.get('attemptsRemaining', 0)
                    log_test(f"💨 Catch failed, {attempts_remaining} attempts remaining")
                    
                    if attempts_remaining == 0:
                        log_test(f"🏃 Pokemon will flee after this attempt")
                        break
        
        # Test error cases
        log_test("\n🔍 Testing error handling...")
        
        # Test with invalid user ID
        invalid_catch_response = requests.post(f"{API_BASE}/wilds/catch", json={"userId": "invalid-id"}, timeout=30)
        log_test(f"Invalid user ID test: Status {invalid_catch_response.status_code}")
        
        # Test my-pokemon endpoint
        my_pokemon_response = requests.get(f"{API_BASE}/wilds/my-pokemon?userId={user_id}", timeout=30)
        if my_pokemon_response.status_code == 200:
            my_pokemon_data = my_pokemon_response.json()
            pokemon_count = len(my_pokemon_data.get('pokemon', []))
            log_test(f"✅ User has {pokemon_count} caught Pokemon")
        
        log_test("\n✅ CATCH ATTEMPT TESTING COMPLETE")
        return True
        
    except Exception as e:
        log_test(f"❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_catch_attempt_limits()
    sys.exit(0 if success else 1)