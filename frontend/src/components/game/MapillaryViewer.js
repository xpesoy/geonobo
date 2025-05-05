// frontend/src/components/game/MapillaryViewer.js
import React, { useEffect, useRef } from 'react';
import { Viewer } from 'mapillary-js';

const MapillaryViewer = ({ imageId, onImageLoad }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!imageId || !containerRef.current) return;

    // 이전 뷰어 제거
    if (viewerRef.current) {
      viewerRef.current.remove();
    }

    // 컨테이너 초기화
    const container = containerRef.current;
    container.innerHTML = '';

    const viewerOptions = {
      accessToken: process.env.REACT_APP_MAPILLARY_ACCESS_TOKEN,
      container: container,
      imageId: imageId,
      component: {
        cover: false,
        bearing: false,
        cache: true,
        imageViewer: true,
        image: true,
        attribution: false,
        navigation: false,
        sequence: false,
        spatial: false,
        zoom: true,
        marker: false,
        tag: false,
        slider: false,
      }
    };

    try {
      viewerRef.current = new Viewer(viewerOptions);
      
      // 이미지 로드 이벤트 처리
      viewerRef.current.on('image', (e) => {
        if (onImageLoad) {
          onImageLoad(e);
        }
      });

      // 에러 처리
      viewerRef.current.on('error', (error) => {
        console.error('Mapillary viewer error:', error);
      });

    } catch (error) {
      console.error('Error creating Mapillary viewer:', error);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.remove();
      }
    };
  }, [imageId, onImageLoad]);

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
      {!imageId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-lg">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default MapillaryViewer;