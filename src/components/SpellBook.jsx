import { useState } from 'react';
import Icon from './Icon';

export default function SpellBook({
  isOpen,
  onClose,
  ability_slots = [],
  spell_slots = [],
  known_abilities = [],
  known_spells = [],
  cooldowns = {},
  now = Date.now(),
  on_assign_ability = () => {},
  on_assign_spell = () => {},
  on_clear_ability = () => {},
  on_clear_spell = () => {}
}) {
  if (!isOpen) return null;

  // Helper to get skill ID from slot
  const getSkillId = (skill) => typeof skill === 'string' ? skill : (skill?.id || skill?.spell_id);

  // Helper to get effect icon
  const getEffectIcon = (skill) => {
    if (!skill) return null;
    // Skills are now always objects (learned spells/abilities from database)
    // Data is normalized in useCharacterLoader - icon_index is always present
    return skill.icon_index || null;
  };

  const handleAbilityChange = (slotIdx, val) => {
    if (!val) {
      on_clear_ability(slotIdx);
      return;
    }
    on_assign_ability(slotIdx, val);
  };

  const handleSpellChange = (slotIdx, val) => {
    if (!val) {
      on_clear_spell(slotIdx);
      return;
    }
    on_assign_spell(slotIdx, val);
  };

  const renderConfigRow = (slotIdx, skill, getOptions, onChange, onClear, isSpell = false) => {
    const options = getOptions(slotIdx);
    const skillId = typeof skill === 'string' ? skill : (skill?.id || skill?.spell_id);
    const until = skillId ? (cooldowns[skillId] || 0) : 0;
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
        <div style={{ fontSize: '11px', color: '#d6c18a' }}>{isSpell ? 'Spell' : 'Ability'} {slotIdx}</div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {skill && typeof effectIcon === 'number' ? (
            <Icon index={effectIcon} size={24} cols={6} sheet="/stone-ui/spellicons/spells1.png" />
          ) : null}
        </div>
        <select
          value={typeof skill === 'string' ? skill : (skill?.id || skill?.spell_id || '')}
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

  // Filter out abilities already assigned to OTHER slots (not the current one being edited)
  const getAbilityOptions = (currentSlotIndex) => {
    const assigned_ability_ids = new Set(
      ability_slots
        .map((s, idx) => idx !== currentSlotIndex - 1 && s !== null ? getSkillId(s) : null)
        .filter(Boolean)
    );
    const abilities = [
      ...(known_abilities || []).filter(a => {
        const id = a.id || a.spell_id;
        return id && !assigned_ability_ids.has(id);
      }).map((a) => ({ id: a.id || a.spell_id, name: a.name }))
    ];
    // Add Auto Attack mechanic if not already assigned to another slot
    if (!assigned_ability_ids.has('mechanic-auto-attack')) {
      abilities.push({ id: 'mechanic-auto-attack', name: 'Auto Attack' });
    }
    return abilities;
  };

  // Filter out spells already assigned to OTHER slots (not the current one being edited)
  const getSpellOptions = (currentSlotIndex) => {
    const assigned_spell_ids = new Set(
      spell_slots
        .map((s, idx) => idx !== currentSlotIndex - 1 && s !== null ? getSkillId(s) : null)
        .filter(Boolean)
    );
    const spells = [
      ...(known_spells || []).filter(s => {
        const id = s.id || s.spell_id;
        return id && !assigned_spell_ids.has(id);
      }).map((s) => ({ id: s.id || s.spell_id, name: s.name }))
    ];
    // Add Auto Cast mechanic if not already assigned to another slot
    if (!assigned_spell_ids.has('mechanic-auto-cast')) {
      spells.push({ id: 'mechanic-auto-cast', name: 'Auto Cast' });
    }
    return spells;
  };

  const totalSpellSlots = [...spell_slots];
  while (totalSpellSlots.length < 6) totalSpellSlots.push(null);
  const totalAbilitySlots = [...ability_slots];
  while (totalAbilitySlots.length < 6) totalAbilitySlots.push(null);

  return (
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
      onClick={onClose}
    >
      <div
        className="console"
        style={{ maxWidth: 720, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            {totalSpellSlots.map((skill, idx) =>
              renderConfigRow(idx + 1, skill, getSpellOptions, handleSpellChange, on_clear_spell, true)
            )}
          </div>
          <div>
            {totalAbilitySlots.map((skill, idx) =>
              renderConfigRow(idx + 1, skill, getAbilityOptions, handleAbilityChange, on_clear_ability, false)
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', marginBottom: '4px' }}>
          <button className="btn warn" onClick={onClose} style={{ padding: '4px 12px', fontSize: '11px' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
