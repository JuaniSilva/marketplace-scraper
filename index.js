import playwright from 'playwright'
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';
dotenv.config();

async function main() {
	try {
		const browser = await playwright.chromium.launch()
		const page = await browser.newPage()
		console.log('[INFO] Opened browser')

		await page.goto('https://www.facebook.com', {
			timeout: 60000
		})
		console.log('[INFO] Opened Facebook')

		const needsLogin = await page.waitForSelector('input[name="email"]')
		if (needsLogin) await login(page)

		await page.goto('https://www.facebook.com/marketplace/105981016108769/search?sortBy=distance_ascend&query=xr150&exact=false')
		console.log('[INFO] Opened Marketplace')
		//Scroll to bottom of page 10 times
		for (let i = 0; i < 12; i++) {
			await page.evaluate(() => {
				return Promise.resolve(
					window.scrollTo(0, document.body.scrollHeight)
				)
			})
			await page.waitForTimeout(1000)
		}

		const html = await page.content()
		const $ = cheerio.load(html)
		const items = $('div[role="main"] a[role="link"]')

		console.log('[INFO] Scraping items')
		const parsedItems = []
		for (const item of items) {
			const link = $(item).attr('href')
			const image = $(item).find('img').attr('src')
			const lastDiv = $(item).find('div > div:nth-child(2)')
			const price = lastDiv.children('div:nth-child(1)').text()
			const [currentPrice, oldPrice] = price.replaceAll('$', ' ').trim().replaceAll('.', '').split(' ')
			const id = link.match(/item\/(\d+)/)[1]


			parsedItems.push({
				id,
				title: lastDiv.find('div:nth-child(2)').text(),
				currentPrice: parseInt(currentPrice) || null,
				oldPrice: parseInt(oldPrice) || null,
				location: lastDiv.find('div:nth-child(3)').text(),
				image,
				link: 'https://www.facebook.com' + link,
			})
		}

		console.log('[INFO] Done scraping')
		parsedItems.sort((a, b) => {
			if (a.currentPrice === null) return 1
			if (b.currentPrice === null) return -1
			return a.currentPrice - b.currentPrice
		})

		const worksheet = XLSX.utils.json_to_sheet(parsedItems.map(item => {
			return {
				...item,
				currentPrice: item.currentPrice?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
				oldPrice: item.oldPrice?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
			}
		}))
		const wb = XLSX.utils.book_new()
		const date = new Date().toLocaleString().replaceAll('/', '-').replaceAll(':', '-').replaceAll(',', '').replaceAll(' ', '_')
		XLSX.utils.book_append_sheet(wb, worksheet, 'XR150 Search' + date)


		XLSX.writeFile(wb, `xr150search-${date}.xlsx`)
		console.log('[INFO] Done writing to file')

		await browser.close()
	} catch (error) {
		console.error(error)
	}
}

/**
 * 
 * @param {playwright.Page} page 
 */
async function login(page) {
	console.log('[INFO] Logging in')
	await page.fill('input[name="email"]', process.env.EMAIL)
	await page.fill('input[name="pass"]', process.env.PASSWORD)
	await page.click('button[name="login"]')
	await page.waitForURL('https://www.facebook.com/', { timeout: 60000 })
	console.log('[INFO] Logged in')
}

main()
