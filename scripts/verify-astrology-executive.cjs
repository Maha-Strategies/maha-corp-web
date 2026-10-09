/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  let signedIn=false
  await page.route('**/api/astrology/auth',route=>{const body=route.request().postDataJSON(); if(body.operation==='status')return route.fulfill({json:{signedIn,configured:true}});if(body.operation==='request')return route.fulfill({json:{challenge:'a'.repeat(64),message:'Check your email for a six-digit code.'}});if(body.operation==='verify'){assert.equal(body.code,'123456');signedIn=true;return route.fulfill({json:{signedIn:true}})} signedIn=false;return route.fulfill({json:{signedIn:false}})})
  await page.goto('http://localhost:3138/astrology',{waitUntil:'networkidle',timeout:120000})
  for(const tab of ['Chart','Aspects & Yogas','Transits','Corporate Synastry','Reading','Ask AI','Sources']) assert.equal(await page.getByRole('button',{name:tab,exact:true}).count(),1)
  await page.getByRole('button',{name:'Aspects & Yogas',exact:true}).click(); await page.getByText('House lordships',{exact:true}).waitFor();await page.getByText('Yoga matrix · screening only',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Transits',exact:true}).click(); await page.getByRole('img',{name:'Natal and transit overlay with selected whole-sign aspect rays'}).waitFor();await page.getByLabel('Highlight planet').selectOption('Saturn')
  await page.getByRole('button',{name:'Corporate Synastry',exact:true}).click();await page.getByText('House alignment',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Compare charts',exact:true}).isDisabled(),true)
  await page.getByRole('button',{name:'Explore Executive dossier + 30-day pass — $79',exact:true}).click()
  await page.getByLabel('Email address',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Purchase this dossier',exact:true}).isDisabled(),true)
  assert.equal(await page.getByRole('button',{name:'Subscribe',exact:true}).first().isDisabled(),true)
  await page.route('**/api/astrology/platform',async route=>{
   const body=route.request().postDataJSON();assert.equal(route.request().headers().authorization,undefined)
   if(body.operation==='entitlement')return route.fulfill({json:{entitlement:{userId:'synthetic',isSubscriber:false,subscriptionTier:'free',aiQueryCredits:1,dossierCredits:0,checkoutConfigured:false,purchasedDossiers:[]}}})
   return route.fulfill({json:{entries:[]}})
  })
  await page.getByLabel('Email address',{exact:true}).fill('fictional@example.com');await page.getByRole('button',{name:'Email me a sign-in code',exact:true}).click();await page.getByLabel('Six-digit sign-in code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify & open my vault',exact:true}).click();await page.getByText('Account connected. Access is verified on each request.',{exact:true}).waitFor()
  await page.reload({waitUntil:'networkidle'});await page.getByText('Executive access & private chart vault',{exact:false}).click();await page.getByText('Account connected. Access is verified on each request.',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Ask AI',exact:true}).first().click()
  await page.route('**/api/astrology/chat',route=>route.fulfill({json:{answer:'## Geometry\n**Jupiter** uses inclusive sign counts.\n\n| Body | House |\n| --- | --- |\n| Jupiter | 2 |\n\n<script>alert(1)</script>',sources:[]}}))
  await page.getByLabel('Your question',{exact:true}).fill('Explain the structural geometry.');await page.getByRole('button',{name:'Ask AI',exact:true}).last().click();await page.getByRole('heading',{name:'Geometry',exact:true}).waitFor();assert.equal(await page.locator('.markdown-table').count(),1);assert.equal(await page.locator('article script').count(),0)
  await page.screenshot({path:'/private/tmp/maha-executive-desktop.png',fullPage:true})
  for(const width of [1440,375]){await page.setViewportSize({width,height:1000});const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.client,JSON.stringify(size))}
  await page.screenshot({path:'/private/tmp/maha-executive-mobile.png',fullPage:true});await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Ask AI',exact:true}).first().click();assert.equal(await page.getByLabel('Your question',{exact:true}).inputValue(),'');assert.equal(await page.getByRole('heading',{name:'Geometry',exact:true}).count(),0);assert.deepEqual(errors,[])
  console.log('PASS: seven tabs, fictional matrices/radar, paid controls disabled, contextual offer, email-code sign-in without API keys, safe structured Markdown, desktop/mobile layout; provider calls mocked.')
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
