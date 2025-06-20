import axios from 'axios';

export const getCoordinatesForLocation = async (locationName) => {
  if (!locationName) return null;
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: locationName,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'DisasterResponseApp/1.0 (your-email@example.com)' // Be polite to Nominatim
      }
    });

    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { lat: parseFloat(lat), lon: parseFloat(lon) };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding location:', error.message);
    return null;
  }
};