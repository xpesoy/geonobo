// backend/utils/mapillaryUtils.js
const axios = require('axios');
const { MAPILLARY_ACCESS_TOKEN } = process.env;

// Mapillary API endpoints
const MAPILLARY_API_BASE = 'https://graph.mapillary.com';

// 랜덤 위치에서 이미지 가져오기 - 파노라마만 필터링
async function getRandomLocation() {
  try {
    // 랜덤 좌표 생성 (전 세계)
    const lat = (Math.random() * 170) - 85; // -85 ~ 85
    const lng = (Math.random() * 360) - 180; // -180 ~ 180
    
    console.log(`랜덤 좌표 생성: 위도 ${lat}, 경도 ${lng}`);
    
    // 주변 이미지 검색 - 파노라마 이미지만 가져오기
    const response = await axios.get(`${MAPILLARY_API_BASE}/images`, {
      params: {
        access_token: MAPILLARY_ACCESS_TOKEN,
        bbox: `${lng-1.0},${lat-1.0},${lng+1.0},${lat+1.0}`, // 더 넓은 범위로 검색
        is_pano: true, // 파노라마 이미지만 필터링
        limit: 10 // 더 많은 이미지를 가져와서 랜덤 선택
      },
      headers: {
        'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
      }
    });

    console.log('API 응답 받음:', response.data);

    if (response.data.data && response.data.data.length > 0) {
      // 가져온 이미지 중 랜덤 선택
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      const image = response.data.data[randomIndex];
      console.log('선택된 이미지:', image.id);
      
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
      console.log('이미지가 없어 재시도합니다.');
      // 이미지가 없으면 재귀적으로 다시 시도
      return getRandomLocation();
    }
  } catch (error) {
    console.error('Error fetching random location:', error);
    
    // 에러 발생 시 다른 위치에서 재시도
    console.log('에러 발생으로 다른 위치에서 재시도합니다.');
    return getRandomLocation();
  }
}

// 특정 지역에서 이미지 가져오기 - 파노라마만 필터링
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
        is_pano: true, // 파노라마 이미지만 필터링
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
        fields: 'id,geometry,is_pano'
      },
      headers: {
        'Authorization': `OAuth ${MAPILLARY_ACCESS_TOKEN}`
      }
    });

    return !!response.data && response.data.is_pano === true;
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