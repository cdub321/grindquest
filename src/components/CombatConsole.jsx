import { useEffect, useRef, useState } from 'react';
import EqIcon from './EqIcon';

export default function CombatConsole({
  currentMob,
  mobHp,
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
  onAssignAbility = () => {},
  onAssignSpell = () => {},
  onClearAbility = () => {},
  onClearSpell = () => {},
  onUseSkill,
  cooldowns = {},
  now = Date.now(),
  combatLog = []
}) {
  const logRef = useRef(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combatLog]);

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
          {skill && typeof (skill.iconIndex ?? skill.icon) === 'number' ? (
            <EqIcon index={skill.iconIndex ?? skill.icon} size={24} cols={6} sheet="/stone-ui/itemicons/items1.png" />
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
  while (totalSpellSlots.length < 9) totalSpellSlots.push(null);
  const totalAbilitySlots = [...abilitySlots];
  while (totalAbilitySlots.length < 9) totalAbilitySlots.push(null);
  const displayPlayerName = (characterName || '').trim() || 'Unnamed';

  const primarySpellSlots = totalSpellSlots.slice(0, 6);
  const extraSpellSlots = totalSpellSlots.slice(6, 9);
  const leadAbilitySlots = totalAbilitySlots.slice(0, 3);
  const trailingAbilitySlots = totalAbilitySlots.slice(3, 9);

  const getConInfo = () => {
    if (!currentMob) return null;
    const guessLevel = Math.max(1, Math.round((currentMob.xp || 0) / 100));
    const diff = guessLevel - level;
    if (diff >= 4) return { label: 'Red', color: '#b91c1c' };
    if (diff >= 2) return { label: 'Yellow', color: '#f59e0b' };
    if (diff >= -1 && diff <= 1) return { label: 'White', color: '#e5e7eb' };
    if (diff >= -6) return { label: 'Blue', color: '#3b82f6' };
    if (diff >= -10) return { label: 'L. Blue', color: '#60a5fa' };
    return { label: 'Green', color: '#10b981' };
  };
  const con = getConInfo();

  const renderUseButton = (skill, onUse, onClear, isSpell = false) => {
    const until = skill ? (cooldowns[skill.id] || 0) : 0;
    const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
    const isReady = remaining === 0;
    const isAutoToggle = !isSpell && skill?.id === 'builtin-auto' && isAutoAttack;
    const bgImage = isSpell
      ? "/stone-ui/ui/spellempty.png"
      : isAutoToggle
        ? "/stone-ui/ui/hotkeydown.png"
        : (skill ? "/stone-ui/ui/hotkeyup.png" : "/stone-ui/ui/hotkeyslot.png");
    const slotClass = isSpell ? 'spell-slot' : 'hotkey-slot';
    const classNames = [slotClass, skill ? 'has-skill' : 'hotkey-empty'].join(' ');
    return (
      <button
        className={classNames}
        style={{
          height: 48,
          width: 48,
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
          padding: 4
        }}
        onClick={() => skill && isReady && onUse(skill)}
        onDoubleClick={() => skill && onClear()}
        disabled={!skill || !isReady}
        title={skill ? skill.name : 'Empty'}
      >
        {isSpell && skill && typeof (skill.iconIndex ?? skill.icon) === 'number' ? (
          <EqIcon index={skill.iconIndex ?? skill.icon} size={24} cols={6} sheet="/stone-ui/itemicons/items1.png" />
        ) : null}
        {skill && (
          <div className="hotkey-slot__label">{skill.name}</div>
        )}
        {skill && !isReady && <div className="hotkey-slot__cd">{remaining}s</div>}
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
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: '6px',
                  height: 160,
                  border: '1px dashed rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c2b59b',
                  fontSize: 12,
                  textAlign: 'center',
                  padding: '6px'
                }}
              >
                Mob art placeholder
              </div>

              <div
                style={{
                  border: con ? `1px solid ${con.color}` : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '6px',
                  display: 'grid',
                  gap: '6px'
                }}
              >
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>
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
                  </div>
                </div>

                {currentMob && (currentMob.mana || currentMob.endurance) ? (() => {
                  const hasMana = currentMob.mana && currentMob.mana > 0;
                  const maxVal = hasMana ? currentMob.mana : currentMob.endurance || 0;
                  const label = hasMana ? 'Mana' : 'Endurance';
                  const currentVal = maxVal; // placeholder until mob resource spend is implemented
                  const pct = maxVal > 0 ? Math.max(0, Math.min(100, (currentVal / maxVal) * 100)) : 0;
                  const barColor = hasMana ? '#3b82f6' : '#f59e0b';
                  return (
                    <div className="console-bar">
                      <div className="console-bar__track">
                        <div
                          className="console-bar__fill"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor})` }}
                        />
                      </div>
                    </div>
                  );
                })() : null}

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap', fontSize: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#c2b59b' }}>DMG</div>
                    <div style={{ fontWeight: 700, fontSize: 11 }}>{currentMob.damage} {currentMob.delay ? `(Delay ${currentMob.delay})` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: '#c2b59b' }}>DMG Type</div>
                    <div style={{ fontWeight: 700, fontSize: 11 }}>{currentMob.damage_type || 'Physical'}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '6px',
                  display: 'grid',
                  gap: '4px'
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
                  </div>
                </div>
                <div className="console-bar">
                  <div className="console-bar__label">
                    <span>{playerClass.isCaster ? 'Mana' : 'Endurance'}</span>
                    <span>{playerClass.isCaster ? `${mana} / ${maxMana}` : `${endurance} / ${maxEndurance}`}</span>
                  </div>
                  <div className="console-bar__track">
                    <div
                      className="console-bar__fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, (playerClass.isCaster ? (mana / maxMana) : (endurance / maxEndurance)) * 100))}%`,
                        background: playerClass.isCaster ? 'linear-gradient(90deg, #3b82f6, #3b82f6)' : 'linear-gradient(90deg, #f59e0b, #f59e0b)'
                      }}
                    />
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
            className="console-title"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              backgroundImage: "url('/stone-ui/ui/bg-stone-light.png')",
              backgroundSize: 'cover',
              border: '1px solid rgba(0, 0, 0, 0.45)',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35)',
              borderRadius: '6px'
            }}
          >
            <button
              className="btn"
              onClick={() => setShowConfig(true)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: "url('/stone-ui/ui/bg-stone.png')",
                backgroundSize: 'cover',
                color: '#f5e9d7',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.45)',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                height: 34,
                borderRadius: '8px'
              }}
            >
              <span style={{ position: 'relative', top: '3px' }}>Abilities</span>
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              alignItems: 'start'
            }}
          >
            {/* Left column: primary spells (6) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 46px))',
                gap: '4px',
                justifyContent: 'start'
              }}>
                {primarySpellSlots.map((skill, idx) => (
                  <div key={`spell-${idx}`} style={{ width: 46 }}>
                    {renderUseButton(skill, onUseSkill, () => onClearSpell(idx + 1), true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Middle column: extra spells (3) + extra abilities (3) */}
            <div style={{ minWidth: 0, display: 'grid', gap: '8px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 46px))',
                gap: '4px',
                justifyContent: 'start'
              }}>
                {extraSpellSlots.map((skill, idx) => {
                  const slotIndex = 6 + idx + 1;
                  return (
                    <div key={`extra-spell-${idx}`} style={{ width: 46 }}>
                      {renderUseButton(skill, onUseSkill, () => onClearSpell(slotIndex), true)}
                    </div>
                  );
                })}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 46px))',
                gap: '4px',
                justifyContent: 'start'
              }}>
                {leadAbilitySlots.map((skill, idx) => {
                  const slotIndex = idx + 1;
                  return (
                    <div key={`lead-ability-${idx}`} style={{ width: 46 }}>
                      {renderUseButton(skill, onUseSkill, () => onClearAbility(slotIndex))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column: primary abilities (6) */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 46px))',
                gap: '4px',
                justifyContent: 'start'
              }}>
                {trailingAbilitySlots.map((skill, idx) => {
                  const slotIndex = 3 + idx + 1;
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
