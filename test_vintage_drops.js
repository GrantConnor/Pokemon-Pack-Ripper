/**
 * Manual test script for 15% Vintage Drop Rate
 * Tests the drop rates for vintage vs non-vintage sets
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test credentials
const SPHEAL_CREDS = {
  username: 'Spheal',
  password: 'spheal'
};

// Helper to add delay between requests (avoid rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to check if a card is rare or better
function hasRareCard(cards) {
  return cards.some(card => {
    const rarity = card.rarity || '';
    return rarity.includes('Rare') || rarity.includes('rare');
  });
}

async function testVintageDropRate() {
  console.log('🎯 Testing 15% Vintage Drop Rate Implementation\n');
  
  try {
    // Step 1: Sign in as Spheal
    console.log('1. Signing in as Spheal...');
    const signInResponse = await axios.post(`${BASE_URL}/auth/signin`, SPHEAL_CREDS);
    const userId = signInResponse.data.user.id;
    console.log(`✅ Signed in successfully. User ID: ${userId}\n`);
    
    // Step 2: Test Vintage Set (Base Set - base1)
    console.log('2. Testing VINTAGE SET (base1 - Base Set)');
    console.log('   Expected: ~15% of packs should have Rare cards\n');
    
    const vintageResults = {
      withRare: 0,
      withoutRare: 0,
      total: 0
    };
    
    const VINTAGE_PACKS = 30; // Test with 30 packs
    
    for (let i = 0; i < VINTAGE_PACKS; i++) {
      try {
        const packResponse = await axios.post(`${BASE_URL}/packs/open`, {
          userId,
          setId: 'base1',
          bulk: false
        });
        
        if (packResponse.data.success) {
          const cards = packResponse.data.cards;
          const hasRare = hasRareCard(cards);
          
          if (hasRare) {
            vintageResults.withRare++;
            console.log(`   Pack ${i + 1}/${VINTAGE_PACKS}: ✨ HAS RARE`);
          } else {
            vintageResults.withoutRare++;
            console.log(`   Pack ${i + 1}/${VINTAGE_PACKS}: ⚪ NO RARE (commons/uncommons only)`);
          }
          
          vintageResults.total++;
        }
        
        // Add delay to avoid rate limiting
        await delay(2000); // 2 second delay between packs
        
      } catch (error) {
        console.log(`   Pack ${i + 1}/${VINTAGE_PACKS}: ❌ ERROR - ${error.message}`);
      }
    }
    
    const vintageRareRate = (vintageResults.withRare / vintageResults.total * 100).toFixed(2);
    console.log(`\n📊 VINTAGE SET RESULTS (base1):`);
    console.log(`   Total Packs: ${vintageResults.total}`);
    console.log(`   Packs with Rare: ${vintageResults.withRare} (${vintageRareRate}%)`);
    console.log(`   Packs without Rare: ${vintageResults.withoutRare} (${(100 - vintageRareRate).toFixed(2)}%)`);
    
    if (vintageRareRate >= 10 && vintageRareRate <= 20) {
      console.log(`   ✅ PASSED: Rare rate is within expected range (10-20%)\n`);
    } else {
      console.log(`   ⚠️  WARNING: Rare rate outside expected range (expected 10-20%, got ${vintageRareRate}%)\n`);
    }
    
    // Step 3: Test EX Set (ex1 - Ruby & Sapphire)
    console.log('3. Testing EX SET (ex1 - Ruby & Sapphire)');
    console.log('   Expected: 100% of packs should have Rare cards\n');
    
    const exResults = {
      withRare: 0,
      withoutRare: 0,
      total: 0
    };
    
    const EX_PACKS = 10; // Test with 10 packs
    
    for (let i = 0; i < EX_PACKS; i++) {
      try {
        const packResponse = await axios.post(`${BASE_URL}/packs/open`, {
          userId,
          setId: 'ex1',
          bulk: false
        });
        
        if (packResponse.data.success) {
          const cards = packResponse.data.cards;
          const hasRare = hasRareCard(cards);
          
          if (hasRare) {
            exResults.withRare++;
            console.log(`   Pack ${i + 1}/${EX_PACKS}: ✨ HAS RARE`);
          } else {
            exResults.withoutRare++;
            console.log(`   Pack ${i + 1}/${EX_PACKS}: ⚪ NO RARE`);
          }
          
          exResults.total++;
        }
        
        await delay(2000);
        
      } catch (error) {
        console.log(`   Pack ${i + 1}/${EX_PACKS}: ❌ ERROR - ${error.message}`);
      }
    }
    
    const exRareRate = (exResults.withRare / exResults.total * 100).toFixed(2);
    console.log(`\n📊 EX SET RESULTS (ex1):`);
    console.log(`   Total Packs: ${exResults.total}`);
    console.log(`   Packs with Rare: ${exResults.withRare} (${exRareRate}%)`);
    console.log(`   Packs without Rare: ${exResults.withoutRare}`);
    
    if (exRareRate === '100.00') {
      console.log(`   ✅ PASSED: All packs have rares (100%)\n`);
    } else {
      console.log(`   ❌ FAILED: Not all packs have rares (expected 100%, got ${exRareRate}%)\n`);
    }
    
    // Final Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 FINAL SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`VINTAGE SETS (base1): ${vintageRareRate}% rare rate ${vintageRareRate >= 10 && vintageRareRate <= 20 ? '✅' : '❌'}`);
    console.log(`EX SETS (ex1): ${exRareRate}% rare rate ${exRareRate === '100.00' ? '✅' : '❌'}`);
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testVintageDropRate();
