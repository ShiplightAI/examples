/**
 * Data Extraction Example for @shiplightai/sdk
 *
 * This example demonstrates advanced data extraction patterns:
 * - Extracting single values
 * - Extracting multiple items
 * - Extracting structured data
 * - Using extracted data in subsequent actions
 *
 * Prerequisites:
 * - Set an LLM credential in .env: GOOGLE_API_KEY, ANTHROPIC_API_KEY,
 *   OPENAI_API_KEY, or SHIPLIGHT_API_TOKEN (Shiplight LLM proxy)
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { createAgent, configureSdk } from '@shiplightai/sdk';

// Configure SDK credentials. Set the key matching your model provider
// (GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY), or SHIPLIGHT_API_TOKEN
// to route any provider through the Shiplight LLM proxy.
const credentials: Record<string, string> = {};
for (const key of ['GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'SHIPLIGHT_API_TOKEN']) {
  const value = process.env[key];
  if (value) credentials[key] = value;
}
if (Object.keys(credentials).length === 0) {
  console.error('Error: no LLM credentials set');
  console.log('   Set GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or SHIPLIGHT_API_TOKEN in .env');
  process.exit(1);
}
configureSdk({ env: credentials });

async function extractionExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const agent = createAgent({
    model: 'gemini-3-flash-preview',
  });

  try {
    console.log('=== Data Extraction Example ===');
    console.log('Model: gemini-3-flash-preview\n');

    // ================================
    // PART 1: Basic Text Extraction
    // ================================
    console.log('--- Part 1: Basic Text Extraction ---\n');

    await page.goto('https://example.com/');
    console.log('1. Navigated to example.com\n');

    // Extract page title
    console.log('2. Extracting page title...');
    await agent.extract(page, 'the page title', 'pageTitle');
    console.log(`   pageTitle: "${agent.getVariable('pageTitle')}"\n`);

    // Extract main heading
    console.log('3. Extracting main heading...');
    await agent.extract(page, 'the main heading text', 'mainHeading');
    console.log(`   mainHeading: "${agent.getVariable('mainHeading')}"\n`);

    // Extract paragraph content
    console.log('4. Extracting paragraph content...');
    await agent.extract(page, 'the first paragraph text', 'firstParagraph');
    console.log(`   firstParagraph: "${agent.getVariable('firstParagraph')?.substring(0, 100)}..."\n`);

    // ================================
    // PART 2: Extracting from Lists
    // ================================
    console.log('--- Part 2: Extracting from Wikipedia ---\n');

    await page.goto('https://en.wikipedia.org/wiki/Web_browser');
    console.log('5. Navigated to Wikipedia article\n');

    // Extract article title
    console.log('6. Extracting article title...');
    await agent.extract(page, 'the article title', 'articleTitle');
    console.log(`   articleTitle: "${agent.getVariable('articleTitle')}"\n`);

    // Extract first sentence of article
    console.log('7. Extracting article summary...');
    await agent.extract(page, 'the first sentence of the article', 'articleSummary');
    console.log(`   articleSummary: "${agent.getVariable('articleSummary')?.substring(0, 150)}..."\n`);

    // Extract table of contents items
    console.log('8. Extracting table of contents...');
    await agent.extract(page, 'the first 3 items from the table of contents', 'tocItems');
    console.log(`   tocItems: "${agent.getVariable('tocItems')}"\n`);

    // ================================
    // PART 3: Extracting from E-commerce
    // ================================
    console.log('--- Part 3: Extracting from E-commerce (Sauce Labs Demo) ---\n');

    await page.goto('https://www.saucedemo.com/');

    // Login first
    await page.fill('#user-name', 'standard_user');
    await page.fill('#password', 'secret_sauce');
    await page.click('#login-button');
    await page.waitForLoadState('networkidle');
    console.log('9. Logged in to Sauce Labs Demo\n');

    // Extract product information
    console.log('10. Extracting first product name...');
    await agent.extract(page, 'the name of the first product', 'productName');
    console.log(`    productName: "${agent.getVariable('productName')}"\n`);

    console.log('11. Extracting first product price...');
    await agent.extract(page, 'the price of the first product', 'productPrice');
    console.log(`    productPrice: "${agent.getVariable('productPrice')}"\n`);

    console.log('12. Extracting first product description...');
    await agent.extract(page, 'the description of the first product', 'productDescription');
    console.log(`    productDescription: "${agent.getVariable('productDescription')?.substring(0, 100)}..."\n`);

    // Extract count
    console.log('13. Extracting total product count...');
    await agent.extract(page, 'the total number of products displayed', 'productCount');
    console.log(`    productCount: "${agent.getVariable('productCount')}"\n`);

    // ================================
    // PART 4: Using Extracted Data
    // ================================
    console.log('--- Part 4: Using Extracted Data in Actions ---\n');

    console.log('14. Using extracted product name in search...');
    console.log(`    Will search for: "${agent.getVariable('productName')}"`);

    // Navigate to Wikipedia and search for the product
    await page.goto('https://www.wikipedia.org/');
    await agent.act(page, 'Type $productName in the search box');
    console.log('    ✓ Typed extracted product name into Wikipedia search\n');

    // ================================
    // PART 5: Conditional Extraction
    // ================================
    console.log('--- Part 5: Conditional Extraction ---\n');

    await page.goto('https://www.saucedemo.com/inventory.html');
    console.log('15. Back on inventory page\n');

    // Check if sale items exist before extracting
    console.log('16. Checking for sale items...');
    const hasSaleItems = await agent.evaluate(page, 'There are items marked as on sale or discounted');
    console.log(`    Sale items present: ${hasSaleItems ? '✓' : '✗'}`);

    if (hasSaleItems) {
      await agent.extract(page, 'the names of items on sale', 'saleItems');
      console.log(`    saleItems: "${agent.getVariable('saleItems')}"\n`);
    } else {
      console.log('    Skipping sale item extraction (none found)\n');
    }

    // ================================
    // Summary
    // ================================
    console.log('=== Extraction Summary ===\n');
    console.log('Extracted values:');
    const extractedVars = [
      'pageTitle', 'mainHeading', 'articleTitle', 'articleSummary',
      'tocItems', 'productName', 'productPrice', 'productDescription', 'productCount'
    ];
    extractedVars.forEach(name => {
      const value = agent.getVariable(name);
      if (value) {
        const displayValue = value.length > 60 ? value.substring(0, 60) + '...' : value;
        console.log(`  ${name}: "${displayValue}"`);
      }
    });

    console.log('\n✓ Data extraction example completed');

  } catch (error) {
    console.error('Extraction example failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

extractionExample().catch(console.error);
