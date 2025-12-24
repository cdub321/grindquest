import { useEffect, useRef, useState } from 'react';
import EqIcon from './EqIcon';
import GemIcon, { GEM_CONFIG } from './GemIcon';

export default function CombatConsole({
  currentMob,
  mobHp,
  mobEffects = [],
  toggleAutoAttack,
  isAutoAttack,
  abilitySlots = [],
  spellSlots = [],
  knownAbilities = [],
  knownSpells = [],
  level = 1,
  characterName = '',
  hp,
  maxHp,
  mana,
  maxMana,
  endurance,
  maxEndurance,
  playerClass,
  // Interaction handled elsewhere; combat-only UI
  onAssignAbility = () => {},
  onAssignSpell = () => {},
  onClearAbility = () => {},
  onClearSpell = () => {},
  onUseSkill,
  cooldowns = {},
  now = Date.now(),
  combatLog = [],
  inCombat = false,
  castingState = null,
  effects = [],
  isSitting = false
}) {
  const logRef = useRef(null);
  const [showConfig, setShowConfig] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const FLEE_COOLDOWN_MS = 60000;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combatLog]);

  useEffect(() => {
    setPortraitFailed(false);
  }, [currentMob?.id, currentMob?.name]);

  const getEffectIcon = (skill) => {
    if (!skill) return null;
    return skill.spellIconIndex ?? skill.iconIndex ?? skill.spellicon ?? skill.icon ?? null;
  };

  const getGemIcon = (skill) => {
    if (!skill) return null;
    return skill.gemIconIndex ?? skill.gemicon ?? getEffectIcon(skill);
  };

  const getSegmentSize = (maxValue) => {
    if (!maxValue || maxValue <= 0) return 0;
    if (maxValue <= 100) return 10;
    if (maxValue <= 250) return 25;
    if (maxValue <= 500) return 50;
    if (maxValue <= 2000) return 100;
    if (maxValue <= 5000) return 200;
    if (maxValue <= 10000) return 500;
    return 1000;
  };

  const renderSegmentOverlay = (maxValue, options = {}) => {
    const size = getSegmentSize(maxValue);
    if (!size || size >= maxValue) return null;
    const segmentPct = (size / maxValue) * 100;
    const lineWidth = options.lineWidth ?? 2;
    const color = options.color ?? 'rgba(0,0,0,0.85)';
    const opacity = options.opacity ?? 0.8;
    const segments = Math.floor(maxValue / size);

    const lines = [];
    for (let i = 1; i <= segments; i++) {
      const pct = Math.min(100, segmentPct * i);
      if (pct >= 100) continue; // Skip drawing on the far right edge
      lines.push(
        <div
          key={`seg-${i}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(${pct}% - ${lineWidth / 2}px)`,
            width: lineWidth,
            background: color
          }}
        />
      );
    }

    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: options.mixBlendMode || 'normal',
          opacity,
          zIndex: 2
        }}
      >
        {lines}
      </div>
    );
  };

  const handleAbilityChange = (slotIdx, val) => {
    if (!val) {
      onClearAbility(slotIdx);
      return;
    }
    onAssignAbility(slotIdx, val);
  };

  const handleSpellChange = (slotIdx, val) => {
    if (!val) {
      onClearSpell(slotIdx);
      return;
    }
    onAssignSpell(slotIdx, val);
  };

  const renderConfigRow = (slotIdx, skill, options, onChange, onClear, isSpell = false) => {
    const until = skill ? (cooldowns[skill.id] || 0) : 0;
    const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
    const isReady = remaining === 0;
    const effectIcon = getEffectIcon(skill);
    return (
      <div
        key={`slot-${isSpell ? 'spell' : 'ability'}-${slotIdx}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 28px 1fr auto auto',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 6px',
          marginBottom: '2px',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px'
        }}
        >
          <div style={{ fontSize: '11px', color: '#d6c18a' }}>{isSpell ? 'Spell' : 'Skill'} {slotIdx}</div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {skill && typeof effectIcon === 'number' ? (
            <EqIcon index={effectIcon} size={24} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          ) : null}
          </div>
        <select
          value={skill?.id || ''}
          onChange={(e) => onChange(slotIdx, e.target.value)}
          style={{
            width: '100%',
            background: '#1f1b18',
            color: '#f5e9d7',
            border: '1px solid #5b4937',
            padding: '2px 4px',
            fontSize: '12px'
          }}
        >
          <option value="">Empty</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
        <div style={{ fontSize: '11px', color: '#c2b59b', textAlign: 'center' }}>
          {skill ? (isReady ? 'Ready' : `${remaining}s`) : ''}
        </div>
        <button
          className="btn warn"
          onClick={() => onClear(slotIdx)}
          disabled={!skill}
          style={{ padding: '3px 6px', fontSize: '11px' }}
        >
          Clear
        </button>
      </div>
    );
  };

  const abilityOptions = (knownAbilities || []).map((a) => ({ id: a.id, name: a.name }));
  const spellOptions = (knownSpells || []).map((s) => ({ id: s.id, name: s.name }));

  const totalSpellSlots = [...spellSlots];
  while (totalSpellSlots.length < 6) totalSpellSlots.push(null);
  const totalAbilitySlots = [...abilitySlots];
  while (totalAbilitySlots.length < 6) totalAbilitySlots.push(null);
  const displayPlayerName = (characterName || '').trim() || 'Unnamed';

  const primarySpellSlots = totalSpellSlots.slice(0, 6);
  const allAbilitySlots = totalAbilitySlots.slice(0, 6);

  const getConInfo = () => {
    if (!currentMob) return null;
    const mobLevel = Number(currentMob.level);
    if (!Number.isFinite(mobLevel)) {
      throw new Error('Mob level missing or invalid');
    }
    const diff = mobLevel - level;
    if (diff >= 8) return { label: 'Maroon', color: '#4a041b' };
    if (diff >= 4) return { label: 'Red', color: '#b91c1c' };
    if (diff >= 1) return { label: 'Yellow', color: '#f59e0b' };
    if (diff === 0) return { label: 'White', color: '#e5e7eb' };
    if (diff >= -3) return { label: 'Blue', color: '#3b82f6' };
    if (diff >= -5) return { label: 'L. Blue', color: '#60a5fa' };
    if (diff >= -8) return { label: 'Green', color: '#10b981' };
    return { label: 'Gray', color: '#9ca3af' };
  };
  const con = getConInfo();
  const getMobPortrait = (mob) => {
    if (!mob) return null;
    const race = mob.race_id ?? mob.raceId ?? 1;
    const gender = mob.gender ?? 0;
    const texture = mob.texture_id ?? mob.textureId ?? 1;
    return `/stone-ui/raceimages/${race}_${gender}_${texture}_0.jpg`;
  };

  const mobPortraitSrc = currentMob ? getMobPortrait(currentMob) : null;
  const fallbackPortrait = '/stone-ui/raceimages/0_0_1_0.jpg';

  const renderUseButton = (skill, onUse, onClear, isSpell = false) => {
    const until = skill ? (cooldowns[skill.id] || 0) : 0;
    const remainingMs = until > now ? until - now : 0;
    const remaining = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
    const isReady = remaining === 0;
    const isCasting = castingState?.skillId === skill?.id;
    const castProgress = (() => {
      if (!isCasting || !castingState?.durationMs) return 0;
      const pct = 1 - Math.max(0, (castingState.endsAt - now) / castingState.durationMs);
      return Math.max(0, Math.min(1, pct));
    })();
    const isFlee = skill?.id === 'builtin-flee';
    const isAttack = skill?.id === 'builtin-attack';
    const isDisabledByAutoAttack = isAttack && isAutoAttack;
    const fleeCooldownPct = isFlee && remainingMs > 0 ? Math.max(0, Math.min(1, (FLEE_COOLDOWN_MS - remainingMs) / FLEE_COOLDOWN_MS)) : 0;
    const manaCost = skill?.mana || 0;
    const endCost = skill?.endurance || 0;
    const castMs = skill?.cast_time || 0;
    const castLabel = castMs ? `${(castMs / 1000).toFixed(1)}s cast` : 'Instant';
    const effectType = skill?.effect_type || skill?.effectType || skill?.effect?.type;
    const dmgLabel = (() => {
      if (!effectType) return '';
      if (effectType === 'damage' || effectType === 'nuke') return `Damage: ${skill?.base_hp ?? 0}`;
      if (effectType === 'dot') return `DoT: ${skill?.tick_hp ?? skill?.base_hp ?? 0} x${skill?.duration_seconds || 0}`;
      if (effectType === 'heal') return `Heal: ${skill?.base_hp ?? 0}`;
      if (effectType === 'hot') return `HoT: ${skill?.tick_hp ?? skill?.base_hp ?? 0} x${skill?.duration_seconds || 0}`;
      if (effectType === 'manadrain') return `Drain Mana: ${skill?.base_mana ?? 0}`;
      if (effectType === 'enddrain') return `Drain End: ${skill?.base_endurance ?? 0}`;
      if (effectType === 'manarestore') return `Restore Mana: ${skill?.base_mana ?? 0}`;
      if (effectType === 'endrestore') return `Restore End: ${skill?.base_endurance ?? 0}`;
      if (effectType === 'buff') return 'Buff';
      if (effectType === 'debuff') return 'Debuff';
      return '';
    })();
    const tooltipParts = [
      skill?.name,
      manaCost ? `Mana: ${manaCost}` : null,
      endCost ? `End: ${endCost}` : null,
      castLabel,
      dmgLabel
    ].filter(Boolean);
    const title = tooltipParts.join(' | ');
    const isAutoToggle = !isSpell && skill?.id === 'builtin-auto' && isAutoAttack;
    const bgImage = isSpell
      ? "/stone-ui/ui/spellempty.png"
      : isAutoToggle
        ? "/stone-ui/ui/hotkeydown.png"
        : (skill ? "/stone-ui/ui/hotkeyup.png" : "/stone-ui/ui/hotkeyslot.png");
    const slotClass = isSpell ? 'spell-slot' : 'hotkey-slot';
    const isCoreAction = ['builtin-attack', 'builtin-ranged', 'builtin-sit', 'builtin-meditate'].includes(skill?.id);
    const classNames = [slotClass, skill ? 'has-skill' : 'hotkey-empty', isCoreAction ? 'hotkey-slot--core' : '']
      .filter(Boolean)
      .join(' ');
    const displayName = skill?.id === 'builtin-sit'
      ? (isSitting ? 'Stand' : 'Sit')
      : skill?.name;

    const slotHeight = isSpell ? 48 : (isCoreAction ? 24 : 48);
    const slotPadding = isCoreAction ? 2 : 4;
    const effectIcon = getEffectIcon(skill);
    const gemIcon = getGemIcon(skill);

    return (
      <button
        className={classNames}
        style={{
          height: slotHeight,
          width: 48,
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: isCoreAction ? '100% 100%' : 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
          padding: slotPadding,
          filter: isCasting ? 'grayscale(0.7) brightness(0.85)' : (isFlee && !isReady ? 'grayscale(0.9) brightness(0.7)' : (isDisabledByAutoAttack ? 'grayscale(0.8) brightness(0.6)' : undefined)),
          boxShadow: isCasting
            ? '0 0 10px rgba(255,255,255,0.35) inset, 0 0 6px rgba(120,200,255,0.4)'
            : (isFlee && !isReady ? '0 0 6px rgba(200,120,60,0.4) inset' : undefined),
          transition: 'filter 120ms linear, box-shadow 120ms linear'
        }}
        onClick={() => skill && isReady && !isCasting && !isDisabledByAutoAttack && onUse(skill)}
        onDoubleClick={() => skill && onClear()}
        disabled={!skill || !isReady || isCasting || isDisabledByAutoAttack}
        title={isDisabledByAutoAttack ? 'Auto-attack is active' : (skill ? title : 'Empty')}
      >
        {!isSpell && skill && typeof effectIcon === 'number' ? (
          <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <EqIcon index={effectIcon} size={30} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          </div>
        ) : null}
        {isSpell && skill && typeof gemIcon === 'number' ? (
          <div
            className="gem-icon-wrap"
            style={{
              position: 'absolute',
              top: 9,
              left: '9%',
              pointerEvents: 'none',
              overflow: 'hidden',
              width: GEM_CONFIG.defaultWidth,
              height: GEM_CONFIG.defaultHeight
            }}
          >
            <GemIcon
              index={gemIcon}
            />
          </div>
        ) : null}
        {!isSpell && skill && (
          <div className="hotkey-slot__label">{isCasting ? 'Casting...' : displayName}</div>
        )}
        {skill && !isReady && <div className="hotkey-slot__cd">{remaining}s</div>}
        {isFlee && !isReady && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: 4,
              height: 5,
              borderRadius: 3,
              background: 'rgba(0,0,0,0.4)',
              overflow: 'hidden',
              boxShadow: '0 0 4px rgba(200,120,60,0.5)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${fleeCooldownPct * 100}%`,
                background: 'linear-gradient(90deg, rgba(255,200,120,0.4), rgba(255,200,120,0.85))',
                transition: 'width 100ms linear'
              }}
            />
          </div>
        )}
        {skill && isCasting && (
          <div
            style={{
              position: 'absolute',
              inset: 2,
              background: 'linear-gradient(135deg, rgba(0,20,40,0.45), rgba(0,0,0,0.5))',
              borderRadius: 6,
              pointerEvents: 'none'
            }}
          />
        )}
        {skill && isCasting && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              bottom: 4,
              height: 6,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
              boxShadow: '0 0 6px rgba(120,200,255,0.45)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${castProgress * 100}%`,
                background: 'linear-gradient(90deg, rgba(120,200,255,0.3), rgba(120,200,255,0.85))',
                transition: 'width 80ms linear'
              }}
            />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="console">
      <div className="console-top">
        <div className="console-mob">
          {currentMob ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div
                style={{
                  border: con ? `2px solid ${con.color}` : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '6px',
                  display: 'grid',
                  gap: '6px',
                  boxShadow: con ? `0 0 8px ${con.color}` : 'none',
                  animation: inCombat && con ? 'con-blink 1s ease-in-out infinite' : 'none',
                  '--con-color': con?.color || 'rgba(255,255,255,0.6)'
                }}
              >
                <div
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    borderRadius: '6px',
                    height: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#c2b59b',
                    fontSize: 12,
                    textAlign: 'center',
                    padding: '6px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  {mobPortraitSrc && !portraitFailed ? (
                    <img
                      src={mobPortraitSrc}
                      alt={currentMob.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px', transform: 'scale(0.85)' }}
                      onError={(e) => {
                        if (portraitFailed) return;
                        setPortraitFailed(true);
                        e.target.src = fallbackPortrait;
                      }}
                  />
                ) : (
                  <div style={{ opacity: 0.8 }}>
                    Mob art unavailable
                    {mobPortraitSrc ? ` (${mobPortraitSrc.split('/').pop()})` : ''}
                  </div>
                )}
                  {mobEffects.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 6,
                        right: 6,
                        bottom: 6,
                        display: 'flex',
                        gap: '4px',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        background: 'rgba(0,0,0,0.35)',
                        padding: '4px 6px',
                        borderRadius: 4,
                        backdropFilter: 'blur(2px)'
                      }}
                    >
                      {mobEffects.map((fx) => {
                        const timeLeft = fx.expiresAt ? Math.max(0, Math.ceil((fx.expiresAt - Date.now()) / 1000)) : 0;
                        return (
                          <div
                            key={fx.id || fx.name}
                            style={{ position: 'relative', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title={fx.name || ''}
                          >
                            <EqIcon
                              index={fx.iconIndex || fx.icon || 0}
                              size={20}
                              cols={6}
                              rows={6}
                              sheet="/stone-ui/spellicons/spells1.png"
                            />
                            {timeLeft > 0 && (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: -4,
                                  right: -4,
                                  background: '#000',
                                  color: '#f5e9d7',
                                  fontSize: 8,
                                  padding: '0 2px',
                                  borderRadius: 3,
                                  lineHeight: 1.1
                                }}
                              >
                                {timeLeft}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>
                      {inCombat && <span style={{ marginRight: 6 }}>⚔️</span>}
                      {currentMob.name}
                      {currentMob.isNamed && <span className="mob-tag" style={{ marginLeft: 6 }}>NAMED</span>}
                    </span>
                    <span>{mobHp} / {currentMob.hp}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (mobHp / currentMob.hp) * 100))}%` }}
                    />
                    {renderSegmentOverlay(currentMob.hp, { color: 'rgba(0,0,0,0.9)', opacity: 0.85, lineWidth: 2 })}
                  </div>
                </div>

                {currentMob && (currentMob.mana || currentMob.endurance) ? (() => {
                  const hasMana = currentMob.mana && currentMob.mana > 0;
                  const maxVal = hasMana ? currentMob.mana : currentMob.endurance || 0;
                  const label = hasMana ? 'Mana' : 'Endurance';
                  const currentVal = maxVal; // placeholder until mob resource spend is implemented
                  const pct = maxVal > 0 ? Math.max(0, Math.min(100, (currentVal / maxVal) * 100)) : 0;
                  const barColor = hasMana ? '#3b82f6' : '#ffb637ff';
                  return (
                    <div className="console-bar">
                      <div className="console-bar__track">
                        <div
                          className="console-bar__fill"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor})` }}
                        />
                        {renderSegmentOverlay(maxVal, { color: 'rgba(0,0,0,0.9)', opacity: 0.85, lineWidth: 2 })}
                      </div>
                    </div>
                  );
                })() : null}

              </div>
              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px',
                  display: 'grid',
                }}
              >
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>{displayPlayerName}</span>
                    <span>{hp} / {maxHp}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                    />
                    {renderSegmentOverlay(maxHp, { color: 'rgba(0,0,0,0.9)', opacity: 0.85, lineWidth: 2 })}
                  </div>
                </div>
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span></span>
                    <span>{playerClass.isCaster ? `${mana} / ${maxMana}` : `${endurance} / ${maxEndurance}`}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (playerClass.isCaster ? (mana / maxMana) : (endurance / maxEndurance)) * 100))}%`,
                        background: playerClass.isCaster ? 'linear-gradient(90deg, #3b82f6, #3b82f6)' : 'linear-gradient(90deg, #ffb637ff, #f59e0b)'
                      }}
                    />
                    {renderSegmentOverlay(playerClass.isCaster ? maxMana : maxEndurance, {
                      color: 'rgba(0,0,0,0.9)',
                      opacity: 0.85,
                      lineWidth: 2
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="console-empty">No target</div>
          )}
        </div>

        <div className="console-skills">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '18px',
              alignItems: 'start'
            }}
          >
            {/* Left column: primary spells (6) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '46px',
                gap: '1px',
                justifyContent: 'center'
              }}>
                {primarySpellSlots.map((skill, idx) => (
                  <div key={`spell-${idx}`} style={{ width: 46 }}>
                    {renderUseButton(skill, onUseSkill, () => onClearSpell(idx + 1), true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Middle column: hotkeys + active effects */}
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-attack', name: 'Attack' }, onUseSkill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-ranged', name: 'Ranged' }, onUseSkill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-sit', name: 'Sit/Stand' }, onUseSkill, () => {}, false)}</div>
                <div style={{ width: 48 }}>{renderUseButton({ id: 'builtin-meditate', name: 'Meditate' }, () => { onUseSkill({ id: 'builtin-meditate', name: 'Meditate' }); setShowConfig(true); }, () => {}, false)}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d6c18a', textAlign: 'center' }}>Effects</div>
              <div className="stone-effects" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, minHeight: 60 }}>
                <div className="stone-effects__icons" style={{ display: 'grid', gap: '6px', gridTemplateColumns: 'repeat(auto-fill, minmax(28px, 1fr))' }}>
                  {effects.map((fx) => {
                    const timeLeft = fx.expiresAt ? Math.max(0, Math.ceil((fx.expiresAt - Date.now()) / 1000)) : 0;
                    return (
                      <div
                        key={fx.id || fx.name}
                        style={{ position: 'relative', width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0 }}
                        title={fx.name || ''}
                      >
                        <EqIcon
                          index={fx.iconIndex || fx.icon || 0}
                          size={22}
                          cols={6}
                          rows={6}
                          sheet="/stone-ui/spellicons/spells1.png"
                        />
                        {timeLeft > 0 && (
                          <span
                            className="stone-effect__timer"
                            style={{
                              position: 'absolute',
                              bottom: -4,
                              right: -4,
                              background: '#000',
                              color: '#f5e9d7',
                              fontSize: 9,
                              padding: '0 3px',
                              borderRadius: 3,
                              lineHeight: 1.2
                            }}
                          >
                            {timeLeft}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right column: abilities (6) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '46px',
                gap: '1px',
                justifyContent: 'center'
              }}>
                {allAbilitySlots.map((skill, idx) => {
                  const slotIndex = idx + 1;
                  return (
                    <div key={`ability-${idx}`} style={{ width: 46 }}>
                    {renderUseButton(skill, onUseSkill, () => onClearAbility(slotIndex))}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="console-log">
        <div className="console-title">Combat Log</div>
        <div className="console-log__window" ref={logRef}>
          {combatLog.map((log) => (
            <div
              key={log.id}
              className={`log-line log-${log.type || 'normal'}`}
            >
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {showConfig && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onClick={() => setShowConfig(false)}
        >
          <div
            className="console"
            style={{ maxWidth: 720, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                {totalSpellSlots.map((skill, idx) =>
                  renderConfigRow(idx + 1, skill, spellOptions, handleSpellChange, onClearSpell, true)
                )}
              </div>
              <div>
                {totalAbilitySlots.map((skill, idx) =>
                  renderConfigRow(idx + 1, skill, abilityOptions, handleAbilityChange, onClearAbility, false)
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', marginBottom: '4px' }}>
              <button className="btn warn" onClick={() => setShowConfig(false)} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
