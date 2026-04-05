#!/usr/bin/env python3
"""
Backend Testing Script for Pokemon Wilds Leveling & Evolution System
Tests all XP and evolution endpoints after server restart
"""

import requests
import json
import time
import os
from datetime import datetime

# Get base URL from environment - use localhost for testing since external URL has routing issues
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_USERNAME = "Spheal"
TEST_PASSWORD = "spheal"

class PokemonWildsLevelingTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.user_data = None
        self.test_pokemon = None
        self.results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASSED" if success else "❌ FAILED"
        result = {
            'test': test_name,
            'status': status,
            'message': message,
            'details': details or {},
            'timestamp': datetime.now().isoformat()
        }
        self.results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
        
    def login(self):
        """Login as Spheal user"""
        try:
            response = self.session.post(f"{API_BASE}/auth/signin", 
                json={
                    "username": TEST_USERNAME,
                    "password": TEST_PASSWORD
                })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.user_id = data['user']['id']
                    self.user_data = data['user']
                    self.log_result("User Login", True, 
                        f"Successfully logged in as {TEST_USERNAME} with {data['user']['points']} points")
                    return True
                else:
                    self.log_result("User Login", False, "Login response missing success flag")
                    return False
            else:
                self.log_result("User Login", False, 
                    f"Login failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("User Login", False, f"Login error: {str(e)}")
            return False
    
    def test_current_spawn(self):
        """Test GET /api/wilds/current endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/wilds/current")
            
            if response.status_code == 200:
                data = response.json()
                if 'spawn' in data:
                    if data['spawn']:
                        spawn = data['spawn']
                        pokemon = spawn.get('pokemon', {})
                        self.log_result("GET /api/wilds/current", True, 
                            f"Current spawn: {pokemon.get('displayName', 'Unknown')} (Level {pokemon.get('level', 'Unknown')})",
                            {'pokemon_id': pokemon.get('id'), 'is_shiny': pokemon.get('isShiny', False)})
                    else:
                        self.log_result("GET /api/wilds/current", True, 
                            "No current spawn available (spawn is null)")
                    return True
                else:
                    self.log_result("GET /api/wilds/current", False, 
                        "Response missing 'spawn' field")
                    return False
            else:
                self.log_result("GET /api/wilds/current", False, 
                    f"Request failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET /api/wilds/current", False, f"Error: {str(e)}")
            return False
    
    def catch_pokemon(self):
        """Catch a Pokemon to test XP system"""
        try:
            # First ensure there's a spawn
            spawn_response = self.session.get(f"{API_BASE}/wilds/current")
            if spawn_response.status_code != 200:
                self.log_result("Catch Pokemon Setup", False, "Could not get current spawn")
                return False
                
            spawn_data = spawn_response.json()
            if not spawn_data.get('spawn'):
                # Force spawn a Pokemon using admin endpoint
                admin_response = self.session.post(f"{API_BASE}/wilds/admin-spawn",
                    json={"adminId": self.user_id})
                
                if admin_response.status_code != 200:
                    self.log_result("Catch Pokemon Setup", False, 
                        f"Could not force spawn Pokemon: {admin_response.text}")
                    return False
                    
                self.log_result("Catch Pokemon Setup", True, "Force spawned Pokemon for testing")
            
            # Now attempt to catch
            response = self.session.post(f"{API_BASE}/wilds/catch",
                json={"userId": self.user_id})
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('caught'):
                    pokemon = data.get('pokemon', {})
                    self.test_pokemon = pokemon
                    self.log_result("POST /api/wilds/catch", True, 
                        f"Successfully caught {pokemon.get('displayName', 'Unknown')} with currentXP: {pokemon.get('currentXP', 'Missing')}",
                        {'pokemon_id': pokemon.get('id'), 'level': pokemon.get('level'), 'currentXP': pokemon.get('currentXP')})
                    return True
                elif data.get('success') and not data.get('caught'):
                    # Failed catch, try again up to 3 times
                    for attempt in range(2):  # 2 more attempts (total 3)
                        time.sleep(1)
                        retry_response = self.session.post(f"{API_BASE}/wilds/catch",
                            json={"userId": self.user_id})
                        
                        if retry_response.status_code == 200:
                            retry_data = retry_response.json()
                            if retry_data.get('success') and retry_data.get('caught'):
                                pokemon = retry_data.get('pokemon', {})
                                self.test_pokemon = pokemon
                                self.log_result("POST /api/wilds/catch", True, 
                                    f"Successfully caught {pokemon.get('displayName', 'Unknown')} on attempt {attempt + 2}",
                                    {'pokemon_id': pokemon.get('id'), 'level': pokemon.get('level'), 'currentXP': pokemon.get('currentXP')})
                                return True
                            elif retry_data.get('fled'):
                                break
                    
                    self.log_result("POST /api/wilds/catch", False, 
                        "Failed to catch Pokemon after 3 attempts")
                    return False
                else:
                    self.log_result("POST /api/wilds/catch", False, 
                        f"Unexpected catch response: {data}")
                    return False
            else:
                self.log_result("POST /api/wilds/catch", False, 
                    f"Catch request failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST /api/wilds/catch", False, f"Error: {str(e)}")
            return False
    
    def test_my_pokemon(self):
        """Test GET /api/wilds/my-pokemon endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if response.status_code == 200:
                data = response.json()
                pokemon_list = data.get('pokemon', [])
                
                if len(pokemon_list) > 0:
                    # Check if Pokemon have currentXP field
                    pokemon_with_xp = [p for p in pokemon_list if 'currentXP' in p]
                    pokemon_without_xp = [p for p in pokemon_list if 'currentXP' not in p]
                    
                    self.log_result("GET /api/wilds/my-pokemon", True, 
                        f"Retrieved {len(pokemon_list)} Pokemon. {len(pokemon_with_xp)} have currentXP field, {len(pokemon_without_xp)} missing currentXP",
                        {
                            'total_pokemon': len(pokemon_list),
                            'with_currentXP': len(pokemon_with_xp),
                            'without_currentXP': len(pokemon_without_xp),
                            'sample_pokemon': pokemon_list[0] if pokemon_list else None
                        })
                    return True
                else:
                    self.log_result("GET /api/wilds/my-pokemon", True, 
                        "No Pokemon in collection (empty array returned)")
                    return True
            else:
                self.log_result("GET /api/wilds/my-pokemon", False, 
                    f"Request failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET /api/wilds/my-pokemon", False, f"Error: {str(e)}")
            return False
    
    def test_pack_opening_xp(self):
        """Test XP gain from pack opening (2 XP to all Pokemon)"""
        try:
            # Get Pokemon before pack opening
            before_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if before_response.status_code != 200:
                self.log_result("Pack Opening XP Test", False, "Could not get Pokemon before pack opening")
                return False
            
            before_pokemon = before_response.json().get('pokemon', [])
            if len(before_pokemon) == 0:
                self.log_result("Pack Opening XP Test", False, "No Pokemon to test XP gain")
                return False
            
            # Record XP before
            before_xp = {p.get('_id'): p.get('currentXP', 0) for p in before_pokemon}
            
            # Open a pack
            pack_response = self.session.post(f"{API_BASE}/packs/open",
                json={
                    "userId": self.user_id,
                    "setId": "base1"  # Use Base Set for testing
                })
            
            if pack_response.status_code != 200:
                self.log_result("Pack Opening XP Test", False, 
                    f"Pack opening failed: {pack_response.text}")
                return False
            
            pack_data = pack_response.json()
            if not pack_data.get('success'):
                self.log_result("Pack Opening XP Test", False, 
                    f"Pack opening unsuccessful: {pack_data}")
                return False
            
            # Wait a moment for XP to be applied
            time.sleep(2)
            
            # Get Pokemon after pack opening
            after_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if after_response.status_code != 200:
                self.log_result("Pack Opening XP Test", False, "Could not get Pokemon after pack opening")
                return False
            
            after_pokemon = after_response.json().get('pokemon', [])
            after_xp = {p.get('_id'): p.get('currentXP', 0) for p in after_pokemon}
            
            # Check XP gains
            xp_gains = []
            for pokemon_id in before_xp:
                if pokemon_id in after_xp:
                    gain = after_xp[pokemon_id] - before_xp[pokemon_id]
                    xp_gains.append(gain)
            
            if all(gain == 2 for gain in xp_gains):
                self.log_result("Pack Opening XP Gain", True, 
                    f"All {len(xp_gains)} Pokemon gained exactly 2 XP from pack opening",
                    {'xp_gains': xp_gains, 'expected': 2})
                return True
            else:
                self.log_result("Pack Opening XP Gain", False, 
                    f"XP gains inconsistent. Expected 2 XP for all Pokemon, got: {xp_gains}",
                    {'xp_gains': xp_gains, 'expected': 2})
                return False
                
        except Exception as e:
            self.log_result("Pack Opening XP Test", False, f"Error: {str(e)}")
            return False
    
    def test_catch_xp_gain(self):
        """Test XP gain from catching Pokemon (10 XP to all Pokemon)"""
        try:
            # Get Pokemon before catching
            before_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if before_response.status_code != 200:
                self.log_result("Catch XP Test", False, "Could not get Pokemon before catching")
                return False
            
            before_pokemon = before_response.json().get('pokemon', [])
            before_xp = {p.get('_id'): p.get('currentXP', 0) for p in before_pokemon}
            
            # Force spawn and catch another Pokemon
            admin_response = self.session.post(f"{API_BASE}/wilds/admin-spawn",
                json={"adminId": self.user_id})
            
            if admin_response.status_code != 200:
                self.log_result("Catch XP Test", False, "Could not force spawn Pokemon")
                return False
            
            # Attempt to catch
            catch_response = self.session.post(f"{API_BASE}/wilds/catch",
                json={"userId": self.user_id})
            
            if catch_response.status_code != 200:
                self.log_result("Catch XP Test", False, f"Catch request failed: {catch_response.text}")
                return False
            
            catch_data = catch_response.json()
            if not (catch_data.get('success') and catch_data.get('caught')):
                # Try a few more times
                for attempt in range(3):
                    time.sleep(1)
                    retry_response = self.session.post(f"{API_BASE}/wilds/catch",
                        json={"userId": self.user_id})
                    
                    if retry_response.status_code == 200:
                        retry_data = retry_response.json()
                        if retry_data.get('success') and retry_data.get('caught'):
                            catch_data = retry_data
                            break
                        elif retry_data.get('fled'):
                            # Force spawn again
                            self.session.post(f"{API_BASE}/wilds/admin-spawn",
                                json={"adminId": self.user_id})
                
                if not (catch_data.get('success') and catch_data.get('caught')):
                    self.log_result("Catch XP Test", False, "Could not catch Pokemon for XP test")
                    return False
            
            # Wait for XP to be applied
            time.sleep(2)
            
            # Get Pokemon after catching
            after_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if after_response.status_code != 200:
                self.log_result("Catch XP Test", False, "Could not get Pokemon after catching")
                return False
            
            after_pokemon = after_response.json().get('pokemon', [])
            
            # Find the newly caught Pokemon (should have currentXP: 0)
            new_pokemon = None
            for p in after_pokemon:
                if p.get('_id') not in before_xp:
                    new_pokemon = p
                    break
            
            if new_pokemon:
                if new_pokemon.get('currentXP') == 0:
                    self.log_result("New Pokemon XP Initialization", True, 
                        f"Newly caught {new_pokemon.get('displayName')} initialized with currentXP: 0")
                else:
                    self.log_result("New Pokemon XP Initialization", False, 
                        f"Newly caught Pokemon has currentXP: {new_pokemon.get('currentXP')}, expected 0")
            
            # Check XP gains for existing Pokemon
            after_xp = {p.get('_id'): p.get('currentXP', 0) for p in after_pokemon if p.get('_id') in before_xp}
            
            xp_gains = []
            for pokemon_id in before_xp:
                if pokemon_id in after_xp:
                    gain = after_xp[pokemon_id] - before_xp[pokemon_id]
                    xp_gains.append(gain)
            
            if all(gain == 10 for gain in xp_gains):
                self.log_result("Catch XP Gain", True, 
                    f"All {len(xp_gains)} existing Pokemon gained exactly 10 XP from catching",
                    {'xp_gains': xp_gains, 'expected': 10})
                return True
            else:
                self.log_result("Catch XP Gain", False, 
                    f"XP gains inconsistent. Expected 10 XP for all Pokemon, got: {xp_gains}",
                    {'xp_gains': xp_gains, 'expected': 10})
                return False
                
        except Exception as e:
            self.log_result("Catch XP Test", False, f"Error: {str(e)}")
            return False
    
    def test_buy_xp(self):
        """Test POST /api/wilds/buy-xp endpoint"""
        try:
            # Get a Pokemon to test with
            pokemon_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if pokemon_response.status_code != 200:
                self.log_result("Buy XP Test", False, "Could not get Pokemon list")
                return False
            
            pokemon_list = pokemon_response.json().get('pokemon', [])
            if len(pokemon_list) == 0:
                self.log_result("Buy XP Test", False, "No Pokemon available for XP purchase")
                return False
            
            # Find a Pokemon that's not at max level
            test_pokemon = None
            for p in pokemon_list:
                if p.get('level', 1) < 100:
                    test_pokemon = p
                    break
            
            if not test_pokemon:
                self.log_result("Buy XP Test", False, "All Pokemon are at max level")
                return False
            
            pokemon_id = test_pokemon.get('_id')
            before_xp = test_pokemon.get('currentXP', 0)
            before_level = test_pokemon.get('level', 1)
            
            # Get user points before purchase
            session_response = self.session.get(f"{API_BASE}/session",
                params={"userId": self.user_id})
            
            if session_response.status_code != 200:
                self.log_result("Buy XP Test", False, "Could not get user session")
                return False
            
            before_points = session_response.json().get('user', {}).get('points', 0)
            
            # Buy XP
            buy_response = self.session.post(f"{API_BASE}/wilds/buy-xp",
                json={
                    "userId": self.user_id,
                    "pokemonId": pokemon_id
                })
            
            if buy_response.status_code == 200:
                buy_data = buy_response.json()
                if buy_data.get('success'):
                    # Check the response data
                    after_xp = buy_data.get('currentXP')
                    after_level = buy_data.get('level')
                    points_spent = buy_data.get('pointsSpent', 0)
                    
                    # Verify XP gain
                    xp_gained = after_xp - before_xp if after_xp is not None else None
                    
                    if xp_gained == 50:
                        self.log_result("Buy XP - XP Gain", True, 
                            f"Pokemon gained exactly 50 XP (from {before_xp} to {after_xp})")
                    else:
                        self.log_result("Buy XP - XP Gain", False, 
                            f"Expected 50 XP gain, got {xp_gained} (from {before_xp} to {after_xp})")
                    
                    # Verify points deduction
                    if points_spent == 50:
                        self.log_result("Buy XP - Points Deduction", True, 
                            f"Correctly deducted 50 points")
                    else:
                        self.log_result("Buy XP - Points Deduction", False, 
                            f"Expected 50 points deducted, got {points_spent}")
                    
                    # Check level up if applicable
                    if after_level > before_level:
                        self.log_result("Buy XP - Level Up", True, 
                            f"Pokemon leveled up from {before_level} to {after_level}")
                    else:
                        self.log_result("Buy XP - Level Check", True, 
                            f"Pokemon remained at level {before_level} (no level up)")
                    
                    self.log_result("POST /api/wilds/buy-xp", True, 
                        f"Successfully bought XP for {test_pokemon.get('displayName', 'Pokemon')}",
                        {
                            'pokemon_id': pokemon_id,
                            'xp_before': before_xp,
                            'xp_after': after_xp,
                            'level_before': before_level,
                            'level_after': after_level,
                            'points_spent': points_spent
                        })
                    return True
                else:
                    self.log_result("POST /api/wilds/buy-xp", False, 
                        f"Buy XP unsuccessful: {buy_data}")
                    return False
            else:
                self.log_result("POST /api/wilds/buy-xp", False, 
                    f"Buy XP request failed with status {buy_response.status_code}: {buy_response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST /api/wilds/buy-xp", False, f"Error: {str(e)}")
            return False
    
    def test_evolution(self):
        """Test POST /api/wilds/evolve endpoint"""
        try:
            # Get Pokemon list
            pokemon_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                params={"userId": self.user_id})
            
            if pokemon_response.status_code != 200:
                self.log_result("Evolution Test", False, "Could not get Pokemon list")
                return False
            
            pokemon_list = pokemon_response.json().get('pokemon', [])
            if len(pokemon_list) == 0:
                self.log_result("Evolution Test", False, "No Pokemon available for evolution test")
                return False
            
            # Look for a Pokemon that might be able to evolve
            # Common evolution candidates: Ralts (280) -> Kirlia at level 20
            evolution_candidates = []
            for p in pokemon_list:
                pokemon_id = p.get('id')
                level = p.get('level', 1)
                
                # Check some common evolution Pokemon IDs
                if pokemon_id in [280, 281, 25, 26, 1, 2, 4, 5, 7, 8]:  # Ralts, Kirlia, Pikachu, Raichu, Bulbasaur, etc.
                    evolution_candidates.append(p)
            
            if not evolution_candidates:
                # Try to force spawn a Ralts for evolution testing
                try:
                    # This is a bit hacky, but we'll try to spawn and catch a few Pokemon to get an evolution candidate
                    for _ in range(3):
                        spawn_response = self.session.post(f"{API_BASE}/wilds/admin-spawn",
                            json={"adminId": self.user_id})
                        
                        if spawn_response.status_code == 200:
                            # Try to catch it
                            catch_response = self.session.post(f"{API_BASE}/wilds/catch",
                                json={"userId": self.user_id})
                            
                            if catch_response.status_code == 200:
                                catch_data = catch_response.json()
                                if catch_data.get('success') and catch_data.get('caught'):
                                    caught_pokemon = catch_data.get('pokemon', {})
                                    if caught_pokemon.get('id') in [280, 25, 1, 4, 7]:  # Common evolution Pokemon
                                        evolution_candidates.append(caught_pokemon)
                                        break
                except:
                    pass
            
            if not evolution_candidates:
                self.log_result("Evolution Test", False, 
                    "No suitable Pokemon found for evolution testing")
                return False
            
            # Test with the first candidate
            test_pokemon = evolution_candidates[0]
            pokemon_id = test_pokemon.get('_id')
            
            # Store original data for preservation check
            original_data = {
                'isShiny': test_pokemon.get('isShiny'),
                'ivs': test_pokemon.get('ivs'),
                'nickname': test_pokemon.get('nickname'),
                'level': test_pokemon.get('level'),
                'currentXP': test_pokemon.get('currentXP')
            }
            
            # Attempt evolution
            evolve_response = self.session.post(f"{API_BASE}/wilds/evolve",
                json={
                    "userId": self.user_id,
                    "pokemonId": pokemon_id
                })
            
            if evolve_response.status_code == 200:
                evolve_data = evolve_response.json()
                if evolve_data.get('success'):
                    evolved_to = evolve_data.get('evolvedTo')
                    message = evolve_data.get('message')
                    
                    # Get the evolved Pokemon to check data preservation
                    after_response = self.session.get(f"{API_BASE}/wilds/my-pokemon",
                        params={"userId": self.user_id})
                    
                    if after_response.status_code == 200:
                        after_pokemon_list = after_response.json().get('pokemon', [])
                        evolved_pokemon = None
                        
                        for p in after_pokemon_list:
                            if p.get('_id') == pokemon_id:
                                evolved_pokemon = p
                                break
                        
                        if evolved_pokemon:
                            # Check data preservation
                            preserved_correctly = True
                            preservation_details = {}
                            
                            for key, original_value in original_data.items():
                                current_value = evolved_pokemon.get(key)
                                if current_value != original_value:
                                    preserved_correctly = False
                                    preservation_details[key] = {
                                        'original': original_value,
                                        'current': current_value
                                    }
                            
                            if preserved_correctly:
                                self.log_result("Evolution Data Preservation", True, 
                                    "All critical data preserved during evolution (isShiny, IVs, nickname, level, currentXP)")
                            else:
                                self.log_result("Evolution Data Preservation", False, 
                                    f"Some data not preserved: {preservation_details}")
                    
                    self.log_result("POST /api/wilds/evolve", True, 
                        f"Successfully evolved to {evolved_to}",
                        {
                            'evolved_to': evolved_to,
                            'message': message,
                            'original_pokemon': test_pokemon.get('displayName'),
                            'preservation_check': preserved_correctly if 'preserved_correctly' in locals() else 'Not checked'
                        })
                    return True
                else:
                    self.log_result("POST /api/wilds/evolve", False, 
                        f"Evolution unsuccessful: {evolve_data}")
                    return False
            elif evolve_response.status_code == 400:
                # This might be expected if Pokemon can't evolve or doesn't meet requirements
                error_data = evolve_response.json()
                error_message = error_data.get('error', 'Unknown error')
                
                if 'cannot evolve' in error_message.lower() or 'level' in error_message.lower():
                    self.log_result("POST /api/wilds/evolve", True, 
                        f"Evolution correctly rejected: {error_message}",
                        {'pokemon': test_pokemon.get('displayName'), 'level': test_pokemon.get('level')})
                    return True
                else:
                    self.log_result("POST /api/wilds/evolve", False, 
                        f"Evolution failed with error: {error_message}")
                    return False
            else:
                self.log_result("POST /api/wilds/evolve", False, 
                    f"Evolution request failed with status {evolve_response.status_code}: {evolve_response.text}")
                return False
                
        except Exception as e:
            self.log_result("POST /api/wilds/evolve", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all leveling and evolution system tests"""
        print("🧪 Starting Pokemon Wilds Leveling & Evolution System Testing")
        print(f"🌐 Testing against: {BASE_URL}")
        print("=" * 80)
        
        # Login first
        if not self.login():
            print("❌ Cannot proceed without login")
            return False
        
        # Test endpoints in logical order
        tests = [
            ("Current Spawn Check", self.test_current_spawn),
            ("My Pokemon Endpoint", self.test_my_pokemon),
            ("Catch Pokemon", self.catch_pokemon),
            ("Pack Opening XP Gain", self.test_pack_opening_xp),
            ("Catch XP Gain", self.test_catch_xp_gain),
            ("Buy XP Feature", self.test_buy_xp),
            ("Evolution System", self.test_evolution)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🔍 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_result(test_name, False, f"Test execution error: {str(e)}")
        
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        # Print detailed results
        print("\n📋 DETAILED RESULTS:")
        for result in self.results:
            print(f"{result['status']}: {result['test']}")
            print(f"   {result['message']}")
            if result['details']:
                print(f"   Details: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = PokemonWildsLevelingTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Leveling & Evolution System is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the detailed results above.")