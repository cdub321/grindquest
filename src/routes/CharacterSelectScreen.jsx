import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import { get_session, fetch_characters, delete_character, create_character } from '../services/playerStorage'
import { fetch_classes_catalog, fetch_races, fetch_deities, fetch_class, fetch_race, fetch_deity, fetch_race_class_allowed, fetch_deity_class_allowed, fetch_race_deity_allowed, fetch_camps_by_zone } from '../services/referenceData'
import { CharacterSelectPanel, CharacterCreatePanel } from '../components/CharacterSelectAndCreate'

function CharacterSelectScreen({ onSignOut }) {
  const navigate = useNavigate()
  const [loading, set_loading] = useState(true)
  const [characters, set_characters] = useState([])
  const [show_create_modal, set_show_create_modal] = useState(false)
  
  // Reference data caches
  const [class_cache, set_class_cache] = useState({})
  const [race_cache, set_race_cache] = useState({})
  const [deity_cache, set_deity_cache] = useState({})
  const audio_ref = useRef(null)
  
  // Race/class, deity/class, and race/deity restrictions
  const [race_class_allowed, set_race_class_allowed] = useState([])
  const [deity_class_allowed, set_deity_class_allowed] = useState([])
  const [race_deity_allowed, set_race_deity_allowed] = useState([])

  // Load characters and reference data on mount
  useEffect(() => {
    const load_data = async () => {
      try {
        set_loading(true)
        
        // Get current user
        const { data: session_data } = await get_session()
        const user_id = session_data?.session?.user?.id
        if (!user_id) {
          console.error('No user session found')
          set_loading(false)
          return
        }

        // Pre-fetch all reference data (best practice - we'll need it for all characters)
        const [chars_data, classes_data, races_data, deities_data, race_class_data, deity_class_data, race_deity_data] = await Promise.all([
          fetch_characters(user_id).catch(() => []),
          fetch_classes_catalog().catch(() => []),
          fetch_races().catch(() => []),
          fetch_deities().catch(() => []),
          fetch_race_class_allowed().catch(() => []),
          fetch_deity_class_allowed().catch(() => []),
          fetch_race_deity_allowed().catch(() => [])
        ])

        // Build class cache (using c_id as key)
        const class_map = {}
        classes_data.forEach(c => {
          class_map[c.c_id] = c
        })
        set_class_cache(class_map)

        // Build race and deity caches (using r_id and d_id as keys)
        const race_map = {}
        races_data.forEach(r => {
          race_map[r.r_id] = r
        })
        set_race_cache(race_map)

        const deity_map = {}
        deities_data.forEach(d => {
          deity_map[d.d_id] = d
        })
        set_deity_cache(deity_map)

        // Load race/class, deity/class, and race/deity restrictions
        set_race_class_allowed(race_class_data || [])
        set_deity_class_allowed(deity_class_data || [])
        set_race_deity_allowed(race_deity_data || [])

        set_characters(chars_data || [])
      } catch (error) {
        console.error('Error loading character select data:', error)
      } finally {
        set_loading(false)
      }
    }

    load_data()
  }, [])

  // Play default music on character select/create screens
  useEffect(() => {
    // Stop any existing audio
    if (audio_ref.current) {
      audio_ref.current.pause()
      audio_ref.current.src = ''
      audio_ref.current = null
    }

    const audio = new Audio('/audio/biomes/default.mp3')
    audio.loop = true
    audio.volume = 0.1
    audio.play().catch(() => {
      // Autoplay might be blocked until user interaction; fail quietly
    })
    audio_ref.current = audio

    return () => {
      if (audio_ref.current) {
        audio_ref.current.pause()
        audio_ref.current.src = ''
        audio_ref.current = null
      }
    }
  }, [])

  // Fetch class helper (with caching)
  const fetch_class_helper = async (class_id) => {
    if (class_cache[class_id]) {
      return class_cache[class_id]
    }
    try {
      const class_data = await fetch_class(class_id)
      set_class_cache(prev => ({ ...prev, [class_id]: class_data }))
      return class_data
    } catch (error) {
      console.error(`Failed to fetch class ${class_id}:`, error)
      throw error
    }
  }

  // Fetch race helper (with caching)
  const fetch_race_helper = async (race_id) => {
    if (race_cache[race_id]) {
      return race_cache[race_id]
    }
    try {
      const race_data = await fetch_race(race_id)
      set_race_cache(prev => ({ ...prev, [race_id]: race_data }))
      return race_data
    } catch (error) {
      console.error(`Failed to fetch race ${race_id}:`, error)
      throw error
    }
  }

  // Fetch deity helper (with caching)
  const fetch_deity_helper = async (deity_id) => {
    if (deity_cache[deity_id]) {
      return deity_cache[deity_id]
    }
    try {
      const deity_data = await fetch_deity(deity_id)
      set_deity_cache(prev => ({ ...prev, [deity_id]: deity_data }))
      return deity_data
    } catch (error) {
      console.error(`Failed to fetch deity ${deity_id}:`, error)
      throw error
    }
  }

  // Handle character selection
  const handle_select = (character_id) => {
    navigate(`/game/${character_id}`)
  }

  // Handle character creation
  const handle_create = async (create_data) => {
    try {
      const { data: session_data } = await get_session()
      const user_id = session_data?.session?.user?.id
      if (!user_id) {
        console.error('No user session found')
        return
      }

      // Get class data to calculate base stats
      const class_data = await fetch_class_helper(create_data.classKey)
      if (!class_data) {
        throw new Error('Class not found')
      }

      // Get race data to find home zone and starting camp
      const race_data = await fetch_race_helper(create_data.raceId)
      if (!race_data) {
        throw new Error('Race not found')
      }

      // Get deity data for xp_mod calculation
      const deity_data = await fetch_deity_helper(create_data.deityId)
      if (!deity_data) {
        throw new Error('Deity not found')
      }

      const home_zone_id = race_data.home_zone_id
      if (!home_zone_id) {
        throw new Error('Race has no home zone set')
      }

      // Find the zoneline camp in the home zone (for starting position)
      const zone_camps = await fetch_camps_by_zone(home_zone_id)
      const zoneline_camp = zone_camps.find(camp => {
        const content_flags = (camp.content_flags || '').toLowerCase()
        return content_flags.includes('zoneline')
      })

      if (!zoneline_camp) {
        throw new Error(`No zoneline camp found in zone ${home_zone_id}`)
      }

      // Get bind_camp_id from class.home_camp_id (jsonb array like [{"race_id": race_id, "camp_id": camp_id}])
      let bind_camp_id = null
      if (class_data.home_camp_id) {
        let home_camp_array = class_data.home_camp_id
          if (typeof home_camp_array === 'string') {
            try {
              home_camp_array = JSON.parse(home_camp_array)
            } catch {
              throw new Error(`Invalid home_camp_id format for class ${create_data.classKey}`)
            }
          }
          // Accept either a plain object map { "raceId": campId } or an array wrapper with one object map inside
          if (Array.isArray(home_camp_array)) {
            if (home_camp_array.length === 1 && typeof home_camp_array[0] === 'object' && !Array.isArray(home_camp_array[0])) {
              home_camp_array = home_camp_array[0];
            } else {
              throw new Error(`home_camp_id must be an object map for class ${create_data.classKey}`)
            }
          }
          if (!home_camp_array || typeof home_camp_array !== 'object' || Array.isArray(home_camp_array)) {
            throw new Error(`home_camp_id must be an object map for class ${create_data.classKey}`)
          }
          // Map form: { "raceId": campId, ... }
          const camp_val = home_camp_array[create_data.raceId] ?? home_camp_array[String(create_data.raceId)]
          if (!camp_val) {
            throw new Error(`No home_camp_id entry found for race ${create_data.raceId}`)
          }
          bind_camp_id = camp_val
        } else {
          throw new Error(`Class ${create_data.classKey} has no home_camp_id set`)
        }

      // Calculate xp_mod from class, race, and deity modifiers
      // Multiply modifiers together (e.g., 1.0 * 1.0 * 1.0 = 1.0, then * 100 = 100)
      const combined_xp_mod = Math.round((class_data.class_xp_mod / 100) * (race_data.race_xp_mod / 100) * (deity_data.deity_xp_mod / 100) * 100)

      // Parse race base_stats (JSONB - may be string or object)
      let race_base_stats = {}
      if (race_data.base_stats) {
        if (typeof race_data.base_stats === 'string') {
          try {
            race_base_stats = JSON.parse(race_data.base_stats)
          } catch {
            race_base_stats = {}
          }
        } else {
          race_base_stats = race_data.base_stats
        }
      }

      // Combine race base_stats with manually allocated stats
      const manual_stats = create_data.stats || {}
      const str_base = (Number(race_base_stats.str) || 0) + (Number(manual_stats.str) || 0)
      const sta_base = (Number(race_base_stats.sta) || 0) + (Number(manual_stats.sta) || 0)
      const agi_base = (Number(race_base_stats.agi) || 0) + (Number(manual_stats.agi) || 0)
      const dex_base = (Number(race_base_stats.dex) || 0) + (Number(manual_stats.dex) || 0)
      const int_base = (Number(race_base_stats.int) || 0) + (Number(manual_stats.int) || 0)
      const wis_base = (Number(race_base_stats.wis) || 0) + (Number(manual_stats.wis) || 0)
      const cha_base = (Number(race_base_stats.cha) || 0) + (Number(manual_stats.cha) || 0)

      // Transform create_data to match create_character payload
      const payload = {
        name: create_data.name,
        class_id: create_data.classKey,
        race_id: create_data.raceId,
        deity_id: create_data.deityId,
        mode: create_data.mode === 'hardcore' ? true : false,
        str_base: str_base,
        sta_base: sta_base,
        agi_base: agi_base,
        dex_base: dex_base,
        int_base: int_base,
        wis_base: wis_base,
        cha_base: cha_base,
        base_hp: class_data.base_hp,
        base_mana: class_data.base_mana,
        base_endurance: class_data.base_endurance,
        resource_type: class_data.resource_type || 'melee',
        zone_id: home_zone_id,
        bind_zone_id: home_zone_id,
        bind_camp_id: bind_camp_id,
        current_camp_id: zoneline_camp.id,
        xp_mod: combined_xp_mod
      }

      // Create character
      await create_character(user_id, payload)
      
      // Close modal
      set_show_create_modal(false)
      
      // Reload characters list to show new character
      const updated_chars = await fetch_characters(user_id)
      set_characters(updated_chars || [])
    } catch (error) {
      console.error('Error creating character:', error)
      alert(`Failed to create character: ${error.message}`)
    }
  }

  // Handle character deletion
  const handle_delete = async (character_id) => {
    // Browser confirm dialog
    if (!window.confirm('Are you sure you want to delete this character? This action cannot be undone.')) {
      return
    }

    try {
      const { data: session_data } = await get_session()
      const user_id = session_data?.session?.user?.id
      if (!user_id) {
        console.error('No user session found')
        return
      }

      await delete_character(user_id, character_id)
      
      // Reload characters list
      const updated_chars = await fetch_characters(user_id)
      set_characters(updated_chars || [])
    } catch (error) {
      console.error('Error deleting character:', error)
      alert(`Failed to delete character: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ padding: '16px' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="head" style={{ marginBottom: '24px' }}>
          <div className="head-left">
            <h1>GrindQuest</h1>
            <p>An EverQuest Idle Adventure</p>
          </div>
          <div className="head-actions">
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="btn"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Character Select Panel */}
        <CharacterSelectPanel
          characters={characters}
          onSelect={handle_select}
          onCreateClick={() => set_show_create_modal(true)}
          onDelete={handle_delete}
          classCache={class_cache}
          raceCache={race_cache}
          deityCache={deity_cache}
        />

        {/* Create Character Modal */}
        {show_create_modal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                set_show_create_modal(false)
              }
            }}
          >
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-300">Create Character</h2>
                <button
                  onClick={() => set_show_create_modal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <CharacterCreatePanel
                classes={class_cache}
                races={Object.values(race_cache)}
                deities={Object.values(deity_cache)}
                race_class_allowed={race_class_allowed}
                deity_class_allowed={deity_class_allowed}
                race_deity_allowed={race_deity_allowed}
                onCreate={handle_create}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CharacterSelectScreen
