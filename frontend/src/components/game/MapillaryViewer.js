// frontend/src/components/game/MapillaryViewer.js
import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from 'mapillary-js';
import { useNavigate } from 'react-router-dom';
import 'mapillary-js/dist/mapillary.css';

const MapillaryViewer = ({ imageId, onImageLoad }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef(null);
  const currentImageIdRef = useRef(null); // 현재 로드된 이미지 ID 추적
  const navigate = useNavigate();

  // 토큰 유효성 확인 헬퍼 함수
  const isTokenValid = () => {
    const token = localStorage.getItem('mapillary_access_token');
    const expiresAt = localStorage.getItem('mapillary_token_expires_at');
    
    if (!token) {
      console.log('토큰이 없습니다.');
      return false;
    }
    
    if (expiresAt) {
      const expiry = parseInt(expiresAt, 10);
      if (Date.now() > expiry) {
        console.log('토큰이 만료되었습니다.');
        return false;
      }
    }
    
    console.log('유효한 토큰이 있습니다.');
    return true;
  };

  // 이미지 로드 실패 시 새 이미지 요청 로직
  const requestNewImage = () => {
    console.log('새 이미지 요청 중...');
    
    // 로컬 스토리지에서 액세스 토큰 가져오기
    const accessToken = localStorage.getItem('mapillary_access_token');
    
    if (!accessToken) {
      console.error('인증 토큰이 없습니다.');
      setError('Mapillary 인증이 필요합니다.');
      setLoading(false);
      return;
    }
    
    // 서버에서 새 이미지 요청
    fetch(`http://localhost:5000/api/mapillary/fallback-image?accessToken=${encodeURIComponent(accessToken)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.imageId) {
          console.log(`새 이미지 ID로 재시도: ${data.imageId}`);
          // 부모 컴포넌트에 새 이미지 ID 전달
          if (onImageLoad) {
            onImageLoad({ image: { id: data.imageId } });
          }
        } else {
          throw new Error('서버에서 유효한 이미지 ID를 제공하지 않았습니다.');
        }
      })
      .catch(err => {
        console.error('새 이미지 요청 실패:', err);
        setError('새 이미지를 가져올 수 없습니다. 페이지를 새로고침 해주세요.');
        setLoading(false);
      });
  };

  // 뷰어 초기화 함수
  const initializeViewer = () => {
    if (!containerRef.current || !imageId) {
      console.log('컨테이너나 이미지 ID가 없습니다.');
      return;
    }
    
    // 이미 로드된 동일한 이미지라면 재로드 방지
    if (viewerRef.current && currentImageIdRef.current === imageId) {
      console.log('이미 로드된 이미지입니다:', imageId);
      return;
    }
    
    // 로딩 상태 설정
    setLoading(true);
    setError(null);
    
    // 이전 타이머 정리
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 이전 뷰어 제거
    if (viewerRef.current) {
      console.log('이전 뷰어 제거 중...');
      try {
        viewerRef.current.remove();
        viewerRef.current = null;
      } catch (err) {
        console.error('이전 뷰어 제거 중 오류:', err);
      }
    }
    
    // 타임아웃 설정
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        setError('이미지 로딩 시간이 초과되었습니다. 네트워크 연결을 확인하거나 다시 시도해주세요.');
        setLoading(false);
      }
    }, 20000);
    
    // 컨테이너 초기화
    const container = containerRef.current;
    container.innerHTML = '';
    
    // 토큰 유효성 확인
    if (!isTokenValid()) {
      console.log('유효한 토큰이 없습니다.');
      setError('Mapillary 인증이 필요하거나 만료되었습니다. 다시 로그인해주세요.');
      setLoading(false);
      clearTimeout(timeoutRef.current);
      localStorage.setItem('auth_return_path', window.location.pathname);
      return;
    }
    
    // 액세스 토큰 가져오기
    const accessToken = localStorage.getItem('mapillary_access_token');
    
    try {
      console.log('새 뷰어 생성 중, 이미지 ID:', imageId);
      
      // 뷰어 옵션
      const viewerOptions = {
        accessToken,
        container,
        imageId
      };
      
      // 뷰어 생성
      viewerRef.current = new Viewer(viewerOptions);
      currentImageIdRef.current = imageId;
      
      // 이미지 로드 이벤트
      viewerRef.current.on('image', (event) => {
        console.log('이미지 로드됨:', event.image.id);
        setLoading(false);
        clearTimeout(timeoutRef.current);
        
        if (onImageLoad) {
          onImageLoad(event);
        }
      });
      
      // 에러 이벤트
      viewerRef.current.on('error', (error) => {
        console.error('Mapillary 에러:', error);
        
        // 인증 오류 처리
        if (error.message && (
            error.message.includes('OAuthException') || 
            error.message.includes('Invalid OAuth') ||
            error.message.includes('access_token')
          )) {
          console.log('OAuth 인증 오류 발생');
          setError('Mapillary 인증이 만료되었습니다. 다시 로그인해주세요.');
          localStorage.removeItem('mapillary_access_token');
          localStorage.removeItem('mapillary_token_expires_at');
          
          clearTimeout(timeoutRef.current);
          setLoading(false);
          return;
        }
        
        // 기타 오류 처리
        setError(`이미지를 로드할 수 없습니다: ${error.message || '알 수 없는 오류'}`);
        setLoading(false);
        clearTimeout(timeoutRef.current);
      });
      
    } catch (error) {
      console.error('Mapillary 뷰어 초기화 오류:', error);
      setError(`초기화 오류: ${error.message}`);
      setLoading(false);
      clearTimeout(timeoutRef.current);
    }
  };

  // 이미지 ID가 변경되면 뷰어 초기화
  useEffect(() => {
    console.log('imageId 변경됨:', imageId);
    if (imageId) {
      initializeViewer();
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (viewerRef.current) {
        try {
          viewerRef.current.remove();
          viewerRef.current = null;
        } catch (err) {
          console.error('뷰어 정리 중 오류:', err);
        }
      }
    };
  }, [imageId]); // imageId만 의존성으로 설정

  const handleAuth = () => {
    localStorage.setItem('auth_return_path', window.location.pathname);
    navigate('/auth/mapillary/callback');
  };

  return (
    <div className="h-full w-full relative">
      <div 
        ref={containerRef} 
        className="h-full w-full"
        style={{ 
          background: '#000',
          position: 'relative'
        }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-center">
            <svg className="animate-spin h-10 w-10 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mb-1">360° 파노라마 로딩 중...</p>
            <p className="text-sm opacity-75">이미지 ID: {imageId}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <p className="font-bold">이미지 로드 오류</p>
            <p className="text-sm">{error}</p>
            <p className="text-sm mt-2">이미지 ID: {imageId}</p>
            {error.includes('인증') ? (
              <div className="mt-4 text-center">
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm"
                  onClick={handleAuth}
                >
                  Mapillary 인증하기
                </button>
              </div>
            ) : (
              <div className="mt-4 text-center">
                <button 
                  className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded text-sm"
                  onClick={requestNewImage}
                >
                  다른 이미지로 시도
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!loading && !error && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-center">
          <div className="bg-black bg-opacity-50 text-white text-sm px-3 py-1 rounded-lg">
            <p>마우스 드래그로 360° 회전, 마우스 휠로 확대/축소</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapillaryViewer;