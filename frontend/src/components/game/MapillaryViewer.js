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
  const timerRef = useRef(null);
  const errorRetryCount = useRef(0);
  const navigate = useNavigate();

  // 토큰 유효성 확인 헬퍼 함수
  const isTokenValid = () => {
    const token = localStorage.getItem('mapillary_access_token');
    const expiresAt = localStorage.getItem('mapillary_token_expires_at');
    
    if (!token) {
      return false;
    }
    
    if (expiresAt) {
      const expiry = parseInt(expiresAt, 10);
      if (Date.now() > expiry) {
        return false;
      }
    }
    
    return true;
  };

  useEffect(() => {
    console.log('MapillaryViewer 마운트, imageId:', imageId);
    
    if (!imageId || !containerRef.current) {
      console.log('imageId 또는 컨테이너가 없습니다.');
      return;
    }

    // 로딩 상태 초기화
    setLoading(true);
    setError(null);
    
    // 이전 타이머 제거
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // 이전 뷰어 제거
    if (viewerRef.current) {
      try {
        viewerRef.current.remove();
        viewerRef.current = null;
      } catch (err) {
        console.error('이전 뷰어 제거 중 오류:', err);
      }
    }

    // 타임아웃 설정 - 20초 이내에 로드되지 않으면 오류 표시
    timerRef.current = setTimeout(() => {
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
      console.log('유효한 토큰이 없습니다. 인증 페이지로 이동합니다.');
      setError('Mapillary 인증이 필요하거나 만료되었습니다. 다시 로그인해주세요.');
      setLoading(false);
      clearTimeout(timerRef.current);
      
      // 현재 경로 저장
      localStorage.setItem('auth_return_path', window.location.pathname);
      return;
    }

    // 액세스 토큰 가져오기
    const accessToken = localStorage.getItem('mapillary_access_token');
    
    try {
      console.log('Mapillary Viewer 생성 시도:', {
        accessToken: accessToken.substring(0, 10) + '...',
        imageId
      });
      
      // 뷰어 옵션 - Bearer 토큰 사용
      const viewerOptions = {
        accessToken,
        container,
        imageId,
        component: {
          cover: true,
          direction: false,
          sequence: false,
          zoom: true
        }
      };
      
      // 새 뷰어 생성
      viewerRef.current = new Viewer(viewerOptions);
      
      // 이미지 로드 이벤트
      viewerRef.current.on('image', (e) => {
        console.log('Mapillary 이미지 로드 성공:', e.image.id);
        setLoading(false);
        clearTimeout(timerRef.current);
        errorRetryCount.current = 0; // 성공 시 재시도 카운트 초기화
        
        if (onImageLoad) {
          onImageLoad(e);
        }
      });

      // 에러 처리
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
          
          // 현재 경로 저장
          localStorage.setItem('auth_return_path', window.location.pathname);
          
          clearTimeout(timerRef.current);
          setLoading(false);
          return;
        }
        
        // 이미지 ID 오류인 경우 새 이미지 요청
        if (error.message && (
            error.message.includes('Non existent cover key') || 
            error.message.includes('not found')
          ) && errorRetryCount.current < 3) {
          setError(`이미지 ID ${imageId}를 찾을 수 없습니다. 다른 이미지를 시도합니다...`);
          errorRetryCount.current += 1;
          
          // 서버에 새 이미지 요청
          fetch('/api/mapillary/fallback-image')
            .then(response => response.json())
            .then(data => {
              if (data.imageId) {
                console.log(`새 이미지 ID로 재시도: ${data.imageId}`);
                // 부모 컴포넌트에 새 이미지 ID 전달
                if (onImageLoad) {
                  onImageLoad({ image: { id: data.imageId } });
                }
              }
            })
            .catch(err => {
              console.error('새 이미지 요청 실패:', err);
              setError('이미지를 로드할 수 없습니다. 페이지를 새로고침 해주세요.');
              setLoading(false);
            });
        } else {
          setError(`이미지를 로드할 수 없습니다: ${error.message || '알 수 없는 오류'}`);
          setLoading(false);
        }
        
        clearTimeout(timerRef.current);
      });

    } catch (error) {
      console.error('Mapillary 뷰어 초기화 오류:', error);
      setError(`초기화 오류: ${error.message}`);
      setLoading(false);
      clearTimeout(timerRef.current);
    }

    return () => {
      clearTimeout(timerRef.current);
      if (viewerRef.current) {
        try {
          viewerRef.current.remove();
          viewerRef.current = null;
        } catch (err) {
          console.error('뷰어 정리 중 오류:', err);
        }
      }
    };
  }, [imageId, onImageLoad, navigate, loading]);

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
                  onClick={() => {
                    // 서버에서 새 이미지 ID 요청
                    fetch('/api/mapillary/fallback-image')
                      .then(response => response.json())
                      .then(data => {
                        if (data.imageId) {
                          // 부모 컴포넌트에 새 이미지 ID 전달
                          if (onImageLoad) {
                            onImageLoad({ image: { id: data.imageId } });
                          }
                        }
                      })
                      .catch(err => {
                        console.error('새 이미지 요청 실패:', err);
                        // 페이지 새로고침
                        window.location.reload();
                      });
                  }}
                >
                  다른 이미지로 시도
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapillaryViewer;