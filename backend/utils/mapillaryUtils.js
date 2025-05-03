// backend/utils/mapillaryUtils.js
const axios = require('axios');
const { MAPILLARY_ACCESS_TOKEN } = process.env;

// Mapillary API endpoints
const MAPILLARY_API_BASE = 'https://graph.mapillary.com';

// 랜덤 위치에서 이미지 가져오기
async function getRandomLocation() {
  try {
    // 랜덤 좌표 생성 (전 세계)
    const lat = (Math.random() * 170) - 85; // -85 ~ 85
    const lng = (Math.random() * 360) - 180; // -180 ~ 180
    const radius = 50000; // 50km 반경
    
    // 주변 이미지 검색
    const response = await axios.get(`${MAPILLARY_API_BASE}/images`, {
      params: {
        access_token: MAPILLARY_ACCESS_TOKEN,
        bbox: `${lng-0.5},${lat-0.5},${lng+0.5},${lat+0.5}`,
        limit: 1
      },
      headers: {
        'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
      }
    });

    if (response.data.data && response.data.data.length > 0) {
      const image = response.data.data[0];
      
      // 이미지의 좌표 정보 가져오기
      const locationResponse = await axios.get(`${MAPILLARY_API_BASE}/${image.id}`, {
        params: {
          access_token: MAPILLARY_ACCESS_TOKEN,
          fields: 'geometry,computed_geometry'
        },
        headers: {
          'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
        }
      });

      const geometry = locationResponse.data.geometry || locationResponse.data.computed_geometry;
      
      return {
        imageId: image.id,
        lat: geometry.coordinates[1],
        lng: geometry.coordinates[0]
      };
    } else {
      // 이미지가 없으면 재귀적으로 다시 시도
      return getRandomLocation();
    }
  } catch (error) {
    console.error('Error fetching random location:', error);
    
    // 에러 발생 시 기본 위치 반환
    return {
      imageId: null,
      lat: 0,
      lng: 0
    };
  }
}

// 특정 지역에서 이미지 가져오기
async function getLocationByRegion(region = 'seoul') {
  const regions = {
    seoul: { lat: 37.5665, lng: 126.9780 },
    newyork: { lat: 40.7128, lng: -74.0060 },
    london: { lat: 51.5074, lng: -0.1278 },
    tokyo: { lat: 35.6762, lng: 139.6503 },
    paris: { lat: 48.8566, lng: 2.3522 }
  };

  const coords = regions[region.toLowerCase()] || regions.seoul;
  
  try {
    const response = await axios.get(`${MAPILLARY_API_BASE}/images`, {
      params: {
        access_token: MAPILLARY_ACCESS_TOKEN,
        bbox: `${coords.lng-0.5},${coords.lat-0.5},${coords.lng+0.5},${coords.lat+0.5}`,
        limit: 10
      },
      headers: {
        'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
      }
    });

    if (response.data.data && response.data.data.length > 0) {
      // 랜덤하게 이미지 선택
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      const image = response.data.data[randomIndex];
      
      const locationResponse = await axios.get(`${MAPILLARY_API_BASE}/${image.id}`, {
        params: {
          access_token: MAPILLARY_ACCESS_TOKEN,
          fields: 'geometry,computed_geometry'
        },
        headers: {
          'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
        }
      });

      const geometry = locationResponse.data.geometry || locationResponse.data.computed_geometry;
      
      return {
        imageId: image.id,
        lat: geometry.coordinates[1],
        lng: geometry.coordinates[0]
      };
    }
  } catch (error) {
    console.error('Error fetching location by region:', error);
  }
  
  // 실패 시 글로벌 랜덤 위치로 폴백
  return getRandomLocation();
}

// 이미지 정보 검증
async function validateImageId(imageId) {
  try {
    const response = await axios.get(`${MAPILLARY_API_BASE}/${imageId}`, {
      params: {
        access_token: MAPILLARY_ACCESS_TOKEN,
        fields: 'id,geometry'
      },
      headers: {
        'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
      }
    });

    return !!response.data;
  } catch (error) {
    console.error('Error validating image:', error);
    return false;
  }
}

module.exports = {
  getRandomLocation,
  getLocationByRegion,
  validateImageId
};