// frontend/src/components/game/MapillaryAuth.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MapillaryAuth = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // URL에서 코드 파라미터 추출
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      setError(`인증 오류: ${errorParam}`);
      setLoading(false);
      return;
    }
    
    if (code) {
      console.log('인증 코드 확인됨. 토큰 요청 중...');
      
      // 서버에 코드 전송하여 액세스 토큰 요청
      fetch('/api/mapillary/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(`서버 응답 오류: ${err.error || response.statusText}`);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.access_token) {
          console.log('액세스 토큰 받음:', data.access_token.substring(0, 10) + '...');
          
          // 로컬 스토리지에 액세스 토큰 저장
          localStorage.setItem('mapillary_access_token', data.access_token);
          
          // 토큰 만료 시간 저장 (만료 시간이 제공된 경우)
          if (data.expires_in) {
            const expiresAt = Date.now() + (data.expires_in * 1000);
            localStorage.setItem('mapillary_token_expires_at', expiresAt.toString());
          }
          
          setLoading(false);
          
          // 로비 페이지 또는 이전 페이지로 리디렉션
          const returnPath = localStorage.getItem('auth_return_path') || '/lobby';
          localStorage.removeItem('auth_return_path');
          navigate(returnPath);
        } else {
          throw new Error('액세스 토큰이 응답에 포함되지 않았습니다.');
        }
      })
      .catch(error => {
        console.error('토큰 요청 오류:', error);
        setError(`Mapillary 인증에 실패했습니다: ${error.message}`);
        setLoading(false);
      });
    } else {
      // 코드가 없는 경우 로그인 페이지를 표시
      setLoading(false);
    }
  }, [location.search, navigate]);

  // 로그인 페이지로 리디렉션
  const handleLogin = () => {
    // 현재 경로 저장
    const currentPath = location.pathname !== '/auth/mapillary/callback' 
      ? location.pathname 
      : '/lobby';
    localStorage.setItem('auth_return_path', currentPath);
    
    // OAuth 2.0 인증 요청 파라미터 설정
    const clientId = '9938378606184477';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/mapillary/callback');
    const scope = 'user:read';
    const responseType = 'code';
    
    // 인증 URL로 리디렉션
    const authUrl = `https://graph.mapillary.com/connect?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}`;
    window.location.href = authUrl;
  };

  // 토큰 상태 확인 헬퍼 함수
  const checkTokenStatus = () => {
    const token = localStorage.getItem('mapillary_access_token');
    const expiresAt = localStorage.getItem('mapillary_token_expires_at');
    
    if (!token) {
      return '인증 필요';
    }
    
    if (expiresAt) {
      const expiry = parseInt(expiresAt, 10);
      if (Date.now() > expiry) {
        return '토큰 만료됨';
      }
      
      // 만료까지 남은 시간 계산
      const remainingTime = Math.floor((expiry - Date.now()) / 1000 / 60); // 분 단위
      return `인증됨 (${remainingTime}분 남음)`;
    }
    
    return '인증됨';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-lg">인증 처리 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">Mapillary 인증</h1>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p className="font-bold">인증 오류</p>
            <p>{error}</p>
          </div>
        )}
        
        <div className="mb-6">
          <p className="text-center mb-2">
            360° 파노라마 이미지를 사용하여 게임을 즐기려면 Mapillary 인증이 필요합니다.
          </p>
          <p className="text-sm text-gray-600 text-center">
            현재 상태: <span className="font-medium">{checkTokenStatus()}</span>
          </p>
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={handleLogin}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            Mapillary로 로그인
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <button 
            onClick={() => navigate('/lobby')}
            className="text-blue-500 hover:underline"
          >
            인증 없이 로비로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapillaryAuth;