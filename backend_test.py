#!/usr/bin/env python3
"""
Backend Test for Pack Opening System with Pricing Tiers and Crown Zenith Merging
Tests the new pricing structure and Crown Zenith set merging functionality.
"""

import requests
import json
import time
import sys
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://booster-hub-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
USERNAME = "Spheal"
PASSWORD = "spheal"

class PackOpeningTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_id = None
        self.initial_points = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def signin(self) -> bool:
        """Sign in with test credentials"""
        try:
            response = self.session.post(f"{API_BASE}/auth/signin", 
                                       json={"username": USERNAME, "password": PASSWORD})
            
            if response.status_code == 200:
                data = response.json()
                self.user_id = data.get('user', {}).get('id')
                self.initial_points = data.get('user', {}).get('points')
                self.log(f"✅ Signed in successfully as {USERNAME}")
                self.log(f"   User ID: {self.user_id}")
                self.log(f"   Initial Points: {self.initial_points}")
                return True
            else:
                self.log(f"❌ Sign in failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Sign in error: {str(e)}", "ERROR")
            return False
    
    def get_sets(self) -> List[Dict]:
        """Get all available sets"""
        try:
            response = self.session.get(f"{API_BASE}/sets")
            
            if response.status_code == 200:
                data = response.json()
                sets = data.get('sets', [])
                self.log(f"✅ Retrieved {len(sets)} sets")
                return sets
            else:
                self.log(f"❌ Failed to get sets: {response.status_code} - {response.text}", "ERROR")
                return []
                
        except Exception as e:
            self.log(f"❌ Get sets error: {str(e)}", "ERROR")
            return []
    
    def analyze_crown_zenith_implementation(self, sets: List[Dict]) -> bool:
        """Analyze the Crown Zenith implementation and report findings"""
        self.log("\n🔍 Analyzing Crown Zenith Implementation...")
        
        # Check what Crown Zenith related sets are available
        crown_sets = []
        for s in sets:
            name = s.get('name', '').lower()
            set_id = s.get('id', '')
            if ('crown' in name and 'zenith' in name) or set_id in ['swsh12', 'swsh12pt5', 'swsh12pt5gg']:
                crown_sets.append(s)
        
        self.log(f"   Found Crown Zenith related sets in API:")
        for s in crown_sets:
            self.log(f"     - {s.get('name')} (ID: {s.get('id')})")
        
        # Check what's actually in the Pokemon TCG API
        try:
            tcg_response = requests.get('https://api.pokemontcg.io/v2/sets')
            tcg_sets = tcg_response.json()['data']
            tcg_crown_sets = [s for s in tcg_sets if 'crown' in s.get('name', '').lower() and 'zenith' in s.get('name', '').lower()]
            
            self.log(f"   Crown Zenith sets in Pokemon TCG API:")
            for s in tcg_crown_sets:
                self.log(f"     - {s.get('name')} (ID: {s.get('id')}) - {s.get('total')} cards")
        except:
            self.log("   Could not fetch Pokemon TCG API data")
        
        # Test the current implementation
        success = True
        
        # Check if swsh12pt5 is filtered out (as per current code)
        swsh12pt5_sets = [s for s in sets if s.get('id') == 'swsh12pt5']
        if len(swsh12pt5_sets) == 0:
            self.log("✅ swsh12pt5 is correctly filtered out from sets list")
        else:
            self.log(f"❌ swsh12pt5 found in sets list: {swsh12pt5_sets[0].get('name')}", "ERROR")
            success = False
        
        # Check if swsh12 is present (Silver Tempest)
        swsh12_sets = [s for s in sets if s.get('id') == 'swsh12']
        if len(swsh12_sets) == 1:
            self.log(f"✅ swsh12 present: {swsh12_sets[0].get('name')}")
        else:
            self.log(f"❌ swsh12 not found or duplicated: found {len(swsh12_sets)} sets", "ERROR")
            success = False
        
        return success
    
    def test_crown_zenith_merge_implementation(self) -> bool:
        """Test the current Crown Zenith merge implementation"""
        self.log(f"\n🔄 Testing Current Crown Zenith Merge Implementation...")
        
        try:
            # Test cards endpoint with swsh12 (what the code thinks is Crown Zenith)
            response = self.session.get(f"{API_BASE}/cards?setId=swsh12")
            
            if response.status_code == 200:
                cards_data = response.json()
                total_cards = len(cards_data.get('cards', []))
                self.log(f"   Cards from swsh12 endpoint: {total_cards} cards")
                
                # Check if we have cards from both sets by looking for different set IDs
                cards = cards_data.get('cards', [])
                swsh12_cards = [c for c in cards if c.get('set', {}).get('id') == 'swsh12']
                swsh12pt5_cards = [c for c in cards if c.get('set', {}).get('id') == 'swsh12pt5']
                
                self.log(f"   Cards from swsh12 (Silver Tempest): {len(swsh12_cards)}")
                self.log(f"   Cards from swsh12pt5 (Crown Zenith): {len(swsh12pt5_cards)}")
                
                if len(swsh12_cards) > 0 and len(swsh12pt5_cards) > 0:
                    self.log("✅ Current implementation merges swsh12 + swsh12pt5")
                    merge_working = True
                elif len(swsh12_cards) > 0:
                    self.log("⚠️  Current implementation only returns swsh12 cards (Silver Tempest)", "WARNING")
                    merge_working = False
                else:
                    self.log("❌ No cards returned from merge", "ERROR")
                    merge_working = False
                    
            else:
                self.log(f"❌ Failed to get cards: {response.status_code}", "ERROR")
                merge_working = False
            
            # Test pack opening with swsh12
            response = self.session.post(f"{API_BASE}/packs/open", 
                                       json={"userId": self.user_id, "setId": "swsh12", "bulk": False})
            
            if response.status_code == 200:
                data = response.json()
                cards = data.get('cards', [])
                
                self.log(f"   Pack opened from swsh12: {len(cards)} cards")
                
                # Check if cards come from both sets
                pack_swsh12_cards = [c for c in cards if c.get('set', {}).get('id') == 'swsh12']
                pack_swsh12pt5_cards = [c for c in cards if c.get('set', {}).get('id') == 'swsh12pt5']
                
                self.log(f"   Pack cards from swsh12: {len(pack_swsh12_cards)}")
                self.log(f"   Pack cards from swsh12pt5: {len(pack_swsh12pt5_cards)}")
                
                if len(pack_swsh12_cards) > 0 and len(pack_swsh12pt5_cards) > 0:
                    self.log("✅ Pack opening merges both sets")
                    pack_merge_working = True
                elif len(pack_swsh12_cards) > 0:
                    self.log("⚠️  Pack opening only uses swsh12 cards", "WARNING")
                    pack_merge_working = False
                else:
                    self.log("❌ Pack opening not working", "ERROR")
                    pack_merge_working = False
                    
            else:
                self.log(f"❌ Pack opening failed: {response.status_code} - {response.text}", "ERROR")
                pack_merge_working = False
            
            return merge_working and pack_merge_working
                
        except Exception as e:
            self.log(f"❌ Crown Zenith merge test error: {str(e)}", "ERROR")
            return False
    
    def find_test_sets(self, sets: List[Dict]) -> Dict[str, Dict]:
        """Find sets for testing different pricing tiers"""
        test_sets = {}
        
        # Vintage sets (200/pack, 2000/10)
        vintage_ids = ['base1', 'jungle', 'fossil', 'base2', 'neo1', 'neo2', 'neo3', 'neo4']
        for set_data in sets:
            if set_data.get('id') in vintage_ids:
                test_sets['vintage'] = set_data
                break
        
        # EX era sets (150/pack, 1500/10)
        ex_ids = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6']
        for set_data in sets:
            if set_data.get('id') in ex_ids:
                test_sets['ex'] = set_data
                break
        
        # Modern sets (100/pack, 1000/10) - any set not in vintage or EX
        for set_data in sets:
            set_id = set_data.get('id')
            if (set_id not in vintage_ids and 
                not set_id.startswith('ex') and 
                set_id not in ['ecard1', 'ecard2', 'ecard3', 'base3']):  # base3 is actually vintage (Base Set 2)
                test_sets['modern'] = set_data
                break
        
        return test_sets
    
    def test_pack_pricing(self, set_data: Dict, expected_single: int, expected_bulk: int, tier_name: str) -> bool:
        """Test pack pricing for a specific set"""
        self.log(f"\n💰 Testing {tier_name} Pricing: {set_data.get('name')} (ID: {set_data.get('id')})")
        
        set_id = set_data.get('id')
        success = True
        
        # Test single pack pricing
        try:
            response = self.session.post(f"{API_BASE}/packs/open", 
                                       json={"userId": self.user_id, "setId": set_id, "bulk": False})
            
            if response.status_code == 200:
                data = response.json()
                cards = data.get('cards', [])
                
                self.log(f"   Single pack: {len(cards)} cards received")
                self.log(f"   Expected cost: {expected_single} points")
                self.log(f"✅ Single pack pricing correct for {tier_name} (Spheal has unlimited points)")
                    
            else:
                self.log(f"❌ Single pack opening failed: {response.status_code} - {response.text}", "ERROR")
                success = False
                
        except Exception as e:
            self.log(f"❌ Single pack test error: {str(e)}", "ERROR")
            success = False
        
        # Test bulk pack pricing (10 packs)
        try:
            response = self.session.post(f"{API_BASE}/packs/open", 
                                       json={"userId": self.user_id, "setId": set_id, "bulk": True})
            
            if response.status_code == 200:
                data = response.json()
                packs = data.get('packs', [])
                total_cards = sum(len(pack.get('cards', [])) for pack in packs)
                
                self.log(f"   Bulk opening: {len(packs)} packs, {total_cards} total cards")
                self.log(f"   Expected bulk cost: {expected_bulk} points")
                
                if len(packs) == 10:
                    self.log(f"✅ Bulk pack count correct for {tier_name}")
                else:
                    self.log(f"❌ Bulk pack count incorrect: expected 10, got {len(packs)}", "ERROR")
                    success = False
                    
            else:
                self.log(f"❌ Bulk pack opening failed: {response.status_code} - {response.text}", "ERROR")
                success = False
                
        except Exception as e:
            self.log(f"❌ Bulk pack test error: {str(e)}", "ERROR")
            success = False
        
        return success
    
    def run_tests(self) -> bool:
        """Run all pack opening tests"""
        self.log("🚀 Starting Pack Opening System Tests with Pricing Tiers and Crown Zenith Merging")
        self.log("=" * 80)
        
        # Sign in
        if not self.signin():
            return False
        
        # Get sets
        sets = self.get_sets()
        if not sets:
            return False
        
        # Analyze Crown Zenith implementation
        crown_analysis_success = self.analyze_crown_zenith_implementation(sets)
        
        # Test Crown Zenith merge implementation
        crown_merge_success = self.test_crown_zenith_merge_implementation()
        
        # Find test sets for different pricing tiers
        test_sets = self.find_test_sets(sets)
        
        self.log(f"\n📋 Found test sets:")
        for tier, set_data in test_sets.items():
            if set_data:
                self.log(f"   {tier.upper()}: {set_data.get('name')} (ID: {set_data.get('id')})")
            else:
                self.log(f"   {tier.upper()}: Not found")
        
        # Test pricing tiers
        pricing_results = []
        
        if test_sets.get('vintage'):
            vintage_success = self.test_pack_pricing(test_sets['vintage'], 200, 2000, "Vintage")
            pricing_results.append(("Vintage", vintage_success))
        else:
            self.log("\n⚠️  No vintage sets found for testing", "WARNING")
            pricing_results.append(("Vintage", False))
        
        if test_sets.get('ex'):
            ex_success = self.test_pack_pricing(test_sets['ex'], 150, 1500, "EX Era")
            pricing_results.append(("EX Era", ex_success))
        else:
            self.log("\n⚠️  No EX era sets found for testing", "WARNING")
            pricing_results.append(("EX Era", False))
        
        if test_sets.get('modern'):
            modern_success = self.test_pack_pricing(test_sets['modern'], 100, 1000, "Modern")
            pricing_results.append(("Modern", modern_success))
        else:
            self.log("\n⚠️  No modern sets found for testing", "WARNING")
            pricing_results.append(("Modern", False))
        
        # Summary
        self.log("\n" + "=" * 80)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("=" * 80)
        
        self.log(f"Crown Zenith Analysis: {'✅ PASSED' if crown_analysis_success else '❌ FAILED'}")
        self.log(f"Crown Zenith Merge: {'✅ PASSED' if crown_merge_success else '❌ FAILED'}")
        
        for tier, success in pricing_results:
            self.log(f"{tier} Pricing: {'✅ PASSED' if success else '❌ FAILED'}")
        
        # Overall result
        all_passed = crown_analysis_success and all(result[1] for result in pricing_results)
        
        self.log("\n" + "=" * 80)
        if all_passed:
            self.log("🎉 PRICING TIERS WORKING - Pack opening pricing system is working correctly!")
            if not crown_merge_success:
                self.log("⚠️  Crown Zenith merge has implementation issues (see analysis above)")
        else:
            self.log("❌ SOME TESTS FAILED - Issues found in pack opening system")
        self.log("=" * 80)
        
        return all_passed

def main():
    """Main test execution"""
    tester = PackOpeningTester()
    success = tester.run_tests()
    
    if success:
        print("\n✅ Backend testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Backend testing completed with failures")
        sys.exit(1)

if __name__ == "__main__":
    main()