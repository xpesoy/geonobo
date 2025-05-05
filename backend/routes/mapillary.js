// backend/routes/mapillary.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

// Mapillary OAuth 설정
const MAPILLARY_CLIENT_ID = process.env.MAPILLARY_CLIENT_ID || '9938378606184477';
const MAPILLARY_CLIENT_SECRET = process.env.MAPILLARY_CLIENT_SECRET; // .env 파일에 추가 필요
const REDIRECT_URI = process.env.CORS_ORIGIN + '/auth/mapillary/callback';

// 토큰 교환 엔드포인트
router.post('/token', async (req, res) => {
  console.log('토큰 요청 받음:', req.body);
  
  // req.body가 undefined인 경우 대비
  if (!req.body) {
    return res.status(400).json({ error: '요청 본문이 비어 있습니다.' });
  }
  
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: '인증 코드가 없습니다.' });
  }
  
  try {
    console.log('인증 코드로 토큰 요청 시도:', code.substring(0, 10) + '...');
    console.log('리디렉션 URI:', REDIRECT_URI);
    
    const response = await axios.post('https://graph.mapillary.com/token', {
      grant_type: 'authorization_code',
      client_id: MAPILLARY_CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `OAuth ${MAPILLARY_CLIENT_SECRET}`
      }
    });
    
    console.log('토큰 응답 성공:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('토큰 교환 오류:', error.response?.data || error.message);
    res.status(500).json({ 
      error: '인증 처리 중 오류가 발생했습니다.',
      details: error.response?.data || error.message
    });
  }
});

// 대체 이미지 엔드포인트 - 사용자 토큰 사용
router.get('/fallback-image', async (req, res) => {
  try {
    // 요청에서 토큰 가져오기
    const { accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: '액세스 토큰이 제공되지 않았습니다.',
        details: '요청 시 ?accessToken=YOUR_TOKEN 형식으로 토큰을 포함해주세요.' 
      });
    }
    
    console.log('Mapillary API 호출 시도 - 액세스 토큰:', accessToken.substring(0, 10) + '...');
    
    // 랜덤 파노라마 이미지 가져오기
    const response = await axios.get(`https://graph.mapillary.com/images`, {
      params: {
        access_token: accessToken,
        bbox: '-180,-85,180,85',
        is_pano: true,
        limit: 10
      }
    });
    
    console.log(`API 응답 받음, 데이터 개수: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      // 랜덤 선택
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      const image = response.data.data[randomIndex];
      
      console.log(`이미지 선택됨: ${image.id}`);
      
      // 위치 정보 가져오기
      const locationResponse = await axios.get(`https://graph.mapillary.com/${image.id}`, {
        params: {
          access_token: accessToken,
          fields: 'geometry,computed_geometry'
        }
      });
      
      const geometry = locationResponse.data.geometry || locationResponse.data.computed_geometry;
      
      res.json({
        imageId: image.id,
        lat: geometry?.coordinates[1] || 0,
        lng: geometry?.coordinates[0] || 0
      });
    } else {
      throw new Error('파노라마 이미지를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('대체 이미지 요청 오류:', error.message);
    console.error('요청 세부 정보:', error.config || '설정 정보 없음');
    console.error('응답 세부 정보:', error.response?.data || '응답 데이터 없음');
    
    // 더 자세한 에러 정보 클라이언트에 전달
    res.status(500).json({ 
      error: '대체 이미지를 가져오는데 실패했습니다.',
      message: error.message,
      details: error.response?.data
    });
  }
});

// 특정 위치에서 파노라마 이미지 가져오기
router.get('/panorama-near', async (req, res) => {
  try {
    const { lat, lng, radius = 10000, accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({ error: '액세스 토큰이 필요합니다.' });
    }
    
    if (!lat || !lng) {
      return res.status(400).json({ error: '위도(lat)와 경도(lng)가 필요합니다.' });
    }
    
    const latFloat = parseFloat(lat);
    const lngFloat = parseFloat(lng);
    const radiusFloat = parseFloat(radius);
    
    // 좌표 유효성 검사
    if (isNaN(latFloat) || isNaN(lngFloat) || Math.abs(latFloat) > 90 || Math.abs(lngFloat) > 180) {
      return res.status(400).json({ error: '유효하지 않은 좌표입니다.' });
    }
    
    const deltaLat = radiusFloat / 111000; // 위도 1도는 약 111km
    const deltaLng = radiusFloat / (111000 * Math.cos(latFloat * Math.PI / 180)); // 경도 보정
    
    // 위치에서 bbox 계산
    const bbox = `${lngFloat-deltaLng},${latFloat-deltaLat},${lngFloat+deltaLng},${latFloat+deltaLat}`;
    
    // 해당 지역의 파노라마 이미지 검색
    const response = await axios.get(`https://graph.mapillary.com/images`, {
      params: {
        access_token: accessToken,
        bbox: bbox,
        is_pano: true,
        limit: 10
      }
    });
    
    if (response.data.data && response.data.data.length > 0) {
      // 랜덤하게 선택
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      const image = response.data.data[randomIndex];
      
      // 위치 정보 가져오기
      const locationResponse = await axios.get(`https://graph.mapillary.com/${image.id}`, {
        params: {
          access_token: accessToken,
          fields: 'geometry,computed_geometry'
        }
      });
      
      const geometry = locationResponse.data.geometry || locationResponse.data.computed_geometry;
      
      res.json({
        imageId: image.id,
        lat: geometry?.coordinates[1] || 0,
        lng: geometry?.coordinates[0] || 0
      });
    } else {
      res.status(404).json({ error: '해당 지역에서 파노라마 이미지를 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('파노라마 이미지 검색 오류:', error);
    res.status(500).json({ error: '파노라마 이미지를 가져오는 중 오류가 발생했습니다.' });
  }
});

// 특정 국가/지역에서 파노라마 이미지 가져오기
router.get('/panorama-by-region', async (req, res) => {
  const regions = {
    korea: { lat: 37.5665, lng: 126.9780 },
    japan: { lat: 35.6762, lng: 139.6503 },
    usa: { lat: 40.7128, lng: -74.0060 },
    europe: { lat: 48.8566, lng: 2.3522 },
    australia: { lat: -33.8688, lng: 151.2093 }
  };
  
  const { region = 'korea', accessToken } = req.query;
  
  if (!accessToken) {
    return res.status(400).json({ error: '액세스 토큰이 필요합니다.' });
  }
  
  const coords = regions[region.toLowerCase()] || regions.korea;
  
  try {
    // 리디렉션
    const redirectUrl = `/api/mapillary/panorama-near?lat=${coords.lat}&lng=${coords.lng}&radius=50000&accessToken=${accessToken}`;
    res.redirect(redirectUrl);
  } catch (error) {
    res.status(500).json({ error: '리전 기반 이미지 요청 중 오류가 발생했습니다.' });
  }
});

// 특정 이미지 ID 검증
router.get('/validate-image', async (req, res) => {
  try {
    const { imageId, accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({ error: '액세스 토큰이 필요합니다.' });
    }
    
    if (!imageId) {
      return res.status(400).json({ error: '이미지 ID가 필요합니다.' });
    }
    
    // 이미지 ID 검증
    const response = await axios.get(`https://graph.mapillary.com/${imageId}`, {
      params: {
        access_token: accessToken,
        fields: 'id,is_pano'
      }
    });
    
    if (response.data && response.data.id) {
      res.json({
        valid: true,
        isPano: !!response.data.is_pano,
        details: response.data
      });
    } else {
      res.json({
        valid: false,
        message: '이미지 ID가 유효하지 않습니다.'
      });
    }
  } catch (error) {
    console.error('이미지 검증 오류:', error);
    res.status(500).json({ 
      valid: false,
      error: '이미지 ID 검증 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

module.exports = router;