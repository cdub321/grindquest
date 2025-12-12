import React, { useState, useEffect, useRef } from 'react';

// Game data
const ZONES = {
  crushbone: {
    name: "Crushbone",
    mobs: [
      { name: "Orc Pawn", hp: 50, damage: 3, xp: 10, loot: ["Rusty Axe", "Belt", "Copper Pieces"] },
      { name: "Orc Centurion", hp: 120, damage: 8, xp: 30, loot: ["Fine Steel Sword", "Orc Belt", "Silver Pieces"] },
      { name: "Ambassador Dvinn", hp: 500, damage: 15, xp: 150, loot: ["Dwarven Ringmail Tunic", "Ambassador's Boots", "Gold Pieces"], isNamed: true }
    ]
  }
};

const CLASSES = {
  warrior: { name: "Warrior", baseDamage: 8, baseHp: 120, attackSpeed: 1000 },
  wizard: { name: "Wizard", baseDamage: 15, baseHp: 80, attackSpeed: 2500, mana: 100 }
};

export default function GrindQuest() {
  // Character state
  const [playerClass] = useState(CLASSES.warrior);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [hp, setHp] = useState(playerClass.baseHp);
  const [maxHp] = useState(playerClass.baseHp);
  const [gold, setGold] = useState(0);
  
  // Combat state
  const [currentZone] = useState(ZONES.crushbone);
  const [currentMob, setCurrentMob] = useState(null);
  const [mobHp, setMobHp] = useState(0);
  const [isAutoAttack, setIsAutoAttack] = useState(false);
  const [combatLog, setCombatLog] = useState([]);
  const [inventory, setInventory] = useState([]);
  
  // Refs for timers
  const autoAttackInterval = useRef(null);
  
  // XP needed for next level
  const xpNeeded = level * 100;
  
  // Add log message
  const addLog = (message, type = 'normal') => {
    setCombatLog(prev => [...prev.slice(-5), { message, type, id: Date.now() }]);
  };
  
  // Spawn a mob
  const spawnMob = () => {
    const mob = currentZone.mobs[Math.floor(Math.random() * currentZone.mobs.length)];
    setCurrentMob(mob);
    setMobHp(mob.hp);
    addLog(`${mob.name} spawns!`, 'spawn');
  };
  
  // Attack the current mob
  const attackMob = () => {
    if (!currentMob || mobHp <= 0) return;
    
    const damage = Math.floor(playerClass.baseDamage * (1 + level * 0.1) + Math.random() * 5);
    const newHp = Math.max(0, mobHp - damage);
    setMobHp(newHp);
    addLog(`You hit ${currentMob.name} for ${damage} damage!`, 'damage');
    
    // Mob dies
    if (newHp === 0) {
      addLog(`${currentMob.name} has been slain!`, 'kill');
      
      // Award XP
      const xpGain = currentMob.xp;
      const newXp = xp + xpGain;
      setXp(newXp);
      addLog(`You gain ${xpGain} experience!`, 'xp');
      
      // Level up check
      if (newXp >= xpNeeded) {
        setLevel(level + 1);
        setXp(newXp - xpNeeded);
        addLog(`You have gained a level! You are now level ${level + 1}!`, 'levelup');
      }
      
      // Loot
      if (Math.random() < 0.3) {
        const lootItem = currentMob.loot[Math.floor(Math.random() * currentMob.loot.length)];
        setInventory(prev => [...prev, lootItem]);
        addLog(`You receive: ${lootItem}`, 'loot');
        
        if (lootItem.includes("Pieces")) {
          const goldGain = lootItem.includes("Gold") ? 10 : lootItem.includes("Silver") ? 5 : 1;
          setGold(prev => prev + goldGain);
        }
      }
      
      // Spawn new mob after delay
      setTimeout(() => spawnMob(), 1000);
    } else {
      // Mob counter-attacks
      setTimeout(() => {
        if (newHp > 0) {
          const mobDamage = currentMob.damage;
          setHp(prev => Math.max(0, prev - mobDamage));
          addLog(`${currentMob.name} hits YOU for ${mobDamage} damage!`, 'mobattack');
        }
      }, 500);
    }
  };
  
  // Toggle auto-attack
  const toggleAutoAttack = () => {
    setIsAutoAttack(!isAutoAttack);
    addLog(isAutoAttack ? 'Auto-attack disabled' : 'Auto-attack enabled', 'system');
  };
  
  // Auto-attack effect
  useEffect(() => {
    if (isAutoAttack && currentMob && mobHp > 0) {
      autoAttackInterval.current = setInterval(() => {
        attackMob();
      }, playerClass.attackSpeed);
    } else {
      if (autoAttackInterval.current) {
        clearInterval(autoAttackInterval.current);
      }
    }
    
    return () => {
      if (autoAttackInterval.current) {
        clearInterval(autoAttackInterval.current);
      }
    };
  }, [isAutoAttack, currentMob, mobHp]);
  
  // Spawn initial mob
  useEffect(() => {
    spawnMob();
  }, []);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-blue-400 mb-2">GrindQuest</h1>
          <p className="text-gray-400">An EverQuest Idle Adventure</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Character */}
          <div className="space-y-6">
            {/* Character Panel */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">Character</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Class:</span>
                  <span className="text-white font-semibold">{playerClass.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Level:</span>
                  <span className="text-white font-semibold">{level}</span>
                </div>
                
                {/* HP Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-400">HP</span>
                    <span className="text-white">{hp} / {maxHp}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-red-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${(hp / maxHp) * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* XP Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-400">XP</span>
                    <span className="text-white">{xp} / {xpNeeded}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${(xp / xpNeeded) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-yellow-400">Gold:</span>
                  <span className="text-yellow-300 font-semibold">{gold}</span>
                </div>
              </div>
            </div>
            
            {/* Inventory */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">Inventory</h2>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {inventory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No items</p>
                ) : (
                  inventory.slice(-8).map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-300 bg-slate-700 px-2 py-1 rounded">
                      {item}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Middle Column - Combat */}
          <div className="space-y-6">
            {/* Zone Info */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-2">Current Zone</h2>
              <p className="text-2xl font-bold text-white">{currentZone.name}</p>
            </div>
            
            {/* Combat Window */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">Combat</h2>
              
              {currentMob && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-lg font-semibold ${currentMob.isNamed ? 'text-yellow-400' : 'text-white'}`}>
                      {currentMob.name}
                    </span>
                    {currentMob.isNamed && (
                      <span className="text-xs bg-yellow-600 px-2 py-1 rounded">NAMED</span>
                    )}
                  </div>
                  
                  {/* Mob HP Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-red-400">HP</span>
                      <span className="text-white">{mobHp} / {currentMob.hp}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4">
                      <div 
                        className="bg-red-500 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${(mobHp / currentMob.hp) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Combat Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={attackMob}
                  disabled={!currentMob || mobHp === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded transition-colors"
                >
                  Attack
                </button>
                <button
                  onClick={toggleAutoAttack}
                  className={`flex-1 ${isAutoAttack ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 px-4 rounded transition-colors`}
                >
                  {isAutoAttack ? 'Auto: ON' : 'Auto: OFF'}
                </button>
              </div>
            </div>
            
            {/* Combat Log */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">Combat Log</h2>
              <div className="space-y-1 h-40 overflow-y-auto font-mono text-sm">
                {combatLog.map((log) => (
                  <div 
                    key={log.id}
                    className={`
                      ${log.type === 'damage' ? 'text-orange-400' : ''}
                      ${log.type === 'kill' ? 'text-green-400' : ''}
                      ${log.type === 'xp' ? 'text-blue-400' : ''}
                      ${log.type === 'loot' ? 'text-yellow-400' : ''}
                      ${log.type === 'levelup' ? 'text-purple-400 font-bold' : ''}
                      ${log.type === 'mobattack' ? 'text-red-400' : ''}
                      ${log.type === 'spawn' ? 'text-gray-400' : ''}
                      ${log.type === 'system' ? 'text-cyan-400' : ''}
                      ${log.type === 'normal' ? 'text-gray-300' : ''}
                    `}
                  >
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Right Column - Info */}
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">How to Play</h2>
              <div className="space-y-2 text-sm text-gray-300">
                <p>🗡️ Click <strong>Attack</strong> to fight mobs manually</p>
                <p>⚙️ Enable <strong>Auto-Attack</strong> to fight automatically</p>
                <p>📈 Gain XP to level up and deal more damage</p>
                <p>💰 Collect loot and gold from defeated enemies</p>
                <p>⭐ Named mobs (yellow) have better loot!</p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">Stats</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Damage:</span>
                  <span className="text-white">{Math.floor(playerClass.baseDamage * (1 + level * 0.1))}-{Math.floor(playerClass.baseDamage * (1 + level * 0.1) + 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Attack Speed:</span>
                  <span className="text-white">{playerClass.attackSpeed}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Items Found:</span>
                  <span className="text-white">{inventory.length}</span>
                </div>
              </div>
            </div>
            
            {/* Future Features */}
            <div className="bg-slate-800 border-2 border-blue-900 rounded-lg p-4">
              <h2 className="text-xl font-bold text-blue-300 mb-3">Coming Soon</h2>
              <div className="space-y-1 text-sm text-gray-400">
                <p>🗺️ Multiple zones to explore</p>
                <p>⚔️ Equipment system</p>
                <p>🎯 Named mob camps</p>
                <p>🔮 Spell system for casters</p>
                <p>🛠️ Tradeskills</p>
                <p>👥 Group & raid content</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}