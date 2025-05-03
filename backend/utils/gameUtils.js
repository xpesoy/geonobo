// frontend/src/utils/gameUtils.js

// 하버사인 공식으로 거리 계산 (km)
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  function toRad(deg) {
    return deg * (Math.PI/180);
  }
  
  // 추측이 제한 시간 내에 제출되었는지 확인
  export function isGuessValid(guessTime, roundStartTime, timeLimit = 90000) {
    return guessTime - roundStartTime <= timeLimit;
  }
  
  // 점수 계산
  export function calculateScore(distance) {
    // 거리가 0km에 가까울수록 높은 점수
    const maxScore = 5000;
    const score = Math.max(0, Math.round(maxScore - distance * 10));
    return score;
  }
  
  // 순위 이모지 반환
  export function getRankEmoji(rank) {
    const emojis = {
      1: '🥇',
      2: '🥈',
      3: '🥉'
    };
    return emojis[rank] || '';
  }
  
  // 시간 포맷팅
  export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // 거리 포맷팅
  export function formatDistance(distance) {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }