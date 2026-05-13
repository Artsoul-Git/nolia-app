// =============================================
// biorhythm.js — バイオサイクル計算
// =============================================

const Biorhythm = {

  // 3サイクルの周期（日）
  CYCLES: { physical: 23, emotional: 28, vitality: 33 },

  // フェーズ別UI定義
  PHASES: {
    peak:    { label: '好調期',  icon: '⭐', color: '#F6AD55', bg: '#FFFBEB' },
    rising:  { label: '上昇期',  icon: '🌱', color: '#38A169', bg: '#F0FFF4' },
    falling: { label: '調整期',  icon: '🍃', color: '#E53E3E', bg: '#FFF5F5' },
    low:     { label: '充電期',  icon: '💙', color: '#3182CE', bg: '#EBF8FF' },
  },

  // フェーズ別メッセージ（体重増加への文脈を提供）
  MESSAGES: {
    physical: {
      peak:    '体力絶好調！運動しやすい最高の時期です✨',
      rising:  '体力が上がってきています。少し動いてみましょう',
      falling: '体が休みたがっています。無理は禁物です',
      low:     'サプリで栄養補給して体を充電する時期',
    },
    emotional: {
      peak:    '気分爽快！前向きな気持ちが続いています',
      rising:  'メンタルが回復してきています',
      falling: '少し感情が揺れやすい時期。食欲に注意を',
      low:     'メンタル充電中。焦らずゆっくりいきましょう',
    },
    vitality: {
      peak:    'エネルギーMAX！サプリの効果を感じやすい時期',
      rising:  'エネルギーが回復してきました',
      falling: 'エネルギーが落ち着く時期。体重変化もリズムのひとつ',
      low:     '次の好調期に向けて体が準備しています',
    },
  },

  // 値からフェーズを判定（-1〜+1）
  getPhase(value) {
    if (value > 0.5)  return 'peak';
    if (value > 0)    return 'rising';
    if (value > -0.5) return 'falling';
    return 'low';
  },

  // 生年月日から今日のバイオサイクルを計算
  calc(birthdate, targetDate = new Date()) {
    const birth = new Date(birthdate);
    const days = Math.floor((targetDate - birth) / 86400000);

    const result = {};
    for (const [key, period] of Object.entries(this.CYCLES)) {
      const value = Math.sin(2 * Math.PI * days / period);
      const phase = this.getPhase(value);
      result[key] = {
        value,
        score: Math.round((value + 1) * 50), // 0〜100点に変換
        phase,
        phaseInfo: this.PHASES[phase],
        message: this.MESSAGES[key][phase],
      };
    }

    // 総合フェーズ（3つの平均）
    const avgValue = (result.physical.value + result.emotional.value + result.vitality.value) / 3;
    result.overall = {
      value: avgValue,
      score: Math.round((avgValue + 1) * 50),
      phase: this.getPhase(avgValue),
      phaseInfo: this.PHASES[this.getPhase(avgValue)],
    };

    return result;
  },

  // 体重変化への解説文を生成（レポート用）
  getWeightComment(weightChange, vitalityPhase) {
    if (weightChange > 0) {
      if (vitalityPhase === 'falling' || vitalityPhase === 'low') {
        return `体重が${weightChange.toFixed(1)}kg増えていますが、今はバイオサイクル的にエネルギーが落ち着く時期。体重増加はリズムのひとつです。焦らず続けることが大切💪`;
      }
      return `体重が少し増えていますが、日々の変動は自然なこと。サプリを続けていれば大丈夫です！`;
    }
    if (weightChange < 0) {
      return `体重が${Math.abs(weightChange).toFixed(1)}kg減りました！バイオサイクルも追い風です。この調子で続けていきましょう🌱`;
    }
    return `体重はキープできています。変化がない日も体の内側では着実に変化が起きています`;
  },
};
