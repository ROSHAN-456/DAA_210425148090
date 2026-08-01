const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        // Capture console messages
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

        await page.goto('http://localhost:6045/index.html', { waitUntil: 'networkidle0' });

        // wait a moment for settimeouts
        await new Promise(r => setTimeout(r, 2000));

        // Check charts
        const chartSizes = await page.evaluate(() => {
            return {
                exec: document.getElementById('execTimeChart')?.getBoundingClientRect().toJSON(),
                edge: document.getElementById('edgeSplitChart')?.getBoundingClientRect().toJSON(),
                cost: document.getElementById('costGrowthChart')?.getBoundingClientRect().toJSON(),
            };
        });
        console.log('CHART CANVAS BOXES:', chartSizes);

        await browser.close();
    } catch (err) {
        console.error('SCRIPT ERROR:', err);
    }
})();
