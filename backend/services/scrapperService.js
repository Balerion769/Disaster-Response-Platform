import axios from 'axios';
// This is the line we fixed
import * as cheerio from 'cheerio';

export const fetchFemaUpdates = async () => {
  const url = 'https://www.fema.gov/news-releases';
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const updates = [];
    $('.usa-collection__item').each((i, elem) => {
      if (updates.length >= 5) return; // Limit to 5 updates
      const title = $(elem).find('h3 a').text().trim();
      const link = 'https://www.fema.gov' + $(elem).find('h3 a').attr('href');
      const summary = $(elem).find('p').first().text().trim();
      if (title && link) {
        updates.push({ title, link, summary });
      }
    });
    return updates;
  } catch (error) {
    console.error('Error scraping FEMA website:', error.message);
    return [];
  }
};